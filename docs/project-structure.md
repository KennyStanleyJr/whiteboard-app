# Project structure

High-level layout of the repository.

```
whiteboard-app/
├── .nvmrc                    # Node version for nvm (>=20)
├── docs/                     # Documentation (VitePress) – optional
│   ├── .vitepress/           # VitePress config
│   ├── index.md
│   ├── nasa-coding-guidelines.md
│   └── project-structure.md
├── public/                   # Static assets (icons, favicon, robots.txt, _redirects)
│   ├── favicon.svg
│   ├── favicon.ico
│   ├── apple-touch-icon-180x180.png
│   ├── pwa-64x64.png
│   ├── pwa-192x192.png
│   ├── pwa-512x512.png
│   ├── maskable-icon-512x512.png
│   ├── robots.txt
│   └── _redirects
├── src/
│   ├── App.tsx               # tldraw full-screen editor, default dark theme, theme sync
│   ├── SyncThemeToDocument.tsx  # Syncs tldraw theme to page background and PWA theme-color
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── eslint.config.js
```

## Key paths

| Path | Purpose |
|------|--------|
| `src/App.tsx` | Root component: `<Tldraw>` with license key, default dark theme, and `<SyncThemeToDocument>` child. |
| `src/SyncThemeToDocument.tsx` | Syncs tldraw dark/light mode to `--app-bg` and `<meta name="theme-color">` (no separate storage). |
| `public/` | PWA icons, favicon, robots.txt; served as-is. |
| `docs/` | VitePress documentation source; build outputs a static site. |
