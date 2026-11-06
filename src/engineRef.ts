import type { Engine } from './engine/Engine';

// Engine dibuat oleh CanvasStage. Komponen lain memanggilnya lewat getEngine()
// supaya instance Engine tidak masuk ke state React.
let current: Engine | null = null;

export function setEngine(engine: Engine | null): void {
  current = engine;
}

export function getEngine(): Engine | null {
  return current;
}
