# Whiteboard App

Infinite whiteboard app with **text**, **shapes** (rectangle, ellipse), and **images**. Multiple whiteboards can be created, renamed, and switched; each board has its own canvas with pan/zoom, selection, and undo/redo. Export/import supports single-board JSON and multi-board ZIP. Targets **Windows**, **Mac**, **iPhone**, and **iPad**.

## Features

- **Canvas**: Infinite pannable/zoomable canvas (mouse wheel zoom, right-drag or touch to pan).
- **Elements**: Add and edit text (with formatting and alignment), rectangles, ellipses, and images; resize and reposition via selection handles.
- **Selection**: Click to select; selection toolbar for font size, color, alignment, and shape fill/stroke.
- **Undo/redo**: Bounded history per board (keyboard shortcuts supported).
- **Boards**: Create, rename, delete, and switch between multiple whiteboards; state persisted in `localStorage`.
- **Import/export**: Download a single board as JSON or all boards as a ZIP; import from `.json` or `.zip` files.

## Tech Stack

- **Language**: **TypeScript** (strict mode)
- **UI**: **React 18**
- **Build**: **Vite 5**
- **Styling**: **Tailwind CSS 4**
- **State**: **TanStack React Query** (whiteboard state), `localStorage` (boards + per-board state)
- **Components**: **Radix UI**, **Lucide** icons, **react-colorful**
- **Lint**: **ESLint 9** (flat config, type-checked, max-warnings 0)
- **Tests**: **Vitest**, **Testing Library**

### Why TypeScript + React + Vite?

- **One codebase** for web and (later) desktop/mobile wrappers.
- **Web-first**: runs in any browser on Windows, Mac, iPhone, iPad; can be wrapped with Electron/Tauri for desktop and Capacitor or PWA for iOS.
- **TypeScript strict** and **ESLint zero-warnings** align with NASA-style “zero warnings” and explicit checks.
- **Vite** gives fast dev and production builds.

Future options: **Electron** or **Tauri** for Windows/Mac; **Capacitor** or **PWA** for iPhone/iPad.

## NASA Coding Guidelines

This project follows principles from **NASA's Power of 10** (JPL) and **SWE-061**, adapted for TypeScript/React. See **[docs/NASA_CODING_GUIDELINES.md](docs/NASA_CODING_GUIDELINES.md)** for the full list and how we apply them (e.g. small functions, bounded logic, strict types, zero lint/compile warnings).

## Setup

```bash
npm install
```

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start dev server (Vite) |
| `npm run build` | TypeScript check + production build |
| `npm run lint` | ESLint (zero warnings) |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests in watch mode (Vitest) |
| `npm run test:run` | Run tests once |
| `npm run test:ui` | Vitest UI |
| `npm run ci` | Lint + test + build (CI pipeline) |

## Project Structure

```
whiteboard-app/
├── docs/
│   └── NASA_CODING_GUIDELINES.md
├── public/
│   └── favicon.svg
├── src/
│   ├── api/              # Boards and whiteboard state (localStorage)
│   │   ├── boards.ts
│   │   └── whiteboard.ts
│   ├── components/       # Canvas, toolbar, selection UI, element renderers
│   │   ├── ui/           # Button, Dialog, Input, Select (Radix-based)
│   │   ├── WhiteboardCanvas.tsx
│   │   ├── WhiteboardToolbar.tsx
│   │   ├── WhiteboardCanvasSvg/  # SVG elements (text, shape, image)
│   │   └── SelectionToolbar/
│   ├── hooks/            # Pan/zoom, selection, undo/redo, canvas events
│   │   ├── canvas/
│   │   ├── panZoom/
│   │   ├── selection/
│   │   ├── useUndoRedo.ts
│   │   └── useWhiteboard.ts
│   ├── lib/
│   │   └── utils.ts
│   ├── test/             # Test setup and utilities
│   ├── types/
│   │   └── whiteboard.ts
│   ├── utils/            # Bounds, resize handles, sanitize, text format
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── components.json
└── eslint.config.js
```

## License

Private / unlicensed unless otherwise specified.
