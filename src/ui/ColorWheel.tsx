import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

interface Hsv {
  h: number;
  s: number;
  v: number;
}

const SIZE = 200;
const C = SIZE / 2;
const RING_OUT = 96;
const RING_IN = 76;
/** Setengah sisi persegi saturasi/kecerahan di tengah cincin. */
const HALF = 50;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number): number => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const to = (x: number): string =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`;
}

export function hexToHsv(hex: string, fallbackHue = 0): Hsv {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { h: fallbackHue, s: 0, v: 0 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = fallbackHue;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

interface Props {
  value: string;
  onChange: (hex: string) => void;
  /** Dipanggil saat pemilihan warna selesai (untuk riwayat warna). */
  onCommit: (hex: string) => void;
}

/** Color wheel HSV: cincin hue, persegi saturasi/kecerahan, dan kolom HEX. */
export function ColorWheel({ value, onChange, onCommit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<'ring' | 'box' | null>(null);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [text, setText] = useState(value);

  // Sinkronkan dari luar (mis. Eyedropper) tanpa menghilangkan hue saat warna abu-abu.
  useEffect(() => {
    setHsv((prev) => (hsvToHex(prev) === value.toLowerCase() ? prev : hexToHsv(value, prev.h)));
    setText(value);
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const ring = ctx.createConicGradient(0, C, C);
    ['#f00', '#ff0', '#0f0', '#0ff', '#00f', '#f0f', '#f00'].forEach((color, i) =>
      ring.addColorStop(i / 6, color),
    );
    ctx.lineWidth = RING_OUT - RING_IN;
    ctx.strokeStyle = ring;
    ctx.beginPath();
    ctx.arc(C, C, (RING_OUT + RING_IN) / 2, 0, Math.PI * 2);
    ctx.stroke();

    const x0 = C - HALF;
    const y0 = C - HALF;
    const side = HALF * 2;
    ctx.fillStyle = `hsl(${hsv.h}, 100%, 50%)`;
    ctx.fillRect(x0, y0, side, side);
    const white = ctx.createLinearGradient(x0, 0, x0 + side, 0);
    white.addColorStop(0, '#fff');
    white.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = white;
    ctx.fillRect(x0, y0, side, side);
    const black = ctx.createLinearGradient(0, y0, 0, y0 + side);
    black.addColorStop(0, 'rgba(0,0,0,0)');
    black.addColorStop(1, '#000');
    ctx.fillStyle = black;
    ctx.fillRect(x0, y0, side, side);

    const mark = (x: number, y: number): void => {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.beginPath();
      ctx.arc(x, y, 7.5, 0, Math.PI * 2);
      ctx.stroke();
    };
    const a = (hsv.h * Math.PI) / 180;
    const rm = (RING_OUT + RING_IN) / 2;
    mark(C + Math.cos(a) * rm, C + Math.sin(a) * rm);
    mark(x0 + hsv.s * side, y0 + (1 - hsv.v) * side);
  }, [hsv]);

  const local = (e: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIZE,
      y: ((e.clientY - rect.top) / rect.height) * SIZE,
    };
  };

  const apply = (e: ReactPointerEvent<HTMLCanvasElement>, mode: 'ring' | 'box'): void => {
    const { x, y } = local(e);
    let next: Hsv;
    if (mode === 'ring') {
      let h = (Math.atan2(y - C, x - C) * 180) / Math.PI;
      if (h < 0) h += 360;
      next = { ...hsv, h };
    } else {
      next = {
        ...hsv,
        s: clamp01((x - (C - HALF)) / (HALF * 2)),
        v: 1 - clamp01((y - (C - HALF)) / (HALF * 2)),
      };
    }
    setHsv(next);
    onChange(hsvToHex(next));
  };

  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    const { x, y } = local(e);
    const dist = Math.hypot(x - C, y - C);
    if (dist >= RING_IN - 4 && dist <= RING_OUT + 6) drag.current = 'ring';
    else if (Math.abs(x - C) <= HALF + 6 && Math.abs(y - C) <= HALF + 6) drag.current = 'box';
    else return;
    e.currentTarget.setPointerCapture(e.pointerId);
    apply(e, drag.current);
  };

  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (drag.current) apply(e, drag.current);
  };

  const onUp = (): void => {
    if (!drag.current) return;
    drag.current = null;
    onCommit(hsvToHex(hsv));
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="wheel"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <input
        className="hex"
        value={text}
        maxLength={7}
        spellCheck={false}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (/^#[0-9a-f]{6}$/i.test(t)) {
            const hex = t.toLowerCase();
            setHsv(hexToHsv(hex, hsv.h));
            onChange(hex);
            onCommit(hex);
          }
        }}
      />
    </div>
  );
}
