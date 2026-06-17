import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import Reader from "./components/Reader";
import SettingsPanel from "./components/SettingsPanel";
import ChapterOverlay from "./components/ChapterOverlay";
import PanelEditor from "./components/PanelEditor";
import { detectPanels, reorderPanels } from "./lib/panelDetection";
import { generateSamplePages } from "./lib/sampleData";
import {
  defaultSettings,
  type MotionSettings,
  type Page,
} from "./types";

const PROGRESS_KEY = "lmr.progress.v1";

export default function App() {
  const [pages, setPages] = useState<Page[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [loadInfo, setLoadInfo] = useState("Generating sample pages…");

  const [pageIndex, setPageIndex] = useState(0);
  const [panelIndex, setPanelIndex] = useState(0); // -1 => overview

  const [settings, setSettings] = useState<MotionSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [editing, setEditing] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Detection pipeline ---------------------------------------------------
  const runDetection = useCallback(
    async (
      sources: { src: string; w: number; h: number }[],
      direction: MotionSettings["direction"]
    ) => {
      setStatus("loading");
      const result: Page[] = [];
      for (let i = 0; i < sources.length; i++) {
        setLoadInfo(`Detecting panels · page ${i + 1}/${sources.length}`);
        const { panels, width, height } = await detectPanels(
          sources[i].src,
          direction
        );
        result.push({
          id: i + 1,
          pageNumber: i + 1,
          src: sources[i].src,
          width,
          height,
          panels,
        });
      }
      setPages(result);
      setStatus("ready");
    },
    []
  );

  useEffect(() => {
    const samples = generateSamplePages(6);
    runDetection(samples, defaultSettings.direction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore reading progress once pages are ready.
  useEffect(() => {
    if (status !== "ready" || pages.length === 0) return;
    try {
      const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
      if (saved && saved.pageIndex < pages.length) {
        setPageIndex(saved.pageIndex);
        const max = pages[saved.pageIndex].panels.length - 1;
        setPanelIndex(Math.min(saved.panelIndex ?? 0, max));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const page = pages[pageIndex];
  const panels = page?.panels ?? [];
  const panel = panelIndex >= 0 ? panels[panelIndex] ?? null : null;

  // Persist progress.
  useEffect(() => {
    if (status !== "ready") return;
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ pageIndex, panelIndex })
    );
  }, [pageIndex, panelIndex, status]);

  // Preload neighbouring page artwork for smooth page crossings.
  useEffect(() => {
    [pageIndex + 1, pageIndex - 1].forEach((i) => {
      if (pages[i]) {
        const img = new Image();
        img.src = pages[i].src;
      }
    });
  }, [pageIndex, pages]);

  // ---- Navigation -----------------------------------------------------------
  const next = useCallback(() => {
    if (!page) return;
    setPanelIndex((pi) => {
      if (pi < panels.length - 1) return pi + 1;
      if (pageIndex < pages.length - 1) {
        setPageIndex(pageIndex + 1);
        return 0;
      }
      return pi;
    });
  }, [page, panels.length, pageIndex, pages.length]);

  const prev = useCallback(() => {
    if (!page) return;
    setPanelIndex((pi) => {
      if (pi > 0) return pi - 1;
      if (pi === 0 && pageIndex > 0) {
        const prevPage = pages[pageIndex - 1];
        setPageIndex(pageIndex - 1);
        return prevPage.panels.length - 1;
      }
      return pi;
    });
  }, [page, pageIndex, pages]);

  const resetView = useCallback(() => setPanelIndex(-1), []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }, []);

  const jumpToPage = useCallback((i: number) => {
    setPageIndex(i);
    setPanelIndex(0);
    setShowChapters(false);
  }, []);

  const saveEditedPanels = useCallback(
    (panels: Page["panels"]) => {
      setPages((prev) =>
        prev.map((p, i) => (i === pageIndex ? { ...p, panels } : p))
      );
      setPanelIndex((pi) => Math.min(Math.max(0, pi), panels.length - 1));
      setEditing(false);
    },
    [pageIndex]
  );

  const patchSettings = useCallback(
    (patch: Partial<MotionSettings>) => {
      setSettings((s) => {
        const nextSettings = { ...s, ...patch };
        // Re-derive reading order when direction flips.
        if (patch.direction && patch.direction !== s.direction) {
          setPages((prev) =>
            prev.map((p) => ({
              ...p,
              panels: reorderPanels(p.panels, patch.direction!),
            }))
          );
        }
        return nextSettings;
      });
    },
    []
  );

  // ---- Keyboard -------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) {
        if (e.key === "Escape") setEditing(false);
        return; // editor owns input while open
      }
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          prev();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "r":
        case "R":
          resetView();
          break;
        case "s":
        case "S":
          setShowSettings((v) => !v);
          break;
        case "c":
        case "C":
          setShowChapters((v) => !v);
          break;
        case "e":
        case "E":
          setEditing((v) => !v);
          break;
        case "Escape":
          setShowSettings(false);
          setShowChapters(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, toggleFullscreen, resetView, editing]);

  // ---- Auto-hiding controls -------------------------------------------------
  useEffect(() => {
    let t: number;
    const reveal = () => {
      setControlsVisible(true);
      clearTimeout(t);
      t = window.setTimeout(() => setControlsVisible(false), 2600);
    };
    reveal();
    window.addEventListener("pointermove", reveal);
    window.addEventListener("keydown", reveal);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", reveal);
      window.removeEventListener("keydown", reveal);
    };
  }, []);

  // ---- Upload ---------------------------------------------------------------
  const onUpload = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const sources = Array.from(files).map((f) => ({
        src: URL.createObjectURL(f),
        w: 0,
        h: 0,
      }));
      setPageIndex(0);
      setPanelIndex(0);
      runDetection(sources, settings.direction);
    },
    [runDetection, settings.direction]
  );

  // ---- Progress -------------------------------------------------------------
  const { globalIndex, totalPanels } = useMemo(() => {
    let before = 0;
    for (let i = 0; i < pageIndex; i++) before += pages[i]?.panels.length ?? 0;
    const total = pages.reduce((a, p) => a + p.panels.length, 0);
    return {
      globalIndex: before + Math.max(0, panelIndex),
      totalPanels: total,
    };
  }, [pages, pageIndex, panelIndex]);

  if (status === "loading" || !page) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-700 border-t-transparent" />
        <p className="text-sm text-white/60">{loadInfo}</p>
      </div>
    );
  }

  const progress = totalPanels > 0 ? (globalIndex + 1) / totalPanels : 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050507]">
      <Reader
        page={page}
        panel={panel}
        settings={settings}
        onNext={next}
        onPrev={prev}
      />

      {/* Top bar */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between p-4"
          >
            <div className="pointer-events-auto flex items-center gap-2">
              <span className="rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/80 backdrop-blur">
                immersive-manga-view
              </span>
              <span className="rounded-full bg-black/40 px-3 py-1.5 text-xs text-white/60 backdrop-blur">
                Page {page.pageNumber}/{pages.length} ·{" "}
                {panel ? `Panel ${panel.order}/${panels.length}` : "Overview"}
                {panel && (
                  <span className="ml-1 text-white/40">
                    ({Math.round(panel.confidence * 100)}%)
                  </span>
                )}
              </span>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <IconButton title="Chapter (C)" onClick={() => setShowChapters(true)}>
                ☰
              </IconButton>
              <IconButton title="Edit panels (E)" onClick={() => setEditing(true)}>
                ✎
              </IconButton>
              <IconButton title="Upload pages" onClick={() => fileInputRef.current?.click()}>
                ⬆
              </IconButton>
              <IconButton title="Reset view (R)" onClick={resetView}>
                ⤢
              </IconButton>
              <IconButton title="Fullscreen (F)" onClick={toggleFullscreen}>
                ⛶
              </IconButton>
              <IconButton title="Settings (S)" onClick={() => setShowSettings((v) => !v)}>
                ⚙
              </IconButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom progress + hints */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="absolute inset-x-0 bottom-0 z-30 p-4 pb-6"
          >
            <div className="mx-auto max-w-3xl rounded-xl border border-white/55 bg-white/70 px-4 py-3 backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between text-sm font-semibold text-black/90 [text-shadow:0_1px_0_rgba(255,255,255,0.35)]">
                <span>← / → · scroll · swipe · tap to advance</span>
                <span className="font-semibold text-black/95">{Math.round(progress * 100)}%</span>
              </div>
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-orange-800"
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ type: "spring", stiffness: 160, damping: 26 }}
                />
              </div>
              {/* Per-panel ticks */}
              <div className="mt-2 flex gap-1">
                {panels.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setPanelIndex(i)}
                    className={`h-1 flex-1 rounded-full transition ${
                      i === panelIndex
                        ? "bg-orange-700"
                        : i < panelIndex
                        ? "bg-orange-500/60"
                        : "bg-orange-900/35"
                    }`}
                    aria-label={`Go to panel ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={patchSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showChapters && (
        <ChapterOverlay
          pages={pages}
          currentPageIndex={pageIndex}
          onSelect={jumpToPage}
          onClose={() => setShowChapters(false)}
        />
      )}

      {editing && (
        <PanelEditor
          page={page}
          direction={settings.direction}
          onSave={saveEditedPanels}
          onCancel={() => setEditing(false)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => onUpload(e.target.files)}
      />
    </div>
  );
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white/80 backdrop-blur transition hover:bg-black/60 hover:text-white"
    >
      {children}
    </button>
  );
}
