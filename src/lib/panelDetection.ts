import type { Panel } from "../types";

/**
 * Robust client-side manga panel detection.
 *
 * Strategy (Kumiko-style, far more reliable than a plain whitespace cut):
 *  1. Decide gutter polarity: sample the page's border ring. Manga gutters are
 *     usually the page's paper colour (light) but some pages use black gutters,
 *     so we adapt instead of assuming white.
 *  2. Flood-fill the background inward from the page edges through gutter-coloured
 *     pixels. Gutters connect to the margin and become background; speech bubbles
 *     *inside* a panel are enclosed by art and stay foreground. Bubbles that
 *     overflow across a gutter get absorbed into the background, which actually
 *     helps separate the panels they were bridging.
 *  3. Connected-component the foreground; each large component is a panel.
 *
 * Pixels are only read, never modified — the artwork is untouched.
 */

interface DetectResult {
  panels: Panel[];
  width: number;
  height: number;
}

const MAX_DIM = 1000;

export async function detectPanels(
  src: string,
  direction: "ltr" | "rtl" = "ltr",
  lightThreshold = 225
): Promise<DetectResult> {
  const img = await loadImage(src);
  const natW = img.naturalWidth || 1;
  const natH = img.naturalHeight || 1;

  const scale = Math.min(1, MAX_DIM / Math.max(natW, natH));
  const w = Math.max(1, Math.round(natW * scale));
  const h = Math.max(1, Math.round(natH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const n = w * h;
  const luma = new Float32Array(n);
  const ink = new Uint8Array(n); // darker-than-paper, for density/impact
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const L = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    luma[p] = L;
    ink[p] = L < 200 ? 1 : 0;
  }

  // ---- 1. Gutter polarity from the border ring ------------------------------
  const margin = Math.max(2, Math.round(0.015 * Math.min(w, h)));
  let borderSum = 0;
  let borderCnt = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < margin || y < margin || x >= w - margin || y >= h - margin) {
        borderSum += luma[y * w + x];
        borderCnt++;
      }
    }
  }
  const borderMean = borderSum / borderCnt;
  // Treat as dark-gutter when the page margin is dark. If this misfires on a
  // dark *illustration* (e.g. a black-haired portrait), the coverage guard
  // below catches it: the flood would isolate only a bright blob, so we fall
  // back to a single whole-page panel.
  const darkGutter = borderMean < 110;
  const bgCand = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    bgCand[p] = darkGutter
      ? luma[p] <= 70
        ? 1
        : 0
      : luma[p] >= lightThreshold
      ? 1
      : 0;
  }

  // ---- 2. Flood background from the borders through gutter pixels -----------
  const bg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (bgCand[p] && !bg[p]) {
      bg[p] = 1;
      stack[sp++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  // ---- 3. Connected components of the foreground ----------------------------
  const label = new Int32Array(n);
  const queue = new Int32Array(n);
  const boxes: { x: number; y: number; w: number; h: number; area: number }[] = [];
  let lbl = 0;
  for (let start = 0; start < n; start++) {
    if (bg[start] || label[start]) continue;
    lbl++;
    let qh = 0;
    let qt = 0;
    queue[qt++] = start;
    label[start] = lbl;
    let minx = w,
      miny = h,
      maxx = 0,
      maxy = 0,
      area = 0;
    while (qh < qt) {
      const c = queue[qh++];
      const x = c % w;
      const y = (c / w) | 0;
      area++;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const np = ny * w + nx;
          if (!bg[np] && !label[np]) {
            label[np] = lbl;
            queue[qt++] = np;
          }
        }
      }
    }
    boxes.push({ x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1, area });
  }

  // ---- Filter to plausible panels -------------------------------------------
  const pageArea = n;
  const minPanel = 0.06 * Math.min(w, h);
  let rects = boxes.filter(
    (b) =>
      b.w * b.h > 0.02 * pageArea &&
      b.area > 0.012 * pageArea &&
      b.w > minPanel &&
      b.h > minPanel
  );

  // Drop nested panels: a smaller box mostly contained inside a bigger one is
  // usually a caption box or a sub-region of a splash, not a real panel. Without
  // this you get a redundant second zoom into the inside of a panel.
  rects = rects
    .slice()
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .filter((b, i, arr) => {
      for (let j = 0; j < i; j++) {
        const a = arr[j];
        const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        if ((ix * iy) / (b.w * b.h) > 0.6) return false; // mostly inside `a`
      }
      return true;
    });

  // Coverage guard: if the kept panels only cover a small slice of the page,
  // segmentation almost certainly failed (e.g. it grabbed a bright face out of
  // a dark full-page illustration). Fall back to a single whole-page panel,
  // which reads correctly as a splash and can be refined in the editor.
  const cov = new Uint8Array(n);
  let covered = 0;
  for (const b of rects) {
    for (let y = b.y; y < b.y + b.h; y++) {
      const row = y * w;
      for (let x = b.x; x < b.x + b.w; x++) {
        if (!cov[row + x]) {
          cov[row + x] = 1;
          covered++;
        }
      }
    }
  }
  if (rects.length === 0 || covered / pageArea < 0.45) {
    rects = [{ x: 0, y: 0, w, h, area: pageArea }];
  }

  const ordered = orderRects(rects, direction);

  const inv = 1 / scale;
  const panels: Panel[] = ordered.map((b, i) => {
    const density = rectDensity(ink, w, b);
    const fill = b.area / (b.w * b.h); // how solidly the component fills its box
    return {
      id: i + 1,
      order: i + 1,
      x: Math.round(b.x * inv),
      y: Math.round(b.y * inv),
      width: Math.round(b.w * inv),
      height: Math.round(b.h * inv),
      confidence: clamp(0.55 + fill * 0.4, 0.5, 0.98),
      impact: density > 0.55,
    };
  });

  return { panels, width: natW, height: natH };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Cluster rects into reading rows (top→bottom), order within row by direction. */
function orderRects<T extends Rect>(rects: T[], direction: "ltr" | "rtl"): T[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y);
  const rows: T[][] = [];
  for (const r of sorted) {
    const row = rows.find(
      (g) => r.y < g[0].y + Math.max(...g.map((x) => x.h)) * 0.5
    );
    if (row) row.push(r);
    else rows.push([r]);
  }
  const out: T[] = [];
  for (const row of rows) {
    row.sort((a, b) => (direction === "rtl" ? b.x - a.x : a.x - b.x));
    out.push(...row);
  }
  return out;
}

/** Recompute reading order + ids for a set of panels (used by the editor). */
export function reorderPanels(
  panels: Panel[],
  direction: "ltr" | "rtl"
): Panel[] {
  const rects = panels.map((p) => ({
    x: p.x,
    y: p.y,
    w: p.width,
    h: p.height,
    ref: p,
  }));
  return orderRects(rects, direction).map((r, i) => ({
    ...r.ref,
    id: i + 1,
    order: i + 1,
  }));
}

function rectDensity(ink: Uint8Array, w: number, r: Rect): number {
  let count = 0;
  const x1 = r.x + r.w;
  const y1 = r.y + r.h;
  for (let y = r.y; y < y1; y++) {
    const row = y * w;
    for (let x = r.x; x < x1; x++) count += ink[row + x];
  }
  return count / (r.w * r.h);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
}
