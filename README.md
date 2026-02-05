# Whiteboard App

Infinite whiteboard app for text, images, videos, links, post-it notes, and arrows. Includes a menu to manage whiteboards. Targets **Windows**, **Mac**, **iPhone**, and **iPad**.

## Tech Stack

- **Language**: **TypeScript** (strict mode)
- **UI**: **React 18**
- **Build**: **Vite 5**
- **Lint**: **ESLint 9** (flat config, type-checked, max-warnings 0)

### Why TypeScript + React + Vite?

- **One codebase** for web and (later) desktop/mobile wrappers.
- **Web-first**: runs in any browser on Windows, Mac, iPhone, iPad; can be wrapped with Electron/Tauri for desktop and Capacitor or PWA for iOS.
- **TypeScript strict** and **ESLint zero-warnings** align with NASA-style “zero warnings” and explicit checks.
- **Vite** gives fast dev and production builds.

Future options: **Electron** or **Tauri** for Windows/Mac; **Capacitor** or **PWA** for iPhone/iPad.

## NASA Coding Guidelines

This project follows principles from **NASA’s Power of 10** (JPL) and **SWE-061**, adapted for TypeScript/React. See **[docs/NASA_CODING_GUIDELINES.md](docs/NASA_CODING_GUIDELINES.md)** for the full list and how we apply them (e.g. small functions, bounded logic, strict types, zero lint/compile warnings).

## Setup

```bash
npm install
```

## Scripts

| Command   | Description                    |
|----------|--------------------------------|
| `npm run dev`     | Start dev server (Vite)       |
| `npm run build`   | TypeScript check + production build |
| `npm run lint`    | ESLint (zero warnings)        |
| `npm run preview` | Preview production build      |

## Project Structure

```
whiteboard-app/
├── docs/
│   └── NASA_CODING_GUIDELINES.md
├── public/
├── src/
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── eslint.config.js
```

## License

Private / unlicensed unless otherwise specified.
