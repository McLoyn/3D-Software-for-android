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
  type ProjectFile,
  type StrokeData,
  type ToolId,
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

  private drawing = false;
  private activePointerId = -1;
  private draftPoints: Vec3Tuple[] = [];
  private draftPressures: number[] = [];
  private draftStyle: StrokeStyle | null = null;
  private nextId = 1;
  private frame = 0;

  constructor(canvas: HTMLCanvasElement, stage: HTMLElement) {
    this.canvas = canvas;
    this.stage = stage;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color('#151822');

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

    this.grid = new THREE.GridHelper(12, 24, 0x555b75, 0x303545);
    this.scene.add(this.grid);
    this.scene.add(this.guides.root, this.layer.root);

    this.history.onChange = () => this.emit();

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
    if (!this.drawing) this.controls.enabled = tool === 'orbit';
  }

  setBrush(brush: BrushSettings): void {
    this.brush = { ...brush };
  }

  setMirror(mirror: boolean): void {
    this.mirror = mirror;
  }

  setGuide(type: GuideType): void {
    this.guides.setType(type);
  }

  setGridVisible(visible: boolean): void {
    this.grid.visible = visible;
  }

  setGuideVisible(visible: boolean): void {
    this.guides.setVisible(visible);
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
  }

  // ------------------------------------------------------------------- input

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.tool === 'orbit' || this.drawing) return;
    if (this.tool === 'erase') {
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
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.drawing || e.pointerId !== this.activePointerId || !this.draftStyle) return;

    const point = this.hitPoint(e);
    if (!point) return;

    const last = this.draftPoints[this.draftPoints.length - 1];
    const distance = Math.hypot(point.x - last[0], point.y - last[1], point.z - last[2]);
    if (distance < MIN_POINT_DISTANCE) return;

    this.draftPoints.push(toTuple(point));
    this.draftPressures.push(this.pressureOf(e));
    this.layer.setPreview({
      ...this.draftStyle,
      points: this.draftPoints,
      pressures: this.draftPressures,
    });
  };

  private readonly onPointerEnd = (e: PointerEvent): void => {
    if (!this.drawing || e.pointerId !== this.activePointerId) return;

    this.drawing = false;
    this.controls.enabled = this.tool === 'orbit';
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture sudah dilepas oleh browser
    }

    this.layer.clearPreview();
    if (this.draftStyle && this.draftPoints.length > 1) {
      const stroke: StrokeData = {
        ...this.draftStyle,
        id: this.nextId++,
        points: this.draftPoints,
        pressures: this.draftPressures,
      };
      this.history.execute(new AddStrokeCommand(this.layer, stroke));
    }

    this.draftPoints = [];
    this.draftPressures = [];
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
    const onGuide = this.guides.intersect(this.raycaster);
    if (onGuide) return onGuide.point;
    return this.raycaster.ray.intersectPlane(this.drawPlane, new THREE.Vector3());
  }

  private pressureOf(e: PointerEvent): number {
    return e.pressure > 0 ? e.pressure : 0.5;
  }

  // ---------------------------------------------------------------- internals

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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
