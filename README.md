# Whiteboard App

Infinite whiteboard app powered by **[Excalidraw](https://excalidraw.com)** (MIT licensed). One codebase for web (and later desktop/mobile via Electron, Tauri, or PWA).

## Tech Stack

- **Excalidraw** – Infinite canvas, shapes, drawing (MIT open source)
- **React 19** + **TypeScript** (strict)
- **Vite 7**
- **vite-plugin-pwa** – Offline support, installable PWA (manifest + service worker)
- **ESLint 9** (flat config, type-checked, max-warnings 0)

## PWA

The app is a **Progressive Web App**: users can install it from the browser (Chrome “Install app”, Safari “Add to Home Screen”) and use it offline. The service worker caches assets and updates automatically when you deploy. Icons and manifest are in `public/`; the build outputs `sw.js`, `manifest.webmanifest`, and the registration script.

## Requirements

- **Node.js** `>=20` (see `package.json` engines). Use [nvm](https://github.com/nvm-sh/nvm) with the included `.nvmrc`: `nvm use`.

## Setup

```bash
npm install
npm run dev
```

### Cloud storage (Supabase)

Optional: save and load whiteboards in the cloud with a name and optional password.

1. Create a [Supabase](https://supabase.com) project.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Run the migrations in the Supabase SQL editor in order: `supabase/migrations/20250210000000_create_whiteboards.sql`, then `20250210000001_whiteboards_name_length.sql`.

Then use **Save to cloud** and **Load from cloud** in the main menu. Without Supabase env vars, those menu items show a setup hint.

**Security:** Passwords are hashed with bcrypt (client-side) before storage; only the hash is sent. The anon key is public by design; RLS currently allows any anonymous user to list, save, and load. Use password protection on sensitive boards. For production multi-tenant use, switch to Supabase Auth and RLS policies that scope rows by user.

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
│   ├── App.tsx               # Excalidraw full-screen editor
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
