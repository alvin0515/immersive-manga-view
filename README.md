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

1. On load, sample manga pages are generated automatically (or you upload your
   own).
2. Each page is analysed in the browser to find its panels.
3. The reader guides you panel-by-panel with a film-style camera — zooming,
   panning and spotlighting one panel at a time. Your place is saved
   automatically.

## Using the app

### Reading

The reader focuses one panel at a time and moves the camera as you advance.
Move forward or back using any of these:

- **Keyboard:** `→` / `↓` / `Space` to advance, `←` / `↑` to go back.
- **Mouse:** scroll down/up, or click to advance.
- **Touch:** swipe left/right, or tap to advance.

When you reach the last panel on a page, the next action moves to the next page
automatically.

### Toolbar (top-right)

Move the mouse to reveal the controls; they auto-hide while you read.

- **☰ Chapter** — Open a thumbnail list of all pages and jump to any of them.
- **✎ Edit panels** — Manually add, move, resize, delete and reorder panels on
  the current page.
- **⬆ Upload pages** — Load your own page images (PNG / JPEG / WebP).
- **⤢ Reset view** — Zoom out to see the whole page (overview).
- **⛶ Fullscreen** — Toggle fullscreen mode.
- **⚙ Settings** — Open the cinematic settings panel.

### Settings

- **Reduce motion** — Instant cuts instead of animation (accessibility).
- **Animation intensity** — Strength of zoom, parallax and effects.
- **Dim non-active** — How strongly the rest of the page is dimmed.
- **Parallax depth** — Subtle camera drift that follows the pointer.
- **Reading direction** — Left → Right or Right → Left (manga).
- **Genre effects** — `neutral`, `action`, `romance` or `horror` mood and
  pacing.

### Editing panels

Open the editor with **✎** (or `E`). Drag empty space to draw a new panel, drag
a panel to move it, use the corner handles to resize, and the **✕** on a panel
to delete it. **Auto-order** re-numbers panels into reading order, then **Save**
applies your changes (or **Cancel** to discard).

### Keyboard shortcuts

| Key            | Action               |
| -------------- | -------------------- |
| `→` `↓` `Space`| Next panel / page    |
| `←` `↑`        | Previous panel / page|
| `R`            | Reset to page overview |
| `F`            | Toggle fullscreen    |
| `C`            | Chapter list         |
| `E`            | Edit panels          |
| `S`            | Settings             |
| `Esc`          | Close overlay / editor |

### Saved progress

Your current page and panel are stored in the browser, so reopening the app
returns you to where you left off.
