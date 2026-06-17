// Generates synthetic manga-style pages on a <canvas>. This keeps the demo
// copyright-free while giving the detector real white gutters to find.
// Users can also upload their own pages in the UI.

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
  busy?: boolean; // draw a denser "action" scene
}

const PAGE_W = 1000;
const PAGE_H = 1450;
const GUTTER = 26;

// A few hand-authored layouts (fractions of the page), classic manga grids.
const LAYOUTS: Cell[][] = [
  [
    { x: 0, y: 0, w: 1, h: 0.34 },
    { x: 0, y: 0.34, w: 0.5, h: 0.3 },
    { x: 0.5, y: 0.34, w: 0.5, h: 0.3, busy: true },
    { x: 0, y: 0.64, w: 1, h: 0.36 },
  ],
  [
    { x: 0, y: 0, w: 0.6, h: 0.45 },
    { x: 0.6, y: 0, w: 0.4, h: 0.45 },
    { x: 0, y: 0.45, w: 0.4, h: 0.25 },
    { x: 0.4, y: 0.45, w: 0.6, h: 0.25, busy: true },
    { x: 0, y: 0.7, w: 1, h: 0.3 },
  ],
  [
    { x: 0, y: 0, w: 1, h: 0.5, busy: true },
    { x: 0, y: 0.5, w: 0.33, h: 0.5 },
    { x: 0.33, y: 0.5, w: 0.34, h: 0.5 },
    { x: 0.67, y: 0.5, w: 0.33, h: 0.5 },
  ],
  [
    { x: 0, y: 0, w: 0.5, h: 0.28 },
    { x: 0.5, y: 0, w: 0.5, h: 0.28 },
    { x: 0, y: 0.28, w: 1, h: 0.44, busy: true },
    { x: 0, y: 0.72, w: 0.5, h: 0.28 },
    { x: 0.5, y: 0.72, w: 0.5, h: 0.28 },
  ],
];

export function generateSamplePages(count = 6): { src: string; w: number; h: number }[] {
  const pages: { src: string; w: number; h: number }[] = [];
  for (let i = 0; i < count; i++) {
    pages.push(drawPage(LAYOUTS[i % LAYOUTS.length], i));
  }
  return pages;
}

function drawPage(layout: Cell[], seed: number) {
  const c = document.createElement("canvas");
  c.width = PAGE_W;
  c.height = PAGE_H;
  const ctx = c.getContext("2d")!;
  const rnd = mulberry32(seed * 9973 + 7);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  for (const cell of layout) {
    const x = cell.x * PAGE_W + GUTTER / 2;
    const y = cell.y * PAGE_H + GUTTER / 2;
    const w = cell.w * PAGE_W - GUTTER;
    const h = cell.h * PAGE_H - GUTTER;
    drawPanel(ctx, x, y, w, h, rnd, !!cell.busy);
  }

  return { src: c.toDataURL("image/png"), w: PAGE_W, h: PAGE_H };
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rnd: () => number,
  busy: boolean
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // gradient sky/tone
  const g = ctx.createLinearGradient(x, y, x, y + h);
  const tone = 200 + Math.floor(rnd() * 40);
  g.addColorStop(0, `rgb(${tone},${tone},${tone})`);
  g.addColorStop(1, `rgb(${tone - 70},${tone - 70},${tone - 60})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h / 2;

  if (busy) {
    // speed lines radiating from center -> "action"
    ctx.strokeStyle = "rgba(20,20,20,0.85)";
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2;
      const r0 = 30 + rnd() * 40;
      const r1 = Math.max(w, h);
      ctx.lineWidth = 0.5 + rnd() * 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.fillStyle = "#111";
    star(ctx, cx, cy, Math.min(w, h) * 0.28, 10, 0.45);
    ctx.fill();
  } else {
    // a simple "character" silhouette + horizon
    ctx.fillStyle = "rgba(30,30,40,0.85)";
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.05, Math.min(w, h) * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - w * 0.13, cy + h * 0.08, w * 0.26, h * 0.3);
    ctx.strokeStyle = "rgba(40,40,40,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, cy + h * 0.18);
    ctx.lineTo(x + w, cy + h * 0.18);
    ctx.stroke();
  }

  // a speech bubble for flavor
  if (rnd() > 0.4) {
    const bw = Math.min(w * 0.42, 180);
    const bh = Math.min(h * 0.22, 90);
    const bx = x + 14 + rnd() * (w - bw - 28);
    const by = y + 14 + rnd() * (h * 0.3);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    roundRect(ctx, bx, by, bw, bh, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#222";
    for (let l = 0; l < 3; l++) {
      const ly = by + 22 + l * 20;
      ctx.fillRect(bx + 16, ly, bw - 32 - (l === 2 ? 40 : 0), 6);
    }
  }

  ctx.restore();

  // panel border (drawn after restore so it's crisp)
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 5;
  ctx.strokeRect(x, y, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  points: number,
  innerRatio: number
) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : outer * innerRatio;
    const a = (Math.PI * i) / points - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// deterministic PRNG so sample pages are stable across reloads
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
