import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  AddGuideCommand,
  AddLayerCommand,
  AddStrokeCommand,
  BatchCommand,
  DeleteLayerCommand,
  RemoveGuideCommand,
  RemoveStrokeCommand,
  ReplaceStrokesCommand,
} from './commands';
import { Guides } from './Guides';
import { History, type Command } from './History';
import { Layers } from './Layers';
import { parseProject } from './project';
import { StrokeLayer } from './StrokeLayer';
import {
  DEFAULT_BRUSH,
  PROJECT_FORMAT,
  PROJECT_VERSION,
  type BrushSettings,
  type GuidePlaneData,
  type GuideType,
  type HistoryInfo,
  type InputInfo,
  type LayersInfo,
  type ProjectFile,
  type StrokeData,
  type ToolId,
  type TouchMode,
  type TransformMode,
  type Vec3Tuple,
  type ViewId,
} from './types';

const MIN_POINT_DISTANCE = 0.018;
/** Panjang minimum garis (satuan dunia) agar bisa menjadi bidang guide. */
const MIN_GUIDE_LENGTH = 0.3;
/** surfaceId untuk bidang gambar default (bukan guide). */
const DEFAULT_SURFACE = -1;

interface SurfaceHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  surface: number;
}

interface PxPoint {
  x: number;
  y: number;
}

/** Gerakan kurang dari ini (piksel) dianggap ketukan, bukan lasso. */
const TAP_SLOP = 10;
/** Radius pencarian goresan terdekat saat ketuk (piksel). */
const TAP_PICK_RADIUS = 28;
const ROTATE_SPEED = 0.01;
const SCALE_SPEED = 0.005;
/** Faktor penghalusan maksimum Stable Stroke (saat slider 100). */
const STABILIZE_MAX = 0.75;

