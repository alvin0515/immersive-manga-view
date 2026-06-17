import { useEffect, useMemo, useRef } from "react";
import {
  motion,
  useAnimationControls,
  AnimatePresence,
} from "framer-motion";
import type { Page, Panel, MotionSettings } from "../types";
import { framePanel, framePage } from "../lib/camera";
import { useElementSize } from "../hooks/useElementSize";

interface ReaderProps {
  page: Page;
  panel: Panel | null; // null => overview (whole page)
  settings: MotionSettings;
  onNext: () => void;
  onPrev: () => void;
}

const GENRE_DURATION: Record<MotionSettings["genre"], number> = {
  neutral: 0.46,
  action: 0.32,
  romance: 0.6,
  horror: 0.48,
};

export default function Reader({
  page,
  panel,
  settings,
  onNext,
  onPrev,
}: ReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewport = useElementSize(containerRef);

  const shake = useAnimationControls();
  const flash = useAnimationControls();

  const overview = panel == null;
  const reduce = settings.reduceMotion;
  const intensity = settings.intensity;

  // A padded focus region around the panel so captions/bubbles that sit at the
  // panel edge (or slightly overflow the detected box) are never cropped or
  // dimmed. Clamped to the page so we never reveal off-page emptiness.
  const focus = useMemo(() => {
    if (!panel) return null;
    // Keep generous margins so speech bubbles/captions outside strict panel
    // bounds remain visible after camera framing.
    const px = Math.max(panel.width * 0.12, 24);
    const py = Math.max(panel.height * 0.12, 24);
    const x = Math.max(0, panel.x - px);
    const y = Math.max(0, panel.y - py);
    const right = Math.min(page.width, panel.x + panel.width + px);
    const bottom = Math.min(page.height, panel.y + panel.height + py);
    return { ...panel, x, y, width: right - x, height: bottom - y };
  }, [panel, page.width, page.height]);

  // ---- Camera transform -----------------------------------------------------
  const transform = useMemo(() => {
    if (!viewport.w || !viewport.h) return { x: 0, y: 0, scale: 1 };
    if (overview || !focus) return framePage(page, viewport);
    // Always show the whole (padded) panel with breathing room, so nothing at
    // the edges is clipped. Intensity nudges the zoom slightly, never past a
    // safe margin.
    const fill = 0.72 + 0.06 * intensity; // 0.72–0.78 of the viewport
    return framePanel(focus, viewport, { fill, maxZoom: 2.6 });
  }, [page, focus, viewport, overview, intensity]);

  const duration = reduce
    ? 0.001
    : GENRE_DURATION[settings.genre] * (1.25 - 0.35 * intensity);

  const transition = reduce
    ? { duration: 0.001 }
    : settings.genre === "action"
    ? { type: "spring" as const, stiffness: 210, damping: 26, mass: 0.9 }
    : { type: "spring" as const, stiffness: 120, damping: 22, mass: 1 };

  // ---- Impact mode: micro-shake + flash on action panels --------------------
  useEffect(() => {
    if (reduce || !panel?.impact) return;
    if (settings.genre !== "action" && settings.genre !== "horror") return;
    const amp = 7 * intensity;
    shake.start({
      x: [0, -amp, amp, -amp * 0.6, amp * 0.4, 0],
      y: [0, amp * 0.5, -amp * 0.4, amp * 0.3, 0, 0],
      transition: { duration: 0.15, ease: "easeOut" },
    });
    flash.start({
      opacity: [0, 0.35 * intensity, 0],
      transition: { duration: 0.18, ease: "easeOut" },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, panel?.id]);

  // ---- Parallax: pointer nudges the stage; background drifts slower ----------
  const parallaxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    const layer = parallaxRef.current;
    if (!el || !layer || !settings.parallax || reduce) return;
    const onMove = (e: PointerEvent) => {
      const rx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ry = (e.clientY / window.innerHeight - 0.5) * 2;
      const d = 16 * intensity;
      layer.style.transform = `translate3d(${(-rx * d).toFixed(2)}px, ${(
        -ry * d
      ).toFixed(2)}px, 0)`;
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, [settings.parallax, reduce, intensity]);

  // ---- Input: wheel, swipe, tap ---------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let wheelLock = false;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (wheelLock) return;
      if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return;
      wheelLock = true;
      (e.deltaY > 0 || e.deltaX > 0 ? onNext : onPrev)();
      setTimeout(() => (wheelLock = false), 360);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onNext, onPrev]);

  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    const dt = Date.now() - touch.current.t;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      // RTL: swipe-right reads forward
      const forward = settings.direction === "rtl" ? dx > 0 : dx < 0;
      forward ? onNext() : onPrev();
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 250) {
      onNext(); // tap to advance
    }
    touch.current = null;
  };

  const panelKey = `${page.id}:${panel?.id ?? "all"}`;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Shake wrapper (impact mode) */}
      <motion.div className="absolute inset-0" animate={shake}>
        {/* Parallax wrapper (pointer drift) */}
        <div
          ref={parallaxRef}
          className="absolute inset-0"
          style={{ transition: reduce ? "none" : "transform 220ms ease-out" }}
        >
          {/* Cinematic camera stage */}
          <motion.div
            className="gpu absolute left-0 top-0"
            style={{
              width: page.width,
              height: page.height,
              transformOrigin: "0 0",
            }}
            animate={{
              x: transform.x,
              y: transform.y,
              scale: transform.scale,
            }}
            transition={transition}
          >
            <img
              src={page.src}
              width={page.width}
              height={page.height}
              draggable={false}
              alt={`Page ${page.pageNumber}`}
              className="block select-none"
            />
            <Spotlight
              page={page}
              panel={overview ? null : focus}
              dim={settings.dim}
              duration={duration}
              intensity={intensity}
              genre={settings.genre}
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Reveal pulse: a soft dark wash that clears as the panel settles */}
      <AnimatePresence mode="wait">
        {!reduce && !overview && (
          <motion.div
            key={panelKey}
            className="pointer-events-none absolute inset-0 bg-black"
            initial={{ opacity: 0.28 * intensity }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration * 0.9, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Impact flash */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-white"
        style={{ opacity: 0 }}
        animate={flash}
      />

      {/* Genre ambiance overlays */}
      <GenreAmbiance genre={settings.genre} reduce={reduce} intensity={intensity} />
    </div>
  );
}

/** SVG dim mask: darkens everything except a rounded hole over the active panel. */
function Spotlight({
  page,
  panel,
  dim,
  duration,
  intensity,
  genre,
}: {
  page: Page;
  panel: Panel | null;
  dim: number;
  duration: number;
  intensity: number;
  genre: MotionSettings["genre"];
}) {
  const pad = 20;
  const target = panel
    ? {
        x: Math.max(0, panel.x - pad),
        y: Math.max(0, panel.y - pad),
        width: panel.width + pad * 2,
        height: panel.height + pad * 2,
      }
    : { x: 0, y: 0, width: page.width, height: page.height };

  const glow =
    genre === "romance"
      ? "rgba(220,140,80,0.9)"
      : genre === "horror"
      ? "rgba(180,40,40,0.85)"
      : genre === "action"
      ? "rgba(220,120,40,0.95)"
      : "rgba(200,110,35,0.9)";

  const maskId = `spot-${page.id}`;
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={page.width}
      height={page.height}
      viewBox={`0 0 ${page.width} ${page.height}`}
    >
      <defs>
        <mask id={maskId}>
          <rect width={page.width} height={page.height} fill="white" />
          <motion.rect
            rx={14}
            fill="black"
            initial={false}
            animate={target}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
        </mask>
      </defs>

      <rect
        width={page.width}
        height={page.height}
        fill="black"
        opacity={panel ? dim : 0}
        mask={`url(#${maskId})`}
        style={{ transition: `opacity ${duration}s ease-out` }}
      />

      {panel && (
        <motion.rect
          rx={14}
          fill="none"
          stroke={glow}
          initial={false}
          animate={{
            ...target,
            strokeWidth: [6 * intensity + 2, 3 * intensity + 1.5],
            strokeOpacity: [0.95, 0.55],
          }}
          transition={{
            x: { type: "spring", stiffness: 120, damping: 22 },
            y: { type: "spring", stiffness: 120, damping: 22 },
            width: { type: "spring", stiffness: 120, damping: 22 },
            height: { type: "spring", stiffness: 120, damping: 22 },
            strokeWidth: { duration: 0.5, ease: "easeOut" },
            strokeOpacity: { duration: 0.5, ease: "easeOut" },
          }}
          style={{ filter: `drop-shadow(0 0 ${10 * intensity}px ${glow})` }}
        />
      )}
    </svg>
  );
}

function GenreAmbiance({
  genre,
  reduce,
  intensity,
}: {
  genre: MotionSettings["genre"];
  reduce: boolean;
  intensity: number;
}) {
  if (genre === "neutral") return null;

  if (genre === "horror") {
    return (
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.85) 100%)",
        }}
        animate={
          reduce ? {} : { opacity: [0.85, 1, 0.78, 0.95, 0.85] }
        }
        transition={
          reduce ? {} : { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }
      />
    );
  }
  if (genre === "romance") {
    return (
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,200,220,0.10) 0%, rgba(255,170,200,0.04) 40%, transparent 70%)",
          mixBlendMode: "screen",
        }}
      />
    );
  }
  // action: faint vignette to focus center
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${
          0.35 * intensity
        }) 100%)`,
      }}
    />
  );
}
