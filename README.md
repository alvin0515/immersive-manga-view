# Immersive Manga View

A cinematic, panel-aware manga reader built with React + TypeScript + Vite.
Panel detection runs in the browser and drives guided camera movement across
each page.

## Requirements

- Node.js 18+
- npm

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - type-check and create production build in `dist/`
- `npm run preview` - preview the production build

## Maintenance

- Keep the project clean by running `npm run build` after changes.
- TypeScript strict checks are enabled (including unused locals/parameters).

## Project structure

```text
src/
  components/
  hooks/
  lib/
  App.tsx
  main.tsx
  types.ts
```

## How it works

1. On load, synthetic manga pages are generated on a `<canvas>` (or you upload
   your own).
2. Each page image is analysed in-browser to detect panel rectangles.
3. The reader frames one panel at a time with a film-style camera (zoom, pan,
   spotlight dimming, parallax and per-genre ambiance), advancing on
   key/scroll/swipe/tap. Reading progress is saved to `localStorage`.

## Functions reference

A walkthrough of every function in the app, grouped by file.

### `src/main.tsx`

- **(module entry)** — Mounts the `<App />` component into `#root` inside
  `React.StrictMode`.

### `src/App.tsx` — top-level state & orchestration

- **`App()`** — Root component. Owns all reader state (pages, current
  page/panel index, settings, overlay visibility) and wires together the
  `Reader`, `SettingsPanel`, `ChapterOverlay` and `PanelEditor`.
- **`runDetection(sources, direction)`** — Runs the detection pipeline over a
  list of image sources, building `Page` objects (with detected panels) and
  flipping status from `loading` to `ready`.
- **`next()`** — Advances to the next panel, rolling over to the first panel of
  the next page when at the end of the current page.
- **`prev()`** — Goes to the previous panel, rolling back to the last panel of
  the previous page when at the start.
- **`resetView()`** — Switches to the whole-page "overview" framing
  (`panelIndex = -1`).
- **`toggleFullscreen()`** — Enters or exits browser fullscreen.
- **`jumpToPage(i)`** — Jumps to page `i`, resets to its first panel and closes
  the chapter overlay.
- **`saveEditedPanels(panels)`** — Persists panels edited in `PanelEditor` back
  into the current page and clamps the active panel index.
- **`patchSettings(patch)`** — Merges a partial settings update; when the
  reading direction flips it re-derives every page's panel reading order.
- **`onUpload(files)`** — Turns uploaded image files into object-URL sources and
  re-runs detection from page 0.
- **`IconButton({ children, title, onClick })`** — Small round icon button used
  in the top control bar.

The component also contains several `useEffect`/`useMemo` blocks (not named
functions) that: run initial detection, restore/persist progress, preload
neighbouring pages, handle keyboard shortcuts, auto-hide controls, and compute
the global progress fraction.

### `src/types.ts` — shared domain types

- **`ReadingDirection`, `Genre`, `Panel`, `Page`, `MotionSettings`** — Shared
  TypeScript types describing panels, pages and motion/cinematic settings.
- **`defaultSettings`** — Default `MotionSettings` (intensity, dim, direction,
  genre, parallax, and OS-driven `reduceMotion`).

### `src/lib/panelDetection.ts` — in-browser panel detection

- **`detectPanels(src, direction, lightThreshold)`** — Core detector. Loads the
  image, downscales it, decides gutter polarity from the page border, flood-fills
  the background through gutter pixels, connected-components the foreground into
  panel boxes, filters/de-nests them (with a whole-page fallback) and returns
  ordered `Panel`s plus the natural image size. Pixels are only read, never
  modified.
- **`orderRects(rects, direction)`** — Clusters rectangles into reading rows
  (top→bottom) and orders within each row by reading direction.
- **`reorderPanels(panels, direction)`** — Recomputes reading order and
  ids/`order` for a set of panels (used by the editor and on direction change).
- **`rectDensity(ink, w, r)`** — Fraction of "ink" (dark) pixels in a rectangle;
  used to flag high-impact action panels.
