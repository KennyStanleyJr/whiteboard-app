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
- **PWA**: **vite-plugin-pwa** (offline support, installable app)
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

This project follows principles from **NASA's Power of 10** (JPL) and **SWE-061**, adapted for TypeScript/React. See **[docs/nasa-coding-guidelines.md](docs/nasa-coding-guidelines.md)** for the full list and how we apply them (e.g. small functions, bounded logic, strict types, zero lint/compile warnings).

## Requirements

- **Node.js** `>=22` (see `package.json` engines). Use [nvm](https://github.com/nvm-sh/nvm) with the included `.nvmrc`: `nvm use`.

## Setup

```bash
npm install
npm run dev
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
| `npm run docs:build` | Build documentation into `public/docs` (runs automatically before `dev` and `build`) |
| `npm run docs:dev` | Run docs dev server only (for editing docs with live reload) |
| `npm run docs:preview` | Preview built documentation site standalone |

## Documentation

Project documentation (project structure, NASA coding guidelines, and overview) is built with **VitePress** and served at **`/docs`** in both dev and production. Open `/docs` or `/docs/` in the browser to view it.

- **Dev**: `npm run dev` builds docs into `public/docs` and starts the app; open [http://localhost:5173/docs/](http://localhost:5173/docs/).
- **Production**: `npm run build` includes the docs; deploy the `dist/` folder and `/docs/` will be available.
- To edit docs with live reload, run `npm run docs:dev` in a separate terminal.

## Project structure

```
whiteboard-app/
├── .nvmrc                    # Node version for nvm (22)
├── docs/                     # Documentation (VitePress site source)
│   ├── .vitepress/           # VitePress config
│   ├── nasa-coding-guidelines.md
│   ├── project-structure.md
│   └── index.md
├── public/                   # Static assets (icons, favicon, robots.txt)
│   ├── favicon.svg
│   ├── favicon.ico
│   ├── apple-touch-icon-180x180.png
│   ├── pwa-64x64.png
│   ├── pwa-192x192.png
│   ├── pwa-512x512.png
│   ├── maskable-icon-512x512.png
│   └── robots.txt
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
│   ├── contexts/        # Theme, portal container
│   ├── hooks/           # Pan/zoom, selection, undo/redo, canvas events
│   │   ├── canvas/
│   │   ├── panZoom/
│   │   ├── selection/
│   │   ├── useSingleOpen.ts
│   │   ├── useUndoRedo.ts
│   │   └── useWhiteboard.ts
│   ├── lib/             # Shared helpers and config (bounds, sanitize, etc.)
│   ├── test/            # Test setup and utilities
│   ├── types/
│   │   └── whiteboard.ts
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

Icons and PWA assets in `public/` are used as-is; replace those files to change the app icon or PWA icons.

## License

Private / unlicensed unless otherwise specified.
