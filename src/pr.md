# TASK: Implement Build 0.9 "Navigasi dan Eraser" in repo feather-android (React + TS + Vite + Three.js)

## RULES (read first)
- Apply ONLY the changes below. Do NOT refactor, rename, reformat, or touch anything not listed.
- Keep existing code comments (Indonesian) and style (2 spaces, single quotes, semicolons).
- Do the steps IN ORDER. After step 9 run `npm run typecheck` and fix only errors caused by these edits.
- "FIND/REPLACE" = exact text anchor. "ADD" = insert at the stated place.
- Do not add dependencies. `tsconfig` is strict with noUnusedLocals/noUnusedParameters: no unused imports or variables.
- Baseline is Build 0.8 (Draw 3D Guide already present).

## FEATURES (context)
A. FIX: in Draw 3D Guide mode, the line used to define the plane must NOT remain as a stroke. Only the plane is created
   (one undo step). If the line is invalid (too short/parallel), keep the old behavior: stroke saved, toast shown.
B. Quick camera views: Front / Side / Top buttons (keep current camera distance, look at orbit target).
C. Perspective/Orthographic toggle.
D. Eraser removes strokes while dragging (all strokes touched). One gesture = one undo step.
E. Eraser TAP on empty guide plane (no stroke hit, no drag) removes that guide plane (undoable).
F. Pen hardware eraser button (e.buttons & 32) erases regardless of active tool.

---

## STEP 1 — `src/engine/types.ts`
ADD (below `export type GuideType ...`):
```ts
export type ViewId = 'front' | 'side' | 'top';
```
FIND: `export const PROJECT_VERSION = '0.8';`
REPLACE: `export const PROJECT_VERSION = '0.9';`

## STEP 2 — `src/engine/Guides.ts`
ADD these two methods inside class `Guides`, right below `allPlanes()`:
```ts
  getPlane(id: number): GuidePlaneData | undefined {
    return this.planes.get(id)?.data;
  }

  /** Id bidang buatan pengguna terdepan yang tertembak ray, atau null (bola/kubus tidak dihitung). */
  pick(raycaster: THREE.Raycaster): number | null {
    if (!this.root.visible || this.planes.size === 0) return null;
    const meshes = [...this.planes.values()].map((p) => p.mesh);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? (hit.object.userData.surfaceId as number) : null;
  }
```

## STEP 3 — `src/engine/commands.ts`
APPEND at end of file:
```ts
export class RemoveGuideCommand implements Command {
  private readonly guides: Guides;
  private readonly plane: GuidePlaneData;

  constructor(guides: Guides, plane: GuidePlaneData) {
    this.guides = guides;
    this.plane = plane;
  }

  do(): void {
    this.guides.removePlane(this.plane.id);
  }

  undo(): void {
    this.guides.addPlane(this.plane);
  }
}
```

## STEP 4 — `src/engine/Engine.ts` (camera, ortho, views)
4a. Imports. FIND: `import { AddGuideCommand, AddStrokeCommand, BatchCommand, RemoveStrokeCommand } from './commands';`
REPLACE:
```ts
import {
  AddGuideCommand,
  AddStrokeCommand,
  BatchCommand,
  RemoveGuideCommand,
  RemoveStrokeCommand,
} from './commands';
```
FIND: `import { History } from './History';`
REPLACE: `import { History, type Command } from './History';`
In the './types' import list add `type ViewId,` (after `type Vec3Tuple,`).

4b. Camera fields. FIND: `private readonly camera: THREE.PerspectiveCamera;`
REPLACE:
```ts
  private readonly perspCamera: THREE.PerspectiveCamera;
  private readonly orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private ortho = false;
  /** Setengah tinggi tampilan ortografi (satuan dunia), diset saat beralih ke ortografi. */
  private orthoHalfHeight = 4;
```

4c. Constructor. FIND: `this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);`
REPLACE:
```ts
    this.perspCamera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera = this.perspCamera;
```

4d. ADD in the "actions" section (after `redo()`):
```ts
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
```

4e. ADD in "internals" section (above `resize()`):
```ts
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
```
REPLACE the body of `resize()` with:
```ts
    const { width, height } = this.stageSize();
    this.renderer.setSize(width, height, false);
    this.applyCameraSize();
    this.invalidate();
```
In `resetView()`, add before `this.controls.update();`:
```ts
    this.orthoCamera.zoom = 1;
    this.orthoCamera.updateProjectionMatrix();
```

## STEP 5 — `src/engine/Engine.ts` (FIX A: line vanishes in guide mode)
In `onPointerEnd`, FIND:
```ts
          this.history.execute(new BatchCommand([addStroke, new AddGuideCommand(this.guides, plane)]));
```
REPLACE (garis pembentuk guide tidak disimpan; hanya bidangnya):
```ts
          this.history.execute(new AddGuideCommand(this.guides, plane));
```
(Leave the `else { this.history.execute(addStroke); }` branch unchanged: invalid lines are still saved.)

## STEP 6 — `src/engine/Engine.ts` (eraser: drag, plane tap, pen button)
6a. Fields. ADD after `private draftNormal = new THREE.Vector3(0, 0, 1);`:
```ts
  private erasing = false;
  private erasePointerId = -1;
  private eraseRemoved: StrokeData[] = [];
  /** Bidang guide di bawah pointer saat eraser menyentuh (hanya dipakai bila tap kosong). */
  private erasePlane: number | null = null;
  private eraseDragged = false;
  private eraseStartX = 0;
  private eraseStartY = 0;
```