- **`clamp(v, lo, hi)`** — Numeric clamp helper.
- **`loadImage(src)`** — Promise wrapper that loads an `HTMLImageElement`
  (with CORS enabled).

### `src/lib/camera.ts` — camera math

- **`framePanel(panel, viewport, opts)`** — Computes a translate+scale transform
  that centers and frames a single panel within the viewport, with padding and
  zoom clamping.
- **`framePage(page, viewport, fill)`** — Computes the transform that fits the
  whole page in the viewport (the overview/reset framing).

### `src/lib/sampleData.ts` — synthetic demo pages

- **`generateSamplePages(count)`** — Produces `count` copyright-free manga-style
  pages (as data URLs) by cycling through hand-authored layouts.
- **`drawPage(layout, seed)`** — Renders one page's panels onto a `<canvas>` and
  returns its data URL.
- **`drawPanel(ctx, x, y, w, h, rnd, busy)`** — Draws a single panel: gradient
  tone, a character silhouette or "action" speed-lines, an optional speech
  bubble, and a crisp border.
- **`roundRect(ctx, x, y, w, h, r)`** — Canvas helper that traces a rounded
  rectangle path (for speech bubbles).
- **`star(ctx, cx, cy, outer, points, innerRatio)`** — Canvas helper that traces
  a star path (impact burst in action panels).
- **`mulberry32(a)`** — Small deterministic PRNG so sample pages stay stable
  across reloads.

### `src/hooks/useElementSize.ts`

- **`useElementSize(ref)`** — Hook that tracks an element's pixel size via a
  `ResizeObserver`, returning `{ w, h }`.

### `src/components/Reader.tsx` — the cinematic viewport

- **`Reader({ page, panel, settings, onNext, onPrev })`** — Renders the page and
  drives the camera. Computes a padded focus region, the camera transform,
  genre-based timing, impact shake/flash, pointer parallax, and wheel/swipe/tap
  navigation.
- **`Spotlight({ page, panel, dim, duration, intensity, genre })`** — SVG mask
  that dims everything except a rounded hole over the active panel, plus an
  animated glowing border.
- **`GenreAmbiance({ genre, reduce, intensity })`** — Full-screen overlay that
  adds genre mood (horror vignette pulse, romance glow, action vignette);
  renders nothing for `neutral`.

### `src/components/SettingsPanel.tsx`

- **`SettingsPanel({ settings, onChange, onClose })`** — Floating settings panel
  for reduce-motion, intensity, dim, parallax, reading direction and genre.
- **`Toggle({ label, hint, value, onChange })`** — Reusable on/off switch row.
- **`Slider({ label, value, onChange })`** — Reusable 0–100% slider row.

### `src/components/ChapterOverlay.tsx`

- **`ChapterOverlay({ pages, currentPageIndex, onSelect, onClose })`** — A
  virtualized (via `@tanstack/react-virtual`) thumbnail list of all pages for
  quick jumping; highlights the current page and shows per-page panel counts.

### `src/components/PanelEditor.tsx` — manual panel editing

- **`PanelEditor({ page, direction, onSave, onCancel })`** — Full-screen editor
  to add, move, resize, delete and reorder panel rectangles over the page image.
- **`toImg(clientX, clientY)`** — Converts screen coordinates into image-pixel
  coordinates given the current fit transform.
- **`onPointerDownBg(e)`** — Starts drawing a new panel when dragging empty
  space.
- **`startMove(e, p)`** — Begins moving an existing panel.
- **`startResize(e, p, handle)`** — Begins resizing a panel from one of its
  corner handles.
- **`onPointerMove(e)`** — Applies the active draw/move/resize drag, clamping to
  page bounds.
- **`onPointerUp()`** — Finalises a drag; commits a freshly drawn panel (with a
  new id) and discards tiny boxes.
- **`remove(id)`** — Deletes a panel.
- **`autoOrder()`** — Re-derives reading order from current positions.
- **`handleSave()`** — Saves reordered panels back to the page.
- **`orderOf(id)`** — Returns the 1-based reading position of a panel for its
  badge label.
