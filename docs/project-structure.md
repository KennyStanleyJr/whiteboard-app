# Project structure

High-level layout of the repository.

```
whiteboard-app/
├── .nvmrc                    # Node version for nvm (22)
├── docs/                     # Documentation (this site + markdown)
│   ├── .vitepress/           # VitePress config
│   ├── NASA_CODING_GUIDELINES.md
│   ├── index.md
│   └── project-structure.md
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
│   ├── api/                  # Boards and whiteboard state (localStorage)
│   │   ├── boards.ts
│   │   └── whiteboard.ts
│   ├── components/          # Canvas, toolbar, selection UI, element renderers
│   │   ├── ui/               # Button, Dialog, Input, Select (Radix-based)
│   │   ├── WhiteboardCanvas.tsx
│   │   ├── WhiteboardToolbar.tsx
│   │   ├── WhiteboardCanvasSvg/   # SVG elements (text, shape, image)
│   │   └── SelectionToolbar/
│   ├── contexts/             # Theme, portal container
│   ├── hooks/                # Pan/zoom, selection, undo/redo, canvas events
│   │   ├── canvas/
│   │   ├── panZoom/
│   │   ├── selection/
│   │   ├── useSingleOpen.ts
│   │   ├── useUndoRedo.ts
│   │   └── useWhiteboard.ts
│   ├── lib/                  # Shared helpers and config
│   │   ├── canvasPreferences.ts
│   │   ├── elementBounds.ts
│   │   ├── optimizeImage.ts
│   │   ├── remapElementIds.ts
│   │   ├── resizeHandles.ts
│   │   ├── sanitizeHtml.ts
│   │   ├── textFormat.ts
│   │   └── utils.ts
│   ├── test/                 # Test setup and utilities
│   ├── types/
│   │   └── whiteboard.ts
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── components.json
└── eslint.config.js
```

## Key directories

| Path | Purpose |
|------|--------|
| `src/api/` | Board and whiteboard CRUD; persistence via `localStorage`. |
| `src/components/` | React components: canvas, toolbars, SVG element renderers, UI primitives. |
| `src/hooks/` | Reusable state and behavior: pan/zoom, selection, undo/redo, single-open menu. |
| `src/lib/` | Pure helpers and app config: bounds, resize handles, sanitization, text format, preferences. |
| `src/contexts/` | React context (theme, portal container). |
| `src/types/` | Shared TypeScript types (e.g. whiteboard elements). |
| `docs/` | Documentation source; built by VitePress into a static site. |

Icons and PWA assets in `public/` are used as-is; replace those files to change the app icon or PWA icons.
