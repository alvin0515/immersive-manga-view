import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Page } from "../types";

interface Props {
  pages: Page[];
  currentPageIndex: number;
  onSelect: (pageIndex: number) => void;
  onClose: () => void;
}

/** Virtualized chapter overview (React Virtual) — handles long chapters cheaply. */
export default function ChapterOverlay({
  pages,
  currentPageIndex,
  onSelect,
  onClose,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 132,
    overscan: 6,
  });

  return (
    <div className="absolute inset-0 z-40 flex bg-black/70 backdrop-blur-sm">
      <div className="m-auto flex h-[80vh] w-[min(92vw,420px)] flex-col rounded-2xl border border-white/10 bg-zinc-900/90 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-white/90">
            Chapter · {pages.length} pages
          </h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 text-white/50 hover:text-white"
            aria-label="Close chapter list"
          >
            ✕
          </button>
        </div>

        <div ref={parentRef} className="flex-1 overflow-auto p-3">
          <div
            style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}
          >
            {rowVirtualizer.getVirtualItems().map((v) => {
              const page = pages[v.index];
              const active = v.index === currentPageIndex;
              return (
                <button
                  key={v.key}
                  onClick={() => onSelect(v.index)}
                  className={`absolute left-0 flex w-full items-center gap-3 rounded-xl border p-2 text-left transition ${
                    active
                      ? "border-orange-700/70 bg-orange-800/20"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/10"
                  }`}
                  style={{
                    top: v.start,
                    height: v.size - 10,
                  }}
                >
                  <img
                    src={page.src}
                    alt=""
                    className="h-[108px] w-[76px] shrink-0 rounded-md object-cover ring-1 ring-white/10"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white/90">
                      Page {page.pageNumber}
                    </p>
                    <p className="text-xs text-white/50">
                      {page.panels.length} panel
                      {page.panels.length === 1 ? "" : "s"} detected
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
