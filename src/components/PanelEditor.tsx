import { useRef, useState, useCallback, useMemo } from "react";
import type { Page, Panel, MotionSettings } from "../types";
import { reorderPanels } from "../lib/panelDetection";
import { useElementSize } from "../hooks/useElementSize";

interface Props {
  page: Page;
  direction: MotionSettings["direction"];
  onSave: (panels: Panel[]) => void;
  onCancel: () => void;
}

type Handle = "nw" | "ne" | "sw" | "se";
type Drag =
  | { kind: "move"; id: number; ox: number; oy: number; start: Panel }
  | { kind: "resize"; id: number; handle: Handle; start: Panel }
  | { kind: "draw"; sx: number; sy: number };

let uid = 100000;

/** Manual panel editor: detection gives a first guess, you fix the rest. */
export default function PanelEditor({ page, direction, onSave, onCancel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(wrapRef);
  const [panels, setPanels] = useState<Panel[]>(() =>
    page.panels.map((p) => ({ ...p }))
  );
  const [selected, setSelected] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);

  // Fit the page inside the editor viewport (contain).
  const fit = useMemo(() => {
    if (!size.w || !size.h) return { s: 1, ox: 0, oy: 0 };
    const s = Math.min((size.w - 40) / page.width, (size.h - 40) / page.height);
    return {
      s,
      ox: (size.w - page.width * s) / 2,
      oy: (size.h - page.height * s) / 2,
    };
  }, [size, page.width, page.height]);

  const toImg = useCallback(
    (clientX: number, clientY: number) => {
      const r = wrapRef.current!.getBoundingClientRect();
      return {
        x: (clientX - r.left - fit.ox) / fit.s,
        y: (clientY - r.top - fit.oy) / fit.s,
      };
    },
    [fit]
  );

  const onPointerDownBg = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    const { x, y } = toImg(e.clientX, e.clientY);
    drag.current = { kind: "draw", sx: x, sy: y };
    setSelected(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startMove = (e: React.PointerEvent, p: Panel) => {
    e.stopPropagation();
    const { x, y } = toImg(e.clientX, e.clientY);
    drag.current = { kind: "move", id: p.id, ox: x - p.x, oy: y - p.y, start: p };
    setSelected(p.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startResize = (e: React.PointerEvent, p: Panel, handle: Handle) => {
    e.stopPropagation();
    drag.current = { kind: "resize", id: p.id, handle, start: { ...p } };
    setSelected(p.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { x, y } = toImg(e.clientX, e.clientY);
    const clampX = (v: number) => Math.max(0, Math.min(page.width, v));
    const clampY = (v: number) => Math.max(0, Math.min(page.height, v));

    if (d.kind === "draw") {
      const nx = clampX(Math.min(d.sx, x));
      const ny = clampY(Math.min(d.sy, y));
      const nw = clampX(Math.max(d.sx, x)) - nx;
      const nh = clampY(Math.max(d.sy, y)) - ny;
      setPanels((ps) => {
        const others = ps.filter((p) => p.id !== -1);
        return [
          ...others,
          {
            id: -1,
            order: 0,
            x: nx,
            y: ny,
            width: nw,
            height: nh,
            confidence: 1,
          },
        ];
      });
    } else if (d.kind === "move") {
      setPanels((ps) =>
        ps.map((p) =>
          p.id === d.id
            ? {
                ...p,
                x: clampX(x - d.ox),
                y: clampY(y - d.oy),
              }
            : p
        )
      );
    } else {
      setPanels((ps) =>
        ps.map((p) => {
          if (p.id !== d.id) return p;
          const s = d.start;
          let { x: nx, y: ny, width: nw, height: nh } = s;
          const right = s.x + s.width;
          const bottom = s.y + s.height;
          if (d.handle.includes("w")) {
            nx = clampX(Math.min(x, right - 10));
            nw = right - nx;
          }
          if (d.handle.includes("e")) {
            nw = clampX(x) - s.x;
          }
          if (d.handle.includes("n")) {
            ny = clampY(Math.min(y, bottom - 10));
            nh = bottom - ny;
          }
          if (d.handle.includes("s")) {
            nh = clampY(y) - s.y;
          }
          return { ...p, x: nx, y: ny, width: Math.max(10, nw), height: Math.max(10, nh) };
        })
      );
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "draw") {
      setPanels((ps) =>
        ps
          .map((p) => (p.id === -1 ? { ...p, id: ++uid } : p))
          .filter((p) => p.width > 18 && p.height > 18)
      );
    }
  };

  const remove = (id: number) =>
    setPanels((ps) => ps.filter((p) => p.id !== id));

  const autoOrder = () => setPanels((ps) => reorderPanels(ps, direction));

  const handleSave = () => onSave(reorderPanels(panels, direction));

  const ordered = useMemo(
    () => reorderPanels(panels, direction),
    [panels, direction]
  );
  const orderOf = (id: number) => ordered.findIndex((p) => p.id === id) + 1;

  return (
    <div className="absolute inset-0 z-50 bg-[#070709]">
      <div
        ref={wrapRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDownBg}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <img
          src={page.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{
            left: fit.ox,
            top: fit.oy,
            width: page.width * fit.s,
            height: page.height * fit.s,
            opacity: 0.92,
          }}
        />

        {panels.map((p) => {
          const sx = fit.ox + p.x * fit.s;
          const sy = fit.oy + p.y * fit.s;
          const sw = p.width * fit.s;
          const sh = p.height * fit.s;
          const active = selected === p.id;
          return (
            <div
              key={p.id}
              onPointerDown={(e) => startMove(e, p)}
              className={`absolute cursor-move rounded-sm border-2 ${
                active
                  ? "border-orange-700 bg-orange-800/10"
                  : "border-orange-600/70 bg-orange-800/5"
              }`}
              style={{ left: sx, top: sy, width: sw, height: sh }}
            >
              <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-white">
                {orderOf(p.id)}
              </span>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => remove(p.id)}
                className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded bg-black/70 text-white/80 hover:bg-red-600"
                aria-label="Delete panel"
              >
                ✕
              </button>
              {(["nw", "ne", "sw", "se"] as Handle[]).map((hd) => (
                <span
                  key={hd}
                  onPointerDown={(e) => startResize(e, p, hd)}
                  className="absolute h-3 w-3 rounded-full border border-black bg-white"
                  style={{
                    cursor: hd === "nw" || hd === "se" ? "nwse-resize" : "nesw-resize",
                    left: hd.includes("w") ? -6 : undefined,
                    right: hd.includes("e") ? -6 : undefined,
                    top: hd.includes("n") ? -6 : undefined,
                    bottom: hd.includes("s") ? -6 : undefined,
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-zinc-900/85 px-3 py-2 text-sm shadow-2xl backdrop-blur">
        <span className="px-1 text-xs text-white/60">
          Page {page.pageNumber} · {panels.length} panels — drag empty space to
          draw
        </span>
        <button
          onClick={autoOrder}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
        >
          Auto-order
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="rounded-lg bg-orange-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
        >
          Save
        </button>
      </div>
    </div>
  );
}