/** Uji titik di dalam poligon (ray casting). */
const inPolygon = (p: PxPoint, poly: PxPoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const crosses = a.y > p.y !== b.y > p.y;
    if (crosses && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

type StrokeStyle = Omit<StrokeData, 'id' | 'points' | 'pressures'>;

const toTuple = (v: THREE.Vector3): Vec3Tuple => [v.x, v.y, v.z];

/**
 * Inti aplikasi: scene Three.js, input pointer, goresan, dan history.
 * Sengaja tidak bergantung pada React; UI hanya memanggil method publik di sini
 * dan mendengarkan `onChange`.
 */
export class Engine {
  /** Dipanggil setiap jumlah goresan atau status undo/redo berubah. */
  onChange?: (info: HistoryInfo) => void;
  /** Dipanggil (dibatasi ~15x/detik) saat indikator input debug aktif. */
  onInput?: (info: InputInfo) => void;
  /** Dipanggil setelah goresan pada mode Draw 3D Guide selesai. created=false bila garis tak valid. */
  onGuideDrawEnd?: (created: boolean) => void;
  /** Titik lasso (piksel kanvas) saat memilih; null saat selesai. Dipakai untuk overlay. */
  onLasso?: (points: PxPoint[] | null) => void;
  /** Dipanggil saat Eyedropper mengambil pengaturan kuas dari sebuah goresan. */
  onBrushPicked?: (patch: Partial<BrushSettings>) => void;
  /** Dipanggil saat daftar layer atau layer aktif berubah. */
  onLayers?: (info: LayersInfo) => void;
  /** Pesan singkat untuk pengguna (mis. layer terkunci). */
  onNotice?: (text: string) => void;

  private readonly canvas: HTMLCanvasElement;
  private readonly stage: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly perspCamera: THREE.PerspectiveCamera;
  private readonly orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private ortho = false;
  /** Setengah tinggi tampilan ortografi (satuan dunia), diset saat beralih ke ortografi. */
  private orthoHalfHeight = 4;
  private readonly controls: OrbitControls;
  private readonly grid: THREE.GridHelper;
  private readonly guides = new Guides();
  private readonly layer = new StrokeLayer();
  private readonly layers = new Layers();
  private readonly history = new History();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  /** Bidang gambar default (XY, menghadap kamera awal), dipakai saat tidak ada panduan. */
  private readonly drawPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly resizeObserver: ResizeObserver;

  private tool: ToolId = 'draw';
  private brush: BrushSettings = { ...DEFAULT_BRUSH };
  private mirror = false;
  private touchMode: TouchMode = 'auto';
  /** True setelah ada event dari stylus; dipakai mode 'auto' untuk mengalihkan jari ke navigasi. */
  private penSeen = false;

  private drawing = false;
  private activePointerId = -1;
  private draftPoints: Vec3Tuple[] = [];
  private draftPressures: number[] = [];
  private draftStyle: StrokeStyle | null = null;
  private draftTimes: number[] = [];
  private draftStartTime = 0;
  private nextId = 1;

  private inputDebug = false;
  private contactActive = false;
  private contactMin = 0;
  private contactMax = 0;
  private lastInputEmit = 0;
  private frame = 0;
  private needsRender = true;
  private previewDirty = false;
  private guideDraw = false;
  private nextPlaneId = 1;
  /** Permukaan tempat goresan dimulai (null = belum ada); goresan tetap terkunci di sini. */
  private draftSurface: number | null = null;
  private draftNormal = new THREE.Vector3(0, 0, 1);
  private erasing = false;
  private erasePointerId = -1;
  private eraseRemoved: StrokeData[] = [];
  /** Bidang guide di bawah pointer saat eraser menyentuh (hanya dipakai bila tap kosong). */
  private erasePlane: number | null = null;
  private eraseDragged = false;
  private eraseStartX = 0;
  private eraseStartY = 0;

  private readonly selectionBox = new THREE.Box3Helper(new THREE.Box3(), 0x4a3fd0);
  private selecting = false;
  private selectPointerId = -1;
  private lasso: PxPoint[] = [];
  private lassoLength = 0;
  private transformMode: TransformMode | null = null;
  private transforming = false;
  private transformPointerId = -1;
  private transformStartX = 0;
  private transformStartY = 0;
  private transformMoved = false;
  private transformScale = 1;
  /** Posisi pointer yang sudah dihaluskan (Stable Stroke), dalam koordinat klien. */
  private smoothX = 0;
  private smoothY = 0;
  private activeLayer = 1;
  private readonly transformPivot = new THREE.Vector3();
  private readonly transformMatrix = new THREE.Matrix4();

  /** True bila ada gestur pointer yang sedang berjalan (gambar/hapus/pilih/transformasi). */
  private get busy(): boolean {
    return this.drawing || this.erasing || this.selecting || this.transforming;
  }

  constructor(canvas: HTMLCanvasElement, stage: HTMLElement) {
    this.canvas = canvas;
    this.stage = stage;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color('#e9eaef');

    const { width, height } = this.stageSize();
    this.renderer.setSize(width, height, false);

    this.perspCamera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera = this.perspCamera;
    this.camera.position.set(4.8, 3.8, 6.8);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xd8dcff, 0x292332, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    sun.position.set(4, 7, 5);
    this.scene.add(sun);

    this.grid = new THREE.GridHelper(12, 24, 0xaeb3c4, 0xd0d3de);
    this.scene.add(this.grid);
    this.scene.add(this.guides.root, this.layer.root);
    this.selectionBox.visible = false;
    this.selectionBox.frustumCulled = false;
    this.scene.add(this.selectionBox);

    this.history.onChange = () => this.emit();
    this.layers.onChange = () => this.syncLayers();
    this.layers.reset([{ id: 1, name: 'Layer 1', visible: true, locked: false }]);

    // Fase capture di stage berjalan SEBELUM listener OrbitControls di canvas,
    // sehingga kita bisa menentukan apakah pointer ini boleh menavigasi kamera.
    stage.addEventListener('pointerdown', this.onPointerDownCapture, true);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerEnd);
    canvas.addEventListener('pointercancel', this.onPointerEnd);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(stage);

    this.setTool('draw');
    this.loop();
    this.emit();
  }

  // ---------------------------------------------------------------- settings

  setTool(tool: ToolId): void {
    this.tool = tool;
    if (tool !== 'select' && this.layer.selectionCount > 0) this.setSelection([]);
  }

  setTransformMode(mode: TransformMode | null): void {
    this.transformMode = mode;
  }

  setTouchMode(mode: TouchMode): void {
    this.touchMode = mode;
  }

  setInputDebug(on: boolean): void {
    this.inputDebug = on;
  }

  setBrush(brush: BrushSettings): void {
    this.brush = { ...brush };
  }

  setMirror(mirror: boolean): void {
    this.mirror = mirror;
  }

  setGuide(type: GuideType): void {
    if (type === this.guides.type) return;
    this.guides.setType(type);
    this.invalidate();
  }

  setGridVisible(visible: boolean): void {
    if (this.grid.visible === visible) return;
    this.grid.visible = visible;
    this.invalidate();
  }

  setGuideVisible(visible: boolean): void {
    if (this.guides.root.visible === visible) return;
    this.guides.setVisible(visible);
    this.invalidate();
  }

  setGuideDraw(on: boolean): void {
    this.guideDraw = on;
  }

  // ----------------------------------------------------------------- actions
  setView(view: ViewId): void {
    const dirs: Record<ViewId, THREE.Vector3> = {
      front: new THREE.Vector3(0, 0, 1),
      side: new THREE.Vector3(1, 0, 0),
      top: new THREE.Vector3(0, 1, 0),
    };
    const dist = this.camera.position.distanceTo(this.controls.target);
    this.camera.position.copy(this.controls.target).addScaledVector(dirs[view], dist);
    this.controls.update();
    this.invalidate();
  }

  setOrtho(on: boolean): void {
    if (this.ortho === on) return;
    this.ortho = on;
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target);
    const next = on ? this.orthoCamera : this.perspCamera;
    if (on) {
      // Samakan ukuran objek di titik target dengan kamera perspektif.
      this.orthoCamera.zoom = 1;
      this.orthoHalfHeight = offset.length() * Math.tan(THREE.MathUtils.degToRad(this.perspCamera.fov / 2));
    } else {
      offset.divideScalar(this.orthoCamera.zoom);
    }
    next.position.copy(target).add(offset);
    next.quaternion.copy(this.camera.quaternion);
    this.camera = next;
    this.controls.object = next;
    this.applyCameraSize();
    this.controls.update();
    this.invalidate();
  }

  clearSelection(): void {
    this.setSelection([]);
  }

  /** Duplikat di tempat; salinan menjadi seleksi. symmetric = cerminkan pada bidang X=0 (goresan mirror dilewati). */
  duplicateSelection(symmetric: boolean): void {
    const identity = new THREE.Matrix4();
    const copies: StrokeData[] = [];
    for (const s of this.selectedStrokes()) {
      if (symmetric) {
        if (!s.mirror) copies.push(this.copyStroke(s, this.nextId++, identity, 1, true, false));
      } else {
        copies.push(this.copyStroke(s, this.nextId++, identity, 1, false, s.mirror));
      }
    }
    if (copies.length === 0) return;
    this.history.execute(new ReplaceStrokesCommand(this.layer, [], copies));
    this.setSelection(copies.map((s) => s.id));
  }

  deleteSelection(): void {
    const before = this.selectedStrokes();
    if (before.length === 0) return;
    this.history.execute(new ReplaceStrokesCommand(this.layer, before, []));
  }

  /** Terapkan kuas saat ini (warna, ukuran, opacity, tekanan) ke goresan terpilih. */
  applyBrushToSelection(): void {
    const before = this.selectedStrokes();
    if (before.length === 0) return;
    const after = before.map((s) => ({
      ...s,
      color: this.brush.color,
      radius: this.brush.radius / 1000,
      opacity: this.brush.opacity / 100,
      pressureResponse: this.brush.pressure / 100,
    }));
    this.history.execute(new ReplaceStrokesCommand(this.layer, before, after));
    this.setSelection(after.map((s) => s.id));
  }

  refreshLayers(): void {
    this.onLayers?.({ layers: this.layers.all(), active: this.activeLayer });
  }

  setActiveLayer(id: number): void {
    if (!this.layers.has(id) || id === this.activeLayer) return;
    this.activeLayer = id;
    this.refreshLayers();
  }

  addLayer(): void {
    const data = this.layers.create();
    this.history.execute(new AddLayerCommand(this.layers, data, this.layers.count));
    this.setActiveLayer(data.id);
  }

  deleteLayer(id: number): void {
    if (this.layers.count <= 1) {
      this.onNotice?.('Cannot delete the last layer');
      return;
    }
    const data = this.layers.get(id);
    if (!data) return;
    const removed = this.layer.all().filter((s) => s.layer === id);
    this.history.execute(
      new DeleteLayerCommand(this.layers, this.layer, { ...data }, this.layers.indexOf(id), removed),
    );
  }

  renameLayer(id: number, name: string): void {
    const clean = name.trim().slice(0, 40);
    if (clean) this.layers.update(id, { name: clean });
  }

  setLayerVisible(id: number, visible: boolean): void {
    this.layers.update(id, { visible });
  }

  setLayerLocked(id: number, locked: boolean): void {
    this.layers.update(id, { locked });
  }

  moveLayer(id: number, delta: number): void {
    this.layers.move(id, delta);
  }

  /** Pindahkan goresan terpilih ke layer tertentu (satu langkah undo). */
  moveSelectionToLayer(id: number): void {
    const target = this.layers.get(id);
    if (!target) return;
    if (!target.visible || target.locked) {
      this.onNotice?.('Layer is hidden or locked');
      return;
    }
    const before = this.selectedStrokes().filter((s) => s.layer !== id);
    if (before.length === 0) return;
    const after = before.map((s) => ({ ...s, layer: id }));
    this.history.execute(new ReplaceStrokesCommand(this.layer, before, after));
    this.setSelection(after.map((s) => s.id));
  }

  undo(): void {
    this.history.undo();
  }

  redo(): void {
    this.history.redo();
  }

  clearStrokes(): void {
    this.layer.clear();
    this.guides.clearPlanes();
    this.history.clear();
    this.invalidate();
  }

  resetView(): void {
    this.camera.position.set(4.8, 3.8, 6.8);
    this.controls.target.set(0, 0, 0);
    this.orthoCamera.zoom = 1;
    this.orthoCamera.updateProjectionMatrix();
    this.controls.update();
    this.invalidate();
  }

  exportPNG(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  serialize(): ProjectFile {
    return {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      guide: this.guides.type,
      planes: this.guides.allPlanes(),
      layers: this.layers.all(),
      strokes: this.layer.all(),
    };
  }

  /**
   * Memuat proyek. Mengembalikan guide dari berkas agar UI bisa menyamakan statusnya
   * (engine tidak mengubah guide sendiri, supaya store UI tetap satu-satunya sumber kebenaran).
   */
  loadProject(raw: unknown): { guide: GuideType; count: number } {
    const parsed = parseProject(raw);
    this.layer.clear();
    this.guides.clearPlanes();
    this.layers.reset(parsed.layers);
    for (const plane of parsed.planes ?? []) {
      this.guides.addPlane({ ...plane, id: this.nextPlaneId++ });
    }
    for (const stroke of parsed.strokes) {
      const layer = this.layers.has(stroke.layer) ? stroke.layer : this.layers.firstId;
      this.layer.add({ ...stroke, layer, id: this.nextId++ });
    }
    this.history.clear();
    this.invalidate();
    return { guide: parsed.guide, count: parsed.strokes.length };
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.stage.removeEventListener('pointerdown', this.onPointerDownCapture, true);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerEnd);
    this.canvas.removeEventListener('pointercancel', this.onPointerEnd);
    this.controls.dispose();
    this.layer.clear();
    this.guides.dispose();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.selectionBox.geometry.dispose();
    (this.selectionBox.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.onChange = undefined;
    this.onInput = undefined;
    this.onLasso = undefined;
    this.onBrushPicked = undefined;
    this.onLayers = undefined;
    this.onNotice = undefined;
  }

  // ------------------------------------------------------------------- input

  /** Apa yang dilakukan sebuah pointer: menavigasi kamera, menggambar, atau menghapus. */
  private modeFor(e: PointerEvent): 'navigate' | 'draw' | 'erase' | 'select' | 'transform' | 'pick' {
    // Tombol penghapus fisik pada pena selalu menghapus, apa pun tool-nya.
    if (e.pointerType === 'pen' && (e.buttons & 32) !== 0) return 'erase';
    const tool = this.tool;
    if (tool === 'orbit') return 'navigate';
    // Tombol kanan/tengah mouse selalu untuk navigasi (pan/zoom), apa pun tool-nya.
    if (e.pointerType === 'mouse' && e.button !== 0) return 'navigate';
    if (e.pointerType === 'touch') {
      const fingerFollowsTool =
        this.touchMode === 'draw' || (this.touchMode === 'auto' && !this.penSeen);
      if (!fingerFollowsTool) return 'navigate';
    }
    if (tool === 'select') {
      return this.transformMode !== null && this.layer.selectionCount > 0 ? 'transform' : 'select';
    }
    return tool;
  }

  private readonly onPointerDownCapture = (e: PointerEvent): void => {
    if (e.pointerType === 'pen') this.penSeen = true;
    this.reportInput(e, true);
    // Saat goresan sedang dibuat, semua pointer lain (mis. telapak tangan) tidak boleh menggerakkan kamera.
    this.controls.enabled = !this.busy && this.modeFor(e) === 'navigate';
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.busy) return;
    const mode = this.modeFor(e);
    if (mode === 'navigate') return;
    if (mode === 'erase') {
      this.beginErase(e);
      return;
    }
    if (mode === 'select') {
      this.beginSelect(e);
      return;
    }
    if (mode === 'pick') {
      this.pickBrushAt(e);
      return;
    }
    if (mode === 'transform') {
      this.beginTransform(e);
      return;
    }

    const active = this.layers.get(this.activeLayer);
    if (!active || !active.visible || active.locked) {
      this.onNotice?.(active?.locked ? 'Layer is locked' : 'Layer is hidden');
      return;
    }
    const start = this.hit(e.clientX, e.clientY, null);
    if (!start) return;
    this.draftSurface = start.surface;
    this.draftNormal.copy(start.normal);
    this.smoothX = e.clientX;
    this.smoothY = e.clientY;

    this.drawing = true;
    this.activePointerId = e.pointerId;
    this.controls.enabled = false;
    this.canvas.setPointerCapture(e.pointerId);

    this.draftStyle = {
      color: this.brush.color,
      radius: this.brush.radius / 1000,
      pressureResponse: this.brush.pressure / 100,
      opacity: this.brush.opacity / 100,
      mirror: this.mirror,
      layer: this.activeLayer,
    };
    this.draftPoints = [toTuple(start.point)];
    this.draftPressures = [this.pressureOf(e)];
    this.draftStartTime = e.timeStamp;
    this.draftTimes = [0];
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.reportInput(e, false);
    if (this.erasing && e.pointerId === this.erasePointerId) {
      const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const sample of coalesced.length > 0 ? coalesced : [e]) this.eraseSample(sample);
      return;
    }
    if (this.selecting && e.pointerId === this.selectPointerId) {
      this.selectMove(e);
      return;
    }
    if (this.transforming && e.pointerId === this.transformPointerId) {
      this.transformMove(e);
      return;
    }
    if (!this.drawing || e.pointerId !== this.activePointerId || !this.draftStyle) return;

    // Chrome menggabungkan beberapa sampel stylus ke satu event; ambil semuanya agar garis dan
    // kurva tekanan lebih halus.
    const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const samples = coalesced.length > 0 ? coalesced : [e];

    let added = false;
    for (const sample of samples) {
      if (this.addSample(sample)) added = true;
    }
    if (!added) return;
    this.previewDirty = true;
  };

  private addSample(e: PointerEvent): boolean {
    // Stable Stroke: haluskan posisi pointer di layar, lalu tembak ray dari posisi itu.
    const k = (this.brush.stabilize / 100) * STABILIZE_MAX;
    this.smoothX += (e.clientX - this.smoothX) * (1 - k);
    this.smoothY += (e.clientY - this.smoothY) * (1 - k);
    const hit = this.hit(this.smoothX, this.smoothY, this.draftSurface);
    if (!hit) return false;
    const point = hit.point;

    const last = this.draftPoints[this.draftPoints.length - 1];
    const distance = Math.hypot(point.x - last[0], point.y - last[1], point.z - last[2]);
    if (distance < MIN_POINT_DISTANCE) return false;

    this.draftPoints.push(toTuple(point));
    this.draftPressures.push(this.pressureOf(e));
    this.draftTimes.push(e.timeStamp - this.draftStartTime);
    return true;
  }

  /** Mengirim ringkasan input ke indikator debug (hanya saat diaktifkan). */
  private reportInput(e: PointerEvent, force: boolean): void {
    if (!this.inputDebug || !this.onInput) return;

    const inContact = e.pressure > 0 && e.type !== 'pointerup' && e.type !== 'pointercancel';
    if (inContact) {
      if (!this.contactActive) {
        this.contactActive = true;
        this.contactMin = e.pressure;
        this.contactMax = e.pressure;
      } else {
        this.contactMin = Math.min(this.contactMin, e.pressure);
        this.contactMax = Math.max(this.contactMax, e.pressure);
      }
    } else {
      force = force || this.contactActive;
      this.contactActive = false;
    }

    const now = performance.now();
    if (!force && now - this.lastInputEmit < 66) return;
    this.lastInputEmit = now;
    this.onInput({
      pointerType: e.pointerType,
      pressure: e.pressure,
      min: this.contactMin,
      max: this.contactMax,
      inContact,
    });
  }

  private readonly onPointerEnd = (e: PointerEvent): void => {
    this.reportInput(e, true);
    if (this.erasing && e.pointerId === this.erasePointerId) {
      this.endErase(e);
      return;
    }
    if (this.selecting && e.pointerId === this.selectPointerId) {
      this.endSelect(e);
      return;
    }
    if (this.transforming && e.pointerId === this.transformPointerId) {
      this.endTransform(e);
      return;
    }
    if (!this.drawing || e.pointerId !== this.activePointerId) return;

    this.drawing = false;
    // Diam: kontrol aktif lagi (agar zoom roda mouse tetap jalan); keputusan per-pointer ada di onPointerDownCapture.
    this.controls.enabled = true;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture sudah dilepas oleh browser
    }
    this.previewDirty = false;
    this.layer.clearPreview();
    this.invalidate();
    if (this.draftStyle && this.draftPoints.length > 1) {
      const stroke: StrokeData = {
        ...this.draftStyle,
        id: this.nextId++,
        points: this.draftPoints,
        pressures: this.draftPressures,
        times: this.draftTimes,
      };
      const addStroke = new AddStrokeCommand(this.layer, stroke);
      if (this.guideDraw) {
        this.guideDraw = false;
        const plane = this.planeFromStroke(stroke.points);
        if (plane) {
          this.history.execute(new AddGuideCommand(this.guides, plane));
        } else {
          this.history.execute(addStroke);
        }
        this.onGuideDrawEnd?.(plane !== null);
      } else {
        this.history.execute(addStroke);
      }
    }

    this.draftPoints = [];
    this.draftPressures = [];
    this.draftTimes = [];
    this.draftStyle = null;
    this.draftSurface = null;
  };

  private beginErase(e: PointerEvent): void {
    this.erasing = true;
    this.erasePointerId = e.pointerId;
    this.eraseRemoved = [];
    this.eraseDragged = false;
    this.eraseStartX = e.clientX;
    this.eraseStartY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
    // Tap di bidang kosong (tanpa goresan kena, tanpa geser) menghapus bidang guide.
    this.erasePlane = this.eraseStrokeAt(e) ? null : this.guides.pick(this.raycaster);
  }

  /** Hapus goresan teratas di bawah pointer langsung dari layer. True bila ada yang terhapus. */
  private eraseStrokeAt(e: PointerEvent): boolean {
    this.setRay(e);
    const id = this.layer.pick(this.raycaster);
    if (id === null) return false;
    const stroke = this.layer.get(id);
    if (!stroke) return false;
    this.eraseRemoved.push(stroke);
    this.layer.remove(id);
    this.invalidate();
    return true;
  }

  private eraseSample(e: PointerEvent): void {
    if (!this.eraseDragged) {
      const moved = Math.hypot(e.clientX - this.eraseStartX, e.clientY - this.eraseStartY);
      if (moved > 6) this.eraseDragged = true;
    }
    this.eraseStrokeAt(e);
  }

  /** Satu gestur hapus = satu langkah undo. Penghapusan sudah terjadi; execute() aman karena remove idempoten. */
  private endErase(e: PointerEvent): void {
    this.erasing = false;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture sudah dilepas oleh browser
    }
    const commands: Command[] = this.eraseRemoved.map((s) => new RemoveStrokeCommand(this.layer, s));
    if (commands.length === 0 && !this.eraseDragged && this.erasePlane !== null) {
      const plane = this.guides.getPlane(this.erasePlane);
      if (plane) commands.push(new RemoveGuideCommand(this.guides, plane));
    }
    if (commands.length > 0) this.history.execute(new BatchCommand(commands));
    this.eraseRemoved = [];
    this.erasePlane = null;
  }

  // ----------------------------------------------------------- select / transform

  private canvasPoint(e: PointerEvent): PxPoint {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Titik goresan dalam piksel kanvas (titik di belakang kamera dilewati; sisi cermin ikut dihitung). */
  private strokePx(stroke: StrokeData): PxPoint[] {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const v = new THREE.Vector3();
    const out: PxPoint[] = [];
    for (const flip of stroke.mirror ? [false, true] : [false]) {
      for (const [x, y, z] of stroke.points) {
        v.set(flip ? -x : x, y, z).project(this.camera);
        if (v.z > 1) continue;
        out.push({ x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h });
      }
    }
    return out;
  }

  private selectedStrokes(): StrokeData[] {
    return this.layer
      .selection.map((id) => this.layer.get(id))
      .filter((s): s is StrokeData => s !== undefined);
  }

  private setSelection(ids: Iterable<number>): void {
    this.layer.setSelection(ids);
    this.emit();
  }

  private updateSelectionBox(): void {
    const box = this.layer.selectionBounds();
    if (box.isEmpty()) {
      this.selectionBox.visible = false;
      return;
    }
    this.selectionBox.box.copy(box);
    this.selectionBox.visible = true;
  }

  private beginSelect(e: PointerEvent): void {
    this.selecting = true;
    this.selectPointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    this.lasso = [this.canvasPoint(e)];
    this.lassoLength = 0;
  }

  private selectMove(e: PointerEvent): void {
    const p = this.canvasPoint(e);
    const last = this.lasso[this.lasso.length - 1];
    const d = Math.hypot(p.x - last.x, p.y - last.y);
    if (d < 3) return;
    this.lassoLength += d;
    this.lasso.push(p);
    if (this.lassoLength >= TAP_SLOP) this.onLasso?.(this.lasso);
  }

  private endSelect(e: PointerEvent): void {
    this.selecting = false;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture sudah dilepas oleh browser
    }
    this.onLasso?.(null);
    const path = this.lasso;
    this.lasso = [];
    if (this.lassoLength < TAP_SLOP) {
      this.tapSelect(path[0]);
    } else if (path.length >= 3) {
      this.lassoSelect(path);
    }
  }

  /** Id goresan terdekat dari titik (dalam radius ketuk), atau null. */
  private nearestStroke(p: PxPoint): number | null {
    let best: number | null = null;
    let bestDist = TAP_PICK_RADIUS;
    for (const s of this.layer.interactive()) {
      for (const q of this.strokePx(s)) {
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bestDist) {
          bestDist = d;
          best = s.id;
        }
      }
    }
    return best;
  }

  /** Ketuk: toggle goresan terdekat; ketuk kosong: bersihkan seleksi. */
  private tapSelect(p: PxPoint): void {
    const best = this.nearestStroke(p);
    if (best === null) {
      this.setSelection([]);
      return;
    }
    const ids = new Set(this.layer.selection);
    if (ids.has(best)) ids.delete(best);
    else ids.add(best);
    this.setSelection(ids);
  }

  /** Eyedropper/Injector: ambil warna, ukuran, opacity, dan tekanan dari goresan terdekat. */
  private pickBrushAt(e: PointerEvent): void {
    const id = this.nearestStroke(this.canvasPoint(e));
    if (id === null) return;
    const s = this.layer.get(id);
    if (!s) return;
    this.onBrushPicked?.({
      color: s.color,
      radius: THREE.MathUtils.clamp(Math.round(s.radius * 1000), 5, 100),
      opacity: THREE.MathUtils.clamp(Math.round(s.opacity * 100), 10, 100),
      pressure: THREE.MathUtils.clamp(Math.round(s.pressureResponse * 100), 0, 100),
    });
  }

  /** Lasso: tambahkan goresan yang punya minimal satu titik di dalam poligon. */
  private lassoSelect(poly: PxPoint[]): void {
    const ids = new Set(this.layer.selection);
    for (const s of this.layer.interactive()) {
      if (this.strokePx(s).some((q) => inPolygon(q, poly))) ids.add(s.id);
    }
    this.setSelection(ids);
  }

  /** Ukuran satu piksel layar dalam satuan dunia pada kedalaman titik tertentu. */
  private worldPerPixel(at: THREE.Vector3): number {
    const height = Math.max(1, this.canvas.clientHeight);
    if (this.camera instanceof THREE.OrthographicCamera) {
      return (this.camera.top - this.camera.bottom) / this.camera.zoom / height;
    }
    const dist = this.camera.position.distanceTo(at);
    return (2 * dist * Math.tan(THREE.MathUtils.degToRad(this.perspCamera.fov / 2))) / height;
  }

  private beginTransform(e: PointerEvent): void {
    const box = this.layer.selectionBounds();
    if (box.isEmpty() || this.transformMode === null) return;
    this.transforming = true;
    this.transformPointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    box.getCenter(this.transformPivot);
    this.transformStartX = e.clientX;
    this.transformStartY = e.clientY;
    this.transformMatrix.identity();
    this.transformScale = 1;
    this.transformMoved = false;
    this.camera.updateMatrixWorld();
  }

  private transformMove(e: PointerEvent): void {
    const dx = e.clientX - this.transformStartX;
    const dy = e.clientY - this.transformStartY;
    if (!this.transformMoved && Math.hypot(dx, dy) < 3) return;
    this.transformMoved = true;

    const p = this.transformPivot;
    const m = this.transformMatrix.identity();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
    let scale = 1;

    if (this.transformMode === 'move') {
      const k = this.worldPerPixel(p);
      const t = right.multiplyScalar(dx * k).addScaledVector(up, -dy * k);
      m.makeTranslation(t.x, t.y, t.z);
    } else if (this.transformMode === 'rotate') {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * ROTATE_SPEED);
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(right, dy * ROTATE_SPEED));
      m.makeTranslation(p.x, p.y, p.z)
        .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
        .multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
    } else if (this.transformMode === 'scale') {
      scale = THREE.MathUtils.clamp(Math.exp(-dy * SCALE_SPEED), 0.05, 20);
      m.makeTranslation(p.x, p.y, p.z)
        .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
        .multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
    }
    this.transformScale = scale;

    this.layer.setPreviewMatrix(this.layer.selection, m);
    this.updateSelectionBox();
    this.invalidate();
  }

  private endTransform(e: PointerEvent): void {
    this.transforming = false;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture sudah dilepas oleh browser
    }
    this.layer.setPreviewMatrix(this.layer.selection, null);
    if (this.transformMoved) this.commitTransform();
    this.updateSelectionBox();
    this.invalidate();
  }

  /** Menanamkan transformMatrix ke data goresan terpilih sebagai satu langkah undo. */
  private commitTransform(): void {
    const before = this.selectedStrokes();
    const after: StrokeData[] = [];
    for (const s of before) {
      after.push(this.copyStroke(s, s.id, this.transformMatrix, this.transformScale, false, false));
      // Goresan mirror: sisi cerminnya dijadikan goresan sendiri agar ikut bertransformasi.
      if (s.mirror) {
        after.push(this.copyStroke(s, this.nextId++, this.transformMatrix, this.transformScale, true, false));
      }
    }
    if (after.length === 0) return;
    this.history.execute(new ReplaceStrokesCommand(this.layer, before, after));
    this.setSelection(after.map((s) => s.id));
  }

  /** Salinan goresan dengan titik ditransformasi (flip = cerminkan X dulu) dan radius diskalakan. */
  private copyStroke(
    s: StrokeData,
    id: number,
    m: THREE.Matrix4,
    scale: number,
    flip: boolean,
    mirror: boolean,
  ): StrokeData {
    const v = new THREE.Vector3();
    const points = s.points.map(([x, y, z]) => toTuple(v.set(flip ? -x : x, y, z).applyMatrix4(m)));
    return { ...s, id, points, radius: s.radius * scale, mirror };
  }

  private setRay(e: PointerEvent): void {
    this.setRayAt(e.clientX, e.clientY);
  }

  private setRayAt(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  /** Titik tembak untuk pointer. lock = permukaan yang dikunci (null = bebas memilih). */
  private hit(clientX: number, clientY: number, lock: number | null): SurfaceHit | null {
    this.setRayAt(clientX, clientY);
    if (lock !== DEFAULT_SURFACE && this.guides.active) {
      const guide = this.guides.intersect(this.raycaster, lock);
      if (guide) return guide;
      // Meleset: jika terkunci atau ada bola/kubus dasar, abaikan sampel (jangan lompat ke bidang XY).
      if (lock !== null || this.guides.hasBase) return null;
    }
    const point = this.raycaster.ray.intersectPlane(this.drawPlane, new THREE.Vector3());
    if (!point) return null;
    return { point, normal: this.drawPlane.normal.clone(), surface: DEFAULT_SURFACE };
  }

  private pressureOf(e: PointerEvent): number {
    return e.pressure > 0 ? e.pressure : 0.5;
  }

  /** Bidang tegak lurus permukaan gambar yang memuat garis awal->akhir goresan. Null bila tak valid. */
  private planeFromStroke(points: Vec3Tuple[]): GuidePlaneData | null {
    const a = new THREE.Vector3(...points[0]);
    const b = new THREE.Vector3(...points[points.length - 1]);
    const chord = b.clone().sub(a);
    if (chord.length() < MIN_GUIDE_LENGTH) return null;
    const normal = chord.normalize().cross(this.draftNormal);
    // Garis hampir sejajar normal permukaan: bidang tak terdefinisi.
    if (normal.length() < 0.2) return null;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    return { id: this.nextPlaneId++, origin: toTuple(mid), normal: toTuple(normal.normalize()) };
  }

  // ---------------------------------------------------------------- internals
  private applyCameraSize(): void {
    const { width, height } = this.stageSize();
    const aspect = width / height;
    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();
    const h = this.orthoHalfHeight;
    this.orthoCamera.left = -h * aspect;
    this.orthoCamera.right = h * aspect;
    this.orthoCamera.top = h;
    this.orthoCamera.bottom = -h;
    this.orthoCamera.updateProjectionMatrix();
  }

  private invalidate(): void {
    this.needsRender = true;
  }

  private stageSize(): { width: number; height: number } {
    return {
      width: Math.max(1, this.stage.clientWidth),
      height: Math.max(1, this.stage.clientHeight),
    };
  }

  private resize(): void {
    const { width, height } = this.stageSize();
    this.renderer.setSize(width, height, false);
    this.applyCameraSize();
    this.invalidate();
  }

  /** Menerapkan status layer ke goresan, memastikan layer aktif valid, lalu memberi tahu UI. */
  private syncLayers(): void {
    const all = this.layers.all();
    if (!this.layers.has(this.activeLayer)) this.activeLayer = all[0].id;
    this.layer.setLayerFlags(
      all.filter((l) => !l.visible).map((l) => l.id),
      all.filter((l) => l.locked).map((l) => l.id),
    );
    this.invalidate();
    this.emit();
    this.refreshLayers();
  }

  private emit(): void {
    this.invalidate();
    this.updateSelectionBox();
    this.onChange?.({
      strokeCount: this.layer.count,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      selectionCount: this.layer.selectionCount,
    });
  }

  private readonly loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    const moved = this.controls.update(); // true saat kamera bergerak (termasuk damping)
    if (this.previewDirty && this.draftStyle) {
      this.previewDirty = false;
      this.layer.setPreview({
        ...this.draftStyle,
        points: this.draftPoints,
        pressures: this.draftPressures,
        times: this.draftTimes,
      });
      this.needsRender = true;
    }
    if (moved || this.needsRender) {
      this.needsRender = false;
      this.renderer.render(this.scene, this.camera);
    }
  };
}
