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
