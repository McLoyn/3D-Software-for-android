import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AddStrokeCommand, RemoveStrokeCommand } from './commands';
import { Guides } from './Guides';
import { History } from './History';
import { parseProject } from './project';
import { StrokeLayer } from './StrokeLayer';
import {
  DEFAULT_BRUSH,
  PROJECT_FORMAT,
  PROJECT_VERSION,
  type BrushSettings,
  type GuideType,
  type HistoryInfo,
  type InputInfo,
  type ProjectFile,
  type StrokeData,
  type ToolId,
  type TouchMode,
  type Vec3Tuple,
} from './types';

const MIN_POINT_DISTANCE = 0.018;

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

  private readonly canvas: HTMLCanvasElement;
  private readonly stage: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly grid: THREE.GridHelper;
  private readonly guides = new Guides();
  private readonly layer = new StrokeLayer();
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

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
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

    this.history.onChange = () => this.emit();

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

  // ----------------------------------------------------------------- actions

  undo(): void {
    this.history.undo();
  }

  redo(): void {
    this.history.redo();
  }

  clearStrokes(): void {
    this.layer.clear();
    this.history.clear();
  }

  resetView(): void {
    this.camera.position.set(4.8, 3.8, 6.8);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
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
    for (const stroke of parsed.strokes) {
      this.layer.add({ ...stroke, id: this.nextId++ });
    }
    this.history.clear();
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
    this.renderer.dispose();
    this.onChange = undefined;
    this.onInput = undefined;
  }

  // ------------------------------------------------------------------- input

  /** Apa yang dilakukan sebuah pointer: menavigasi kamera, menggambar, atau menghapus. */
  private modeFor(e: PointerEvent): 'navigate' | 'draw' | 'erase' {
    const tool = this.tool;
    if (tool === 'orbit') return 'navigate';
    // Tombol kanan/tengah mouse selalu untuk navigasi (pan/zoom), apa pun tool-nya.
    if (e.pointerType === 'mouse' && e.button !== 0) return 'navigate';
    if (e.pointerType === 'touch') {
      const fingerFollowsTool =
        this.touchMode === 'draw' || (this.touchMode === 'auto' && !this.penSeen);
      if (!fingerFollowsTool) return 'navigate';
    }
    return tool;
  }

  private readonly onPointerDownCapture = (e: PointerEvent): void => {
    if (e.pointerType === 'pen') this.penSeen = true;
    this.reportInput(e, true);
    // Saat goresan sedang dibuat, semua pointer lain (mis. telapak tangan) tidak boleh menggerakkan kamera.
    this.controls.enabled = !this.drawing && this.modeFor(e) === 'navigate';
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.drawing) return;
    const mode = this.modeFor(e);
    if (mode === 'navigate') return;
    if (mode === 'erase') {
      this.eraseAt(e);
      return;
    }

    const start = this.hitPoint(e);
    if (!start) return;

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
    };
    this.draftPoints = [toTuple(start)];
    this.draftPressures = [this.pressureOf(e)];
    this.draftStartTime = e.timeStamp;
    this.draftTimes = [0];
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.reportInput(e, false);
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

    if (!added) return;
    this.previewDirty = true;

  private addSample(e: PointerEvent): boolean {
    const point = this.hitPoint(e);
    if (!point) return false;

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
    if (this.draftStyle && this.draftPoints.length > 1) {
      const stroke: StrokeData = {
        ...this.draftStyle,
        id: this.nextId++,
        points: this.draftPoints,
        pressures: this.draftPressures,
        times: this.draftTimes,
      };
      this.history.execute(new AddStrokeCommand(this.layer, stroke));
    }

    this.draftPoints = [];
    this.draftPressures = [];
    this.draftTimes = [];
    this.draftStyle = null;
  };

  private eraseAt(e: PointerEvent): void {
    this.setRay(e);
    const id = this.layer.pick(this.raycaster);
    if (id === null) return;
    const stroke = this.layer.get(id);
    if (stroke) this.history.execute(new RemoveStrokeCommand(this.layer, stroke));
  }

  private setRay(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private hitPoint(e: PointerEvent): THREE.Vector3 | null {
    this.setRay(e);
    // Guide aktif: hanya permukaan guide. Meleset = abaikan sampel, jangan lompat ke bidang XY.
    if (this.guides.active) return this.guides.intersect(this.raycaster)?.point ?? null;
    return this.raycaster.ray.intersectPlane(this.drawPlane, new THREE.Vector3());
  }

  private pressureOf(e: PointerEvent): number {
    return e.pressure > 0 ? e.pressure : 0.5;
  }

  

  // ---------------------------------------------------------------- internals
  
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
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private emit(): void {
    this.onChange?.({
      strokeCount: this.layer.count,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
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