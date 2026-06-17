import type { Panel } from "../types";

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

/**
 * Compute a translate+scale that frames `panel` (image-pixel coords) within the
 * viewport, centered, with padding. transform-origin is the stage's top-left.
 */
export function framePanel(
  panel: Pick<Panel, "x" | "y" | "width" | "height">,
  viewport: { w: number; h: number },
  opts: { fill?: number; maxZoom?: number; minZoom?: number } = {}
): Transform {
  const fill = opts.fill ?? 0.82;
  const maxZoom = opts.maxZoom ?? 2.4;
  const minZoom = opts.minZoom ?? 0.05;

  const sx = (viewport.w * fill) / panel.width;
  const sy = (viewport.h * fill) / panel.height;
  let scale = Math.min(sx, sy);
  scale = Math.max(minZoom, Math.min(maxZoom, scale));

  const cx = panel.x + panel.width / 2;
  const cy = panel.y + panel.height / 2;

  return {
    scale,
    x: viewport.w / 2 - cx * scale,
    y: viewport.h / 2 - cy * scale,
  };
}

/** Frame the whole page (used for the "reset / overview" view). */
export function framePage(
  page: { width: number; height: number },
  viewport: { w: number; h: number },
  fill = 0.94
): Transform {
  const scale = Math.min(
    (viewport.w * fill) / page.width,
    (viewport.h * fill) / page.height
  );
  return {
    scale,
    x: (viewport.w - page.width * scale) / 2,
    y: (viewport.h - page.height * scale) / 2,
  };
}
