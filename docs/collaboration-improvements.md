# Smoother Real-Time Collaboration

This document outlines options to improve concurrent editing when two people edit the same shared page.

## Current State

The app uses **tldraw Sync** when `VITE_SYNC_SERVER_URL` is configured: clients connect via WebSocket, the sync server persists to Supabase, and real-time collaboration works. Without the sync server, shared pages use **Supabase-only** (full-page snapshots, last-write-wins, 2s debounce).

## Option A: tldraw Sync + Supabase (Implemented)

**Best for:** Real-time collaboration and conflict-free merging.

### How it works

- `sync-server/` (WebSocket) relays edits between clients; `InMemorySyncStorage` `onChange` persists to Supabase.
- Clients use `useSync({ uri: 'wss://...' })` when viewing a shared page (i.e. `?p=ID` in URL).
- Local-only pages stay in localStorage.

### Resources

- [tldraw sync docs](https://tldraw.dev/docs/sync)
- [Simple server example](https://github.com/tldraw/tldraw/tree/main/templates/simple-server-example) (Node + SQLite; can swap storage for Supabase)
- [Cloudflare template](https://github.com/tldraw/tldraw-sync-cloudflare) (Durable Objects + R2)

---

## Option B: Yjs + Supabase (y-supabase)

**Best for:** Staying in Supabase-only, no separate sync server.

### Overview

- [y-supabase](https://github.com/AlexDunmow/y-supabase): Yjs provider that stores docs in Supabase and uses Realtime.
- CRDT-based, conflict-free merging.
- **Caveat**: y-supabase is early stage; tldraw–Yjs integration would need custom work (tldraw store ↔ Y.Doc binding).

### Storage

- Store Yjs binary/state in a Supabase column (e.g. `shared_pages.document`).
- Use Supabase Realtime for live updates.

---

## Option C: Per-Shape Sync (Incremental)

**Best for:** Staying on tldraw v3 and Supabase, with minimal new infra.

### Idea

- Store **individual records** (shapes, bindings, assets) instead of full-page snapshots.
- Use Supabase Realtime to broadcast per-record updates.
- Merge at the **record level**: last-write-wins per shape ID.
- Reduce debounce (e.g. 500ms) for faster propagation.

### Pros

- No tldraw upgrade.
- No sync server.
- Uses existing Supabase setup.

### Cons

- Still last-write-wins per shape (two people editing the same shape can conflict).
- More complex merge logic and migration from current snapshot format.

---

## Summary

| Option | Smoothness | Effort | Infra |
|--------|------------|--------|-------|
| **A: tldraw Sync** | Best (CRDT-like) | High (upgrade + server) | Sync server + Supabase |
| **B: Yjs + Supabase** | Best | Very high (custom binding) | Supabase only |
| **C: Per-shape** | Better than current | Medium | Supabase only |

**Recommendation:** Use **Option A** if you can host a sync server and upgrade to tldraw v4. Use **Option C** if you want to improve collaboration without changing infra or tldraw version.
