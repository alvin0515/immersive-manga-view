// Shared domain types for immersive-manga-view.

export type ReadingDirection = "ltr" | "rtl";

export type Genre = "neutral" | "action" | "romance" | "horror";

/** A detected panel in image-pixel coordinates. */
export interface Panel {
  id: number;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  /** Heuristic: panel likely contains high-impact action. */
  impact?: boolean;
}

/** A single manga page plus its detected panels. */
export interface Page {
  id: number;
  pageNumber: number;
  /** Object URL or data URL for the artwork. */
  src: string;
  width: number;
  height: number;
  panels: Panel[];
}

export interface MotionSettings {
  /** Master toggle. When true, transitions are instant (accessibility). */
  reduceMotion: boolean;
  /** 0..1 multiplier applied to zoom, parallax, shake, glow. */
  intensity: number;
  direction: ReadingDirection;
  genre: Genre;
  /** Dim strength for non-active regions, 0..1. */
  dim: number;
  parallax: boolean;
}

export const defaultSettings: MotionSettings = {
  reduceMotion:
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  intensity: 0.85,
  direction: "ltr",
  genre: "neutral",
  dim: 0.72,
  parallax: true,
};
