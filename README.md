# Whiteboard App

Infinite whiteboard app powered by **[tldraw](https://tldraw.dev)**. One codebase for web (and later desktop/mobile via Electron, Tauri, or PWA).

## Tech Stack

- **tldraw** – Infinite canvas, shapes, drawing, text, images, zoom, pan, undo/redo
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
│   ├── App.tsx               # tldraw full-screen editor
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── eslint.config.js
```

## Share Pages (Supabase)

The **Share page** menu item saves the **current page only** to Supabase and copies a shareable URL. To enable:

1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env` (see `.env.example`).
2. Run the SQL in `supabase/migrations/0001_shared_pages.sql` in your Supabase project's SQL Editor (Dashboard → SQL Editor).

Links use the format `https://yoursite.com/?p=SHARE_ID`. Visiting a shared link opens that content as a **new page** (local storage is not overwritten). The URL updates when you switch pages: **shared pages** show `?p=ID` (edits sync), **local pages** do not. Both Share page and sync use the current page only. If you ran the migration before the update policy was added, run `supabase/migrations/0002_shared_pages_update_policy.sql` as well.

**Real-time collaboration** requires the sync server. Add `VITE_SYNC_SERVER_URL` and deploy the `sync-server/` (see below). Without it, shared links show a connection error.

### Deploying the sync server

The sync server enables smooth real-time collaboration. Deploy it to **Render** (or any Node host):

1. In Render: **New → Web Service**. Connect your repo and set:
   - **Root Directory**: `sync-server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (same values as the frontend’s `VITE_*` vars)

2. After deploy, set `VITE_SYNC_SERVER_URL` to your service URL (e.g. `wss://whiteboard-sync.onrender.com`). Use `wss://` for HTTPS sites.

3. Share page → the app navigates to the shared URL and uses tldraw sync for real-time editing. **Two separate machines** (different devices) opening the same share link both connect to the sync server and collaborate in real time.

## NASA Coding Guidelines

This project follows principles from **NASA's Power of 10** (JPL) and **SWE-061**, adapted for TypeScript/React. See **[docs/nasa-coding-guidelines.md](docs/nasa-coding-guidelines.md)** for details.

## License

Private / unlicensed unless otherwise specified.
