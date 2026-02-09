# Whiteboard App

Infinite whiteboard app powered by the **[tldraw](https://tldraw.dev)** SDK. One codebase for web (and later desktop/mobile via Electron, Tauri, or PWA).

## Tech Stack

- **tldraw** – Infinite canvas, shapes, drawing, and collaboration primitives
- **React 19** + **TypeScript** (strict)
- **Vite 7**
- **ESLint 9** (flat config, type-checked, max-warnings 0)

## Requirements

- **Node.js** `>=20` (see `package.json` engines). Use [nvm](https://github.com/nvm-sh/nvm) with the included `.nvmrc`: `nvm use`.

## Setup

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | TypeScript check + production build |
| `npm run lint` | ESLint (zero warnings) |
| `npm run preview` | Preview production build |

## Project structure

```
whiteboard-app/
├── .nvmrc
├── docs/                     # Documentation (VitePress) – optional
├── public/                   # Static assets
├── src/
│   ├── App.tsx               # Tldraw full-screen editor
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── eslint.config.js
```

## NASA Coding Guidelines

This project follows principles from **NASA's Power of 10** (JPL) and **SWE-061**, adapted for TypeScript/React. See **[docs/nasa-coding-guidelines.md](docs/nasa-coding-guidelines.md)** for details.

## License

Private / unlicensed unless otherwise specified.
