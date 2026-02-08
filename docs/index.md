# Whiteboard App

Infinite whiteboard app with **text**, **shapes** (rectangle, ellipse), and **images**. Multiple whiteboards can be created, renamed, and switched; each board has its own canvas with pan/zoom, selection, and undo/redo. Export/import supports single-board JSON and multi-board ZIP. Targets **Windows**, **Mac**, **iPhone**, and **iPad**.

## Features

- **Canvas**: Infinite pannable/zoomable canvas (mouse wheel zoom, right-drag or touch to pan).
- **Elements**: Add and edit text (with formatting and alignment), rectangles, ellipses, and images; resize and reposition via selection handles.
- **Selection**: Click to select; selection toolbar for font size, color, alignment, and shape fill/stroke.
- **Undo/redo**: Bounded history per board (keyboard shortcuts supported).
- **Boards**: Create, rename, delete, and switch between multiple whiteboards; state persisted in `localStorage`.
- **Import/export**: Download a single board as JSON or all boards as a ZIP; import from `.json` or `.zip` files.

## Tech stack

- **Language**: TypeScript (strict mode)
- **UI**: React 18
- **Build**: Vite 5
- **Styling**: Tailwind CSS 4
- **PWA**: vite-plugin-pwa (offline support, installable app)
- **State**: TanStack React Query (whiteboard state), `localStorage` (boards + per-board state)
- **Components**: Radix UI, Lucide icons, react-colorful
- **Lint**: ESLint 9 (flat config, type-checked, max-warnings 0)
- **Tests**: Vitest, Testing Library

## Quick start

```bash
npm install
npm run dev
```

See the [Project structure](/project-structure) page for folder layout and the [NASA Coding Guidelines](/nasa-coding-guidelines) for coding standards used in this project.
