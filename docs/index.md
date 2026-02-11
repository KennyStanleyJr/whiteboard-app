# Whiteboard App

Infinite whiteboard app powered by **[tldraw](https://tldraw.dev)**. One codebase for web (and later desktop/mobile via Electron, Tauri, or PWA).

## Features

- **Canvas**: Infinite canvas with shapes, drawing, text, images; pan and zoom.
- **Theme**: Dark/light mode (default dark); theme syncs to page background and PWA chrome.
- **Persistence**: Use tldraw’s `persistenceKey` prop to save to IndexedDB (optional).

## Tech stack

- **tldraw** – Infinite canvas, shapes, drawing, text, images, zoom, pan, undo/redo
- **React 19** + **TypeScript** (strict)
- **Vite 7**
- **vite-plugin-pwa** – Offline support, installable PWA (manifest + service worker)
- **ESLint 9** (flat config, type-checked, max-warnings 0)

## Quick start

```bash
npm install
npm run dev
```

See the [Project structure](/project-structure) page for folder layout and the [NASA Coding Guidelines](/nasa-coding-guidelines) for coding standards used in this project.