6b. `modeFor`: ADD as the FIRST statement after `const tool = this.tool;`:
```ts
    // Tombol penghapus fisik pada pena selalu menghapus, apa pun tool-nya.
    if (e.pointerType === 'pen' && (e.buttons & 32) !== 0) return 'erase';
```

6c. `onPointerDownCapture`: FIND `this.controls.enabled = !this.drawing && this.modeFor(e) === 'navigate';`
REPLACE `this.controls.enabled = !this.drawing && !this.erasing && this.modeFor(e) === 'navigate';`

6d. `onPointerDown`: FIND `if (this.drawing) return;`
REPLACE `if (this.drawing || this.erasing) return;`
FIND:
```ts
    if (mode === 'erase') {
      this.eraseAt(e);
      return;
    }
```
REPLACE:
```ts
    if (mode === 'erase') {
      this.beginErase(e);
      return;
    }
```

6e. `onPointerMove`: ADD right after `this.reportInput(e, false);`:
```ts
    if (this.erasing && e.pointerId === this.erasePointerId) {
      const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const sample of coalesced.length > 0 ? coalesced : [e]) this.eraseSample(sample);
      return;
    }
```

6f. `onPointerEnd`: ADD right after `this.reportInput(e, true);`:
```ts
    if (this.erasing && e.pointerId === this.erasePointerId) {
      this.endErase(e);
      return;
    }
```

6g. REPLACE the whole `eraseAt` method with these four methods:
```ts
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
```

## STEP 7 — `src/store.ts`
- In `interface UIState` add state `ortho: boolean;` (after `guideDraw: boolean;`) and action `toggleOrtho: () => void;` (after `setGuideDraw`).
- Initial values: add `ortho: false,` (after `guideDraw: false,`).
- Actions: add `toggleOrtho: () => set((s) => ({ ortho: !s.ortho })),` (after `setGuideDraw`).

## STEP 8 — UI
8a. `src/ui/CanvasStage.tsx`: in `apply`, add `engine.setOrtho(s.ortho);` after `engine.setGuideDraw(s.guideDraw);`.

8b. CREATE `src/ui/ViewBar.tsx`:
```tsx
import type { ViewId } from '../engine/types';
import { getEngine } from '../engineRef';
import { useUI } from '../store';

const VIEWS: { id: ViewId; label: string; title: string }[] = [
  { id: 'front', label: 'F', title: 'Front view' },
  { id: 'side', label: 'S', title: 'Side view' },
  { id: 'top', label: 'T', title: 'Top view' },
];

/** Panel kecil kanan bawah: tampak cepat dan toggle perspektif/ortografi. */
export function ViewBar() {
  const ortho = useUI((s) => s.ortho);
  const toggleOrtho = useUI((s) => s.toggleOrtho);

  return (
    <div className="pill bottom-right">
      {VIEWS.map((v) => (
        <button key={v.id} title={v.title} onClick={() => getEngine()?.setView(v.id)}>
          {v.label}
        </button>
      ))}
      <div className="vdivider" />
      <button className={ortho ? 'active' : ''} title="Orthographic" onClick={toggleOrtho}>
        Ortho
      </button>
    </div>
  );
}
```
8c. `src/App.tsx`: add `import { ViewBar } from './ui/ViewBar';` (keep imports alphabetical: after `Toolbar`) and render `<ViewBar />` right after `<GuideBar />`.

8d. `src/styles.css`: ADD right after the `.top-right{...}` rule:
```css
.bottom-right{bottom:12px;right:12px}
```

## STEP 9 — Version strings (Build 0.9)
- `package.json`: `"version": "0.9.0"`
- `index.html`: `<title>Feather Android · Build 0.9</title>`
- `src/ui/Header.tsx`: `Android · 0.9` and `feather-android-build-09.png`
- `src/ui/BrushPanel.tsx`: `Build 0.9 · Tablet-first prototype`

Then run `npm run typecheck`.

---

## ACCEPTANCE TESTS (manual, on tablet)
1. Tap ⟂, draw a line: a plane appears and the drawn line is GONE (no stroke left). Undo removes the plane; Redo brings it back.
2. In guide mode draw a very short line: toast shown, the stroke IS kept, mode turns off.
3. F / S / T buttons jump to front / side / top view at the same distance. Top view does not flip or glitch.
4. Ortho toggles without a visible size jump; pinch zoom and orbit still work in both modes; toggle back keeps framing.
5. Eraser drag across several strokes removes all touched strokes live. One Undo restores ALL of them.
6. Eraser tap on an empty area of a guide plane removes the plane. Undo restores it. Tapping on a stroke removes only the stroke.
7. Eraser drag that starts on an empty plane does NOT remove the plane.
8. Pen eraser button (if the pen has one) erases while the Brush tool is active.
9. Save, Clear strokes, Open: still works; old 0.6/0.7/0.8 files load.

## NOT IN SCOPE
Double-tap quick view, per-point eraser, Bend, Loft, fill/shadows, plane resizing/moving.
