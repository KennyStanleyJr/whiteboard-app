# Whiteboard App

Infinite whiteboard app powered by **[tldraw](https://tldraw.dev)**. One codebase for web (and later desktop/mobile via Electron, Tauri, or PWA).

## Tech Stack

- **tldraw** – Infinite canvas, shapes, drawing, text, images, zoom, pan, undo/redo
- **XState v5** + **@xstate/react** – State machine for sync lifecycle
- **React 19** + **TypeScript** (strict)
- **Supabase** – Shared page persistence
- **@tldraw/sync** – Real-time collaboration via WebSocket sync server
- **Vite 7**
- **vite-plugin-pwa** – Offline support, installable PWA (manifest + service worker)
- **ESLint 9** (flat config, type-checked, max-warnings 0)

## Architecture

All sync logic lives in a single XState state machine (`src/machine.ts`). React components read derived state and send events — nothing else owns transition logic.

### State machine

```
local ──ENTER_SHARED──▸ shared.connecting
                              │
                    SUPABASE_CONNECTED ──▸ shared.supabaseSync ◂──SERVER_DISCONNECTED──┐
                    SUPABASE_FAILED ──▸ shared.offline                                 │
                                              │                                        │
                                    SERVER_CONNECTED ──▸ shared.serverSync ─────────────┘
                                    SUPABASE_DISCONNECTED ──▸ shared.connecting
                                              
shared.offline ──RETRY──▸ shared.connecting
shared.* ──LEAVE_SHARED──▸ local
```

| State | Meaning |
|-------|---------|
| `local` | Editing a local-only page |
| `shared.connecting` | Fetching shared page data from Supabase |
| `shared.supabaseSync` | Syncing via throttled Supabase writes |
| `shared.serverSync` | Syncing via WebSocket (real-time collaboration) |
| `shared.offline` | Shared page with no connection (read-only) |

### Data flow

1. **Canvas loads immediately** from `localStorage` — no loading screen.
2. **Supabase singleton** initialises in the background.
3. **localStorage is always written** on every store change (throttled, camera excluded).
4. **Cross-tab merge** only applies when the tab is **not focused** (avoids fighting with active edits).
5. **Shared pages** are read-only until sync confirms connectivity (`supabaseSync` or `serverSync`).
6. When on a shared page, the app defaults to Supabase sync, then **upgrades** to server sync if the sync server is available.

### Key files

```
src/
├── machine.ts             # XState state machine + derived helpers
├── MachineContext.tsx      # React context for machine state/send
├── App.tsx                 # Main component: hooks, Tldraw, sync bridges
├── persistence.ts          # localStorage: snapshot, share map, theme, URL utils
├── supabase.ts             # Supabase singleton + CRUD for shared pages
├── sharePage.ts            # Pure document utilities (hashing, remapping, extraction)
├── ConnectionIndicator.tsx # Sync status dot + text (always visible)
├── CustomPageMenu.tsx      # Page menu with share-link buttons
├── ExportMenu.tsx          # Export/import JSON, share-page creation
├── SyncThemeToDocument.tsx  # Syncs tldraw theme preference to localStorage
├── ErrorBoundary.tsx       # React error boundary
├── pasteJson.ts            # Paste-from-JSON action override
├── rightClickPan.ts        # Right-click pan behaviour
├── shiftScrollPan.ts       # Shift+scroll pan behaviour
├── themeUtils.ts            # Theme helper re-exports
├── main.tsx                # Entry point
├── index.css               # Global styles
└── vite-env.d.ts           # Vite type declarations
```

## PWA

The app is a **Progressive Web App**: users can install it from the browser (Chrome "Install app", Safari "Add to Home Screen") and use it offline. The service worker caches assets and updates automatically when you deploy. Icons and manifest are in `public/`; the build outputs `sw.js`, `manifest.webmanifest`, and the registration script.

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

## Shared Pages (Supabase)

The **Share page** menu item saves the **current page only** to Supabase and copies a shareable URL. To enable:

1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env` (see `.env.example`).
2. Run the SQL in `supabase/migrations/0001_shared_pages.sql` in your Supabase project's SQL Editor (Dashboard → SQL Editor).

Links use the format `https://yoursite.com/?p=SHARE_ID`. Visiting a shared link loads the remote content and merges it into the local store. The URL updates when you switch pages: **shared pages** show `?p=ID`, **local pages** do not. If you ran the migration before the update policy was added, run `supabase/migrations/0002_shared_pages_update_policy.sql` as well.

### Connection indicator

The connection indicator is always visible in the top-left menu bar:

| State | Dot | Text |
|-------|-----|------|
| Local page | Gray | "local" |
| Supabase sync | Green | "synced" |
| Server sync | Blue | "connected" |
| Connecting | Yellow | "connecting..." |
| Error / offline | Red | "error" (click to retry) |

### Real-time collaboration (sync server)

Without the sync server, shared pages sync via **throttled Supabase writes** (supabaseSync). Adding a sync server upgrades to **real-time WebSocket collaboration** (serverSync). The machine handles the upgrade automatically — if the server connects, it switches from supabaseSync to serverSync; if the server disconnects, it falls back to supabaseSync.

#### Deploying the sync server

Deploy the `sync-server/` to **Render** (or any Node host):

1. In Render: **New → Web Service**. Connect your repo and set:
   - **Root Directory**: `sync-server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (same values as the frontend's `VITE_*` vars)

2. After deploy, set `VITE_SYNC_SERVER_URL` to your service URL (e.g. `wss://whiteboard-sync.onrender.com`). Use `wss://` for HTTPS sites.

3. Share a page → the app connects to the sync server for real-time editing. Two separate devices opening the same share link collaborate in real time.

## NASA Coding Guidelines

This project follows principles from **NASA's Power of 10** (JPL) and **SWE-061**, adapted for TypeScript/React. See **[docs/nasa-coding-guidelines.md](docs/nasa-coding-guidelines.md)** for details.

## License

Private / unlicensed unless otherwise specified.
