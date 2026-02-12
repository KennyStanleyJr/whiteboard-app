/**
 * Whiteboard App — state-machine architecture.
 *
 * Data flow:
 *   1. Canvas loads immediately from localStorage (no loading screen).
 *   2. Supabase singleton initializes in the background.
 *   3. The XState machine manages sync lifecycle:
 *        local → shared.connecting → shared.supabaseSync ⇄ shared.serverSync
 *   4. localStorage is ALWAYS written on every store change.
 *   5. Cross-tab merge only happens when the tab is NOT focused.
 *   6. Shared pages are read-only until sync confirms connectivity.
 *
 * Everything outside the machine just reads derived state and sends events.
 */

import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import type { TLPageId } from '@tldraw/tlschema'
import {
	createTLStore,
	getSnapshot,
	loadSnapshot,
	Tldraw,
	DefaultMenuPanel,
	TLINSTANCE_ID,
	inlineBase64AssetStore,
	type TLStore,
} from 'tldraw'
import { useSync } from '@tldraw/sync'
import { useMachine } from '@xstate/react'
import 'tldraw/tldraw.css'

import {
	whiteboardMachine,
	isEditable,
	isSharedPage,
	shouldRunSupabaseSync,
	shouldRunServerSync,
	shouldAttemptServerConnection,
	isServerSynced,
	isConnecting as machineIsConnecting,
	type WhiteboardEvent,
} from './machine'
import { initSupabase, isSupabaseConfigured, loadSharedPage, saveSharedPage } from './supabase'
import {
	loadSnapshot as loadStorageSnapshot,
	saveSnapshot as saveStorageSnapshot,
	getShareIdFromUrl,
	setShareIdInUrl,
	clearShareIdFromUrl,
	getShareIdForPage,
	setShareIdForPage,
	getPageIdForShareId,
	getTheme,
	SNAPSHOT_KEY,
	throttle,
	THROTTLE_MS,
} from './persistence'
import {
	buildSyncUri,
	docContentEqual,
	docStoreHash,
	getContentAsJsonDocForPage,
	getFirstPageIdFromStore,
	getPageDocumentFromStore,
	getPageRecordIds,
	isSyncServerConfigured,
	remapDocumentPageId,
	remapIdInValue,
	type ShareSnapshot,
} from './sharePage'
import type { IndexKey } from '@tldraw/utils'
import { getIndexAbove, sortByIndex } from '@tldraw/utils'
import { CustomContextMenu, CustomMainMenu } from './ExportMenu'
import { CustomPageMenu } from './CustomPageMenu'
import { useEditor } from '@tldraw/editor'
import { createPasteActionOverride } from './pasteJson'
import { setupRightClickPan } from './rightClickPan'
import { ConnectionIndicator, ConnectionIndicatorProvider } from './ConnectionIndicator'
import { SyncThemeToDocument } from './SyncThemeToDocument'
import type { SnapshotFrom } from 'xstate'
import { MachineCtx } from './MachineContext'

// ── Constants ──────────────────────────────────────────────────────────────────

const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY ?? undefined
const SYNC_APPLY_IDLE_MS = 400
const SERVER_RETRY_INTERVAL_MS = 10_000
const SUPABASE_POLL_MS = 3_000

// ── Types ──────────────────────────────────────────────────────────────────────

type MachineState = SnapshotFrom<typeof whiteboardMachine>
type Send = (event: WhiteboardEvent) => void

// ── Grid-mode per-page tracking ────────────────────────────────────────────────

type GridRef = { m: Map<string, boolean>; prev: { pageId: string; isGridMode: boolean } | null }
type SnapshotParsed = Parameters<typeof loadSnapshot>[1]

function syncGridRef(
	inst: { currentPageId: string; isGridMode: boolean },
	gridRef: React.MutableRefObject<GridRef>,
	store: TLStore
): void {
	const p = gridRef.current.prev
	if (p && inst.currentPageId !== p.pageId) {
		const g = gridRef.current.m.get(inst.currentPageId) ?? false
		store.update(TLINSTANCE_ID, (i) => ({ ...i, isGridMode: g }))
		gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: g }
	} else if (p && inst.isGridMode !== p.isGridMode) {
		gridRef.current.m.set(inst.currentPageId, inst.isGridMode)
		gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: inst.isGridMode }
	} else if (!p) {
		gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: inst.isGridMode }
	}
}

function applyParsedSnapshot(
	store: TLStore,
	parsed: SnapshotParsed,
	gridRef: React.MutableRefObject<GridRef>,
	opts?: { preserveSession?: boolean }
): void {
	const full = parsed as {
		document?: { store?: Record<string, unknown> }
		session?: { pageStates?: Array<{ pageId: string; isGridMode?: boolean }> }
	}
	const states = full.session?.pageStates ?? []
	for (const ps of states) {
		if (typeof ps.isGridMode === 'boolean') gridRef.current.m.set(ps.pageId, ps.isGridMode)
	}
	for (const ps of states) delete (ps as { pageId: string; isGridMode?: boolean }).isGridMode
	const toLoad = (opts?.preserveSession && full.document
		? { document: full.document }
		: parsed) as SnapshotParsed
	loadSnapshot(store, toLoad, { forceOverwriteSessionState: !opts?.preserveSession })
	const inst = store.get(TLINSTANCE_ID) as
		| { currentPageId: string; isGridMode: boolean }
		| undefined
	if (inst) {
		// When preserving session, currentPageId may not exist in the loaded document
		// (e.g. cross-tab: other tab had only shared page). Switch to first page.
		if (opts?.preserveSession && full.document?.store) {
			const docStore = full.document.store
			const pageExists =
				inst.currentPageId &&
				(docStore[inst.currentPageId] as { typeName?: string })?.typeName === 'page'
			if (!pageExists) {
				const firstPageId = getFirstPageIdFromStore({ store: docStore })
				if (firstPageId) {
					const g = gridRef.current.m.get(firstPageId) ?? false
					store.update(TLINSTANCE_ID, (i) => ({
						...i,
						currentPageId: firstPageId as TLPageId,
						isGridMode: g,
					}))
					gridRef.current.prev = { pageId: firstPageId, isGridMode: g }
					return
				}
			}
		}
		const g = gridRef.current.m.get(inst.currentPageId) ?? false
		store.update(TLINSTANCE_ID, (i) => ({ ...i, isGridMode: g }))
		gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: g }
	}
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

/**
 * Watches the store's current page and synchronizes machine events.
 *
 * Two responsibilities, cleanly separated:
 *   1. useLayoutEffect — on mount, read URL ?p= and send ENTER_SHARED.
 *   2. useEffect       — on page *change*, update URL and send events.
 *
 * The useEffect never re-reads the URL to override the store; it only
 * reacts to currentPageId changes.  This prevents the race where the
 * initial check() sees the localStorage page before the merge completes.
 */
function usePageTracker(store: TLStore, send: Send) {
	const sendRef = useRef(send)
	sendRef.current = send
	const prevShareId = useRef<string | null>(null)

	// ① Mount: if URL has ?p=shareId, send ENTER_SHARED immediately.
	useLayoutEffect(() => {
		const shareIdFromUrl = getShareIdFromUrl()
		if (!shareIdFromUrl) return
		const pageId = getPageIdForShareId(shareIdFromUrl) ?? ''
		if (pageId) {
			try {
				store.update(TLINSTANCE_ID, (i) => ({ ...i, currentPageId: pageId as TLPageId }))
			} catch {
				/* page may not exist in store yet */
			}
		}
		prevShareId.current = shareIdFromUrl
		sendRef.current({ type: 'ENTER_SHARED', shareId: shareIdFromUrl, pageId })
	}, [store])

	// ② React to page changes in the store.
	useEffect(() => {
		// Seed with current page so first listener call only fires on a real change.
		const inst = store.get(TLINSTANCE_ID) as { currentPageId?: string } | undefined
		const prevPageIdRef = { current: inst?.currentPageId ?? '' }

		const onPageChange = (): void => {
			const cur = store.get(TLINSTANCE_ID) as { currentPageId?: string } | undefined
			if (!cur?.currentPageId) return
			const pageId = cur.currentPageId
			if (prevPageIdRef.current === pageId) return
			prevPageIdRef.current = pageId

			const shareId = getShareIdForPage(pageId)
			if (shareId) {
				setShareIdInUrl(shareId)
				if (prevShareId.current !== shareId) {
					prevShareId.current = shareId
					sendRef.current({ type: 'ENTER_SHARED', shareId, pageId })
				}
			} else {
				clearShareIdFromUrl()
				if (prevShareId.current) {
					prevShareId.current = null
					sendRef.current({ type: 'LEAVE_SHARED' })
				}
			}
		}

		// If useLayoutEffect already handled a URL share, skip the initial sync.
		// The merge will update currentPageId, which fires the listener.
		// Otherwise, sync now (e.g. localStorage loaded a shared page with no URL).
		if (!prevShareId.current) onPageChange()

		return store.listen(onPageChange)
	}, [store])
}

/**
 * Persistence — always active.
 * Saves the store to localStorage on every change (throttled).
 * Merges from localStorage on tab-focus when another tab has written.
 * Skip merge for shared pages (they get updates from sync, not localStorage).
 */
function usePersistence(
	store: TLStore,
	gridRef: React.MutableRefObject<GridRef>,
	machineStateRef: React.MutableRefObject<MachineState>
) {
	// Save on every store change (throttled).
	// Skip writes during `connecting` — the store has potentially stale shared-
	// page data from localStorage and we don't want to broadcast it to other
	// tabs before the authoritative Supabase fetch completes.
	// Uses a dirty flag so we never serialize unless the store actually changed.
	useEffect(() => {
		let dirty = true // true initially so first tick always saves
		const markDirty = (): void => { dirty = true }

		const persist = (): void => {
			if (!dirty) return
			if (machineIsConnecting(machineStateRef.current)) return
			try {
				// Sync grid-mode tracking (read-only; update only if page changed)
				const inst = store.get(TLINSTANCE_ID) as
					| { currentPageId: string; isGridMode: boolean }
					| undefined
				if (inst) syncGridRef(inst, gridRef, store)

				// Single snapshot — 'all' gives us document + session
				const rawSnapshot = store.getStoreSnapshot('all') as {
					store: Record<string, unknown>
					schema: unknown
				}
				const storeObj = rawSnapshot.store ?? {}

				// Filter cameras + build session with grid-mode in one pass
				const filtered: Record<string, unknown> = {}
				for (const [id, rec] of Object.entries(storeObj)) {
					if ((rec as { typeName?: string })?.typeName !== 'camera') {
						filtered[id] = rec
					}
				}

				// Build session from the lighter getSnapshot (session only)
				const snap = getSnapshot(store)
				const session = structuredClone(snap.session) ?? {}
				const pageStates = session.pageStates ?? []
				for (const ps of pageStates) {
					const s = ps as { pageId: string; isGridMode?: boolean; camera?: unknown }
					s.isGridMode = gridRef.current.m.get(s.pageId) ?? false
					delete s.camera
				}

				const documentSnapshot = { store: filtered, schema: rawSnapshot.schema }
				const json = JSON.stringify({ document: documentSnapshot, session })
				saveStorageSnapshot(json)
				dirty = false
			} catch {
				/* session not ready */
			}
		}

		const throttled = throttle(persist, THROTTLE_MS)

		const onStoreChange = (): void => {
			markDirty()
			throttled.run()
		}

		const unlisten = store.listen(onStoreChange)
		const flush = (): void => throttled.flush()
		window.addEventListener('beforeunload', flush)
		window.addEventListener('pagehide', flush)
		return () => {
			throttled.flush()
			throttled.cancel()
			unlisten()
			window.removeEventListener('beforeunload', flush)
			window.removeEventListener('pagehide', flush)
		}
	}, [store, gridRef, machineStateRef])

	// Cross-tab merge: only when tab is NOT focused.
	// Skip in serverSync (WebSocket handles it) and connecting (stale data).
	// Allow in local and supabaseSync so unfocused tabs pick up edits via localStorage.
	useEffect(() => {
		const storageReceivedRef = { current: false }

		const applyFromStorage = (): void => {
			const ms = machineStateRef.current
			if (isServerSynced(ms) || machineIsConnecting(ms)) return
			const raw = loadStorageSnapshot()
			if (!raw) return
			try {
				applyParsedSnapshot(store, JSON.parse(raw) as SnapshotParsed, gridRef, {
					preserveSession: true,
				})
			} catch {
				/* ignore parse errors */
			}
		}

		const onFocus = (): void => {
			if (!storageReceivedRef.current) return
			storageReceivedRef.current = false
			applyFromStorage()
		}

		const onStorage = (e: StorageEvent): void => {
			if (e.key !== SNAPSHOT_KEY || !e.newValue) return
			storageReceivedRef.current = true
			if (!document.hasFocus()) applyFromStorage()
		}

		window.addEventListener('focus', onFocus)
		window.addEventListener('storage', onStorage)
		return () => {
			window.removeEventListener('focus', onFocus)
			window.removeEventListener('storage', onStorage)
		}
	}, [store, gridRef, machineStateRef])
}

/**
 * Shared page connector — runs during shared.connecting.
 * Fetches from Supabase, merges remote data into store, reports success/failure.
 */
function useSharedPageConnect(
	store: TLStore,
	state: MachineState,
	send: Send,
	gridRef: React.MutableRefObject<GridRef>
) {
	const connecting = machineIsConnecting(state)
	const shareId = state.context.shareId
	const pageId = state.context.pageId

	useEffect(() => {
		if (!connecting || !shareId) return
		const controller = new AbortController()

		if (!isSupabaseConfigured()) {
			// No supabase — if we have local data, allow viewing; otherwise fail
			if (pageId && store.get(pageId as TLPageId)) {
				send({ type: 'SUPABASE_CONNECTED' })
			} else {
				send({ type: 'SUPABASE_FAILED' })
			}
			return
		}

		void loadSharedPage(shareId)
			.then((remote) => {
				if (controller.signal.aborted) return

				if (remote?.document?.store) {
					mergeRemotePageIntoStore(store, remote, shareId, pageId ?? '', gridRef)
					const actualPageId = pageId || getPageIdForShareId(shareId) || ''
					send({ type: 'SUPABASE_CONNECTED', pageId: actualPageId || undefined })
					// Persist merged state after transition; we skip during connecting.
					requestAnimationFrame(() => {
						if (!controller.signal.aborted) {
							store.update(TLINSTANCE_ID, (i) => ({ ...i }))
						}
					})
				} else if (pageId && store.get(pageId as TLPageId)) {
					send({ type: 'SUPABASE_CONNECTED' })
				} else {
					send({ type: 'SUPABASE_FAILED' })
				}
			})
			.catch(() => {
				if (!controller.signal.aborted) send({ type: 'SUPABASE_FAILED' })
			})

		return () => controller.abort()
	}, [connecting, shareId, pageId, store, send, gridRef])
}

/** Merge remote ShareSnapshot into the local TLStore for a given shareId. */
function mergeRemotePageIntoStore(
	store: TLStore,
	remote: ShareSnapshot,
	shareId: string,
	existingPageId: string,
	gridRef: React.MutableRefObject<GridRef>
): void {
	const remoteStore = remote.document?.store ?? {}

	// Find the page record in the remote data
	const remotePageEntry = Object.values(remoteStore).find(
		(r): r is { typeName: string; id: string } =>
			typeof r === 'object' && r !== null && 'typeName' in r && (r as { typeName: string }).typeName === 'page'
	)
	const remotePageId = remotePageEntry?.id
	if (!remotePageId) return

	// Always resolve from share map to prevent duplicates.
	// The caller may pass empty pageId on first visit, but the share map
	// might already have a mapping from a previous session.
	if (!existingPageId) {
		existingPageId = getPageIdForShareId(shareId) ?? ''
	}

	// If we already have a local page for this share, remap remote to that ID
	const needRemap = Boolean(existingPageId && existingPageId !== remotePageId)
	const targetPageId = needRemap ? existingPageId : remotePageId

	const localSnap = store.getStoreSnapshot('document') as {
		store: Record<string, unknown>
		schema?: unknown
	}

	// Place new page at end only when first adding; keep index when updating existing.
	const isNewPage = !(targetPageId in (localSnap.store ?? {}))
	const localPages = (Object.entries(localSnap.store ?? {}) as [string, { typeName?: string; index?: string }][])
		.filter(([, r]) => r?.typeName === 'page')
		.map(([id, r]) => ({ id, index: (r.index ?? 'a0') as IndexKey }))
		.sort(sortByIndex)
	const endIndex = localPages.length > 0 ? getIndexAbove(localPages[localPages.length - 1].index) : getIndexAbove(null)

	const remoteRecords: Record<string, unknown> = {}
	for (const [id, rec] of Object.entries(remoteStore)) {
		const base = needRemap
			? { ...(remapIdInValue(rec, remotePageId, targetPageId) as Record<string, unknown>), id: id === remotePageId ? targetPageId : id }
			: rec as Record<string, unknown>
		const newId = id === remotePageId ? targetPageId : id
		const index =
			id === remotePageId
				? isNewPage
					? endIndex
					: (localSnap.store?.[targetPageId] as { index?: string })?.index ?? (base.index as string)
				: base.index
		remoteRecords[newId] = id === remotePageId ? { ...base, id: newId, index } : base
	}

	// Merge: keep all local records except the target page's, then add remote
	const idsToRemove = new Set(getPageRecordIds(localSnap, targetPageId))
	const merged: Record<string, unknown> = {}
	for (const [id, rec] of Object.entries(localSnap.store ?? {})) {
		if (!idsToRemove.has(id)) merged[id] = rec
	}
	for (const [id, rec] of Object.entries(remoteRecords)) {
		merged[id] = rec
	}

	const mergedDoc = { store: merged, schema: localSnap.schema ?? remote.document.schema }
	loadSnapshot(store, { document: mergedDoc } as SnapshotParsed, {
		forceOverwriteSessionState: false,
	})

	// Navigate to the shared page
	try {
		store.update(TLINSTANCE_ID, (i) => ({ ...i, currentPageId: targetPageId as TLPageId }))
	} catch {
		/* ignore */
	}

	// Restore grid mode
	const inst = store.get(TLINSTANCE_ID) as { currentPageId: string; isGridMode: boolean } | undefined
	if (inst) {
		const g = gridRef.current.m.get(inst.currentPageId) ?? false
		store.update(TLINSTANCE_ID, (i) => ({ ...i, isGridMode: g }))
		gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: g }
	}

	// Update share map
	setShareIdForPage(targetPageId, shareId)
}

/** Max consecutive Supabase write failures before triggering a reconnect. */
const SUPABASE_FAILURE_THRESHOLD = 3

/** Find the page record in a remote store and return its id. */
function findRemotePageId(
	remoteStore: Record<string, unknown>
): string | undefined {
	const entry = Object.values(remoteStore).find(
		(r): r is { typeName: string; id: string } =>
			typeof r === 'object' &&
			r !== null &&
			'typeName' in r &&
			(r as { typeName: string }).typeName === 'page'
	)
	return entry?.id
}

/**
 * Compute a record-level diff between the local page and incoming snapshot,
 * then apply the changes via mergeRemoteChanges so tldraw keeps unchanged
 * shapes stable.
 */
function mergeRemotePageChanges(
	store: TLStore,
	persistSnap: { store: Record<string, unknown>; schema?: unknown },
	pageId: string,
	incoming: ShareSnapshot
): void {
	const currentPageIds = new Set(getPageRecordIds(persistSnap, pageId))
	const incomingStore = incoming.document?.store ?? {}
	const currentStore = persistSnap.store ?? {}

	const toPut: unknown[] = []
	const toRemoveIds: string[] = []

	for (const [id, rec] of Object.entries(incomingStore)) {
		const existing = currentStore[id]
		if (!existing || JSON.stringify(existing) !== JSON.stringify(rec)) {
			toPut.push(rec)
		}
	}

	for (const id of currentPageIds) {
		if (!(id in incomingStore)) toRemoveIds.push(id)
	}

	if (toPut.length === 0 && toRemoveIds.length === 0) return

	store.mergeRemoteChanges(() => {
		if (toRemoveIds.length > 0) {
			store.remove(toRemoveIds as Parameters<TLStore['remove']>[0])
		}
		if (toPut.length > 0) {
			store.put(toPut as Parameters<TLStore['put']>[0])
		}
	})
}

/**
 * Supabase direct sync — pushes store changes to Supabase AND polls for
 * remote changes written by other clients (e.g. the sync server).
 * Only active when machine is in shared.supabaseSync.
 *
 * Write path: throttled push on every store change.
 * Poll path:  periodic fetch + incremental merge (skipped while we're
 *             actively writing to avoid echo / stale-read conflicts).
 */
function useSupabaseSync(
	store: TLStore,
	stateRef: React.MutableRefObject<MachineState>,
	editorRef: React.MutableRefObject<TldrawEditor | null>,
	send: Send
) {
	// Timestamp of our last successful Supabase write — used by the poll
	// to skip fetches that would only return our own data.
	const lastWriteTimeRef = useRef(0)

	// ── Write: push store changes to Supabase (throttled) ──────────────
	useEffect(() => {
		let consecutiveFailures = 0

		const throttled = throttle(() => {
			const st = stateRef.current
			if (!shouldRunSupabaseSync(st)) return
			const shareId = st.context.shareId
			const pageId = st.context.pageId
			if (!shareId || !pageId || !editorRef.current) return
			void getContentAsJsonDocForPage(editorRef.current, pageId as TLPageId)
				.then((doc) => {
					if (!doc) return false
					return saveSharedPage(shareId, doc).then(() => true)
				})
				.then((saved) => {
					if (!saved) return
					consecutiveFailures = 0
					lastWriteTimeRef.current = Date.now()
				})
				.catch((err: unknown) => {
					// Abort errors are expected during state transitions — ignore them
					if (err instanceof DOMException && err.name === 'AbortError') return
					consecutiveFailures++
					if (consecutiveFailures >= SUPABASE_FAILURE_THRESHOLD) {
						consecutiveFailures = 0
						send({ type: 'SUPABASE_DISCONNECTED' })
					}
				})
		}, THROTTLE_MS)

		const unlisten = store.listen(throttled.run)
		return () => {
			throttled.cancel()
			unlisten()
		}
	}, [store, stateRef, editorRef, send])

	// ── Poll: fetch remote changes from Supabase and merge ─────────────
	useEffect(() => {
		let active = true

		const poll = async (): Promise<void> => {
			const st = stateRef.current
			if (!shouldRunSupabaseSync(st)) return
			const shareId = st.context.shareId
			const pageId = st.context.pageId
			if (!shareId || !pageId) return

			// Skip if we wrote recently — avoids echoing our own writes and
			// prevents merging stale data over not-yet-pushed local edits.
			if (Date.now() - lastWriteTimeRef.current < SUPABASE_POLL_MS) return

			try {
				const remote = await loadSharedPage(shareId)
				if (!active || !remote?.document?.store) return

				// Re-check state after async gap (may have transitioned away)
				if (!shouldRunSupabaseSync(stateRef.current)) return

				const remotePageId = findRemotePageId(remote.document.store)
				if (!remotePageId) return

				// Remap remote page ID to local page ID if needed
				const incoming =
					remotePageId !== pageId
						? remapDocumentPageId(remote, remotePageId, pageId)
						: remote

				// Compare with local page document — skip if identical
				const persistSnap = store.getStoreSnapshot('document') as {
					store: Record<string, unknown>
					schema?: unknown
				}
				const localDoc = getPageDocumentFromStore(persistSnap, pageId)
				if (localDoc && docContentEqual(localDoc, incoming)) return

				mergeRemotePageChanges(store, persistSnap, pageId, incoming)
			} catch (err) {
				console.warn('[supabase-poll] Error polling for changes:', (err as Error)?.message)
			}
		}

		const id = setInterval(() => void poll(), SUPABASE_POLL_MS)
		return () => {
			active = false
			clearInterval(id)
		}
	}, [store, stateRef])
}

// ── Server sync bridge (component — uses useSync hook) ─────────────────────────

function ServerSyncBridge({
	persistStore,
	pageId,
	syncUri,
	send,
	isUserInteractingRef,
	applySyncRef,
	onRetry,
}: {
	persistStore: TLStore
	pageId: string
	syncUri: string
	send: Send
	isUserInteractingRef: React.MutableRefObject<boolean>
	applySyncRef: React.MutableRefObject<(() => void) | null>
	onRetry: () => void
}) {
	// Keep pageId in a ref so the bidirectional sync closures always see the
	// latest value without requiring a remount (which would kill the WebSocket).
	const pageIdRef = useRef(pageId)
	pageIdRef.current = pageId

	const storeWithStatus = useSync({ uri: syncUri, assets: inlineBase64AssetStore })
	const syncStore =
		storeWithStatus.status === 'synced-remote' ? storeWithStatus.store : null

	// Derive a single key that captures both status *and* connectionStatus
	// changes so one unified effect handles all transitions.
	const connectionStatus =
		storeWithStatus.status === 'synced-remote'
			? storeWithStatus.connectionStatus
			: storeWithStatus.status

	// Report connection status to the machine.
	// Uses connectionStatus (which tracks online/offline within synced-remote,
	// plus top-level status changes) so we catch reconnections that don't change
	// storeWithStatus.status (it stays 'synced-remote' the whole time).
	// pageId in deps: re-send SERVER_CONNECTED when pageId arrives so the
	// machine can transition from connecting/supabaseSync → serverSync.
	useEffect(() => {
		if (connectionStatus === 'online') {
			send({ type: 'SERVER_CONNECTED' })
		} else if (connectionStatus === 'offline' || connectionStatus === 'error') {
			send({ type: 'SERVER_DISCONNECTED' })
		}
		// 'loading' → no event (machine stays in current state)
	}, [connectionStatus, send, pageId])

	// Auto-retry: bump parent retry key when stuck in error so the component
	// remounts with a fresh useSync connection.
	useEffect(() => {
		if (storeWithStatus.status !== 'error') return
		const id = setInterval(() => onRetry(), SERVER_RETRY_INTERVAL_MS)
		const onVis = (): void => {
			if (document.visibilityState === 'visible') onRetry()
		}
		document.addEventListener('visibilitychange', onVis)
		return () => {
			clearInterval(id)
			document.removeEventListener('visibilitychange', onVis)
		}
	}, [storeWithStatus.status, onRetry])

	// Bidirectional sync between persist store and sync store.
	// Guard: skip if pageId is not yet known (still in connecting state).
	useEffect(() => {
		if (!syncStore || !pageIdRef.current) return
		const applyingFromSyncRef = { current: false }
		const pushingToSyncRef = { current: false }
		const pushedHashes = new Set<string>()
		const MAX_PUSHED_HASHES = 32

		const persistSnapshot = (): { store: Record<string, unknown>; schema?: unknown } =>
			persistStore.getStoreSnapshot('document') as {
				store: Record<string, unknown>
				schema?: unknown
			}
		const syncSnapshot = (): { store: Record<string, unknown>; schema?: unknown } =>
			syncStore.getStoreSnapshot('document') as {
				store: Record<string, unknown>
				schema?: unknown
			}

		const syncToPersist = (): void => {
			if (pushingToSyncRef.current) return
			if (isUserInteractingRef.current) return
			try {
				const persistSnap = persistSnapshot()
				const syncSnap = syncSnapshot()
				const syncPageId = getFirstPageIdFromStore(syncSnap)
				if (!syncPageId) return
				const syncDoc = getPageDocumentFromStore(syncSnap, syncPageId)
				if (!syncDoc) return

				// Safety: never apply an empty/near-empty sync page over existing
				// content — this prevents blank-canvas bugs when the server room
				// starts empty and the sync protocol hasn't processed our push yet.
				const syncRecordCount = Object.keys(syncDoc.document?.store ?? {}).length
				const persistDoc = getPageDocumentFromStore(persistSnap, pageId)
				const persistRecordCount = Object.keys(persistDoc?.document?.store ?? {}).length
				if (syncRecordCount <= 1 && persistRecordCount > 1) return

				const toLoad =
					syncPageId !== pageId
						? remapDocumentPageId(syncDoc, syncPageId, pageId)
						: syncDoc
				const receivedHash = docStoreHash(toLoad)
				if (pushedHashes.has(receivedHash)) {
					pushedHashes.delete(receivedHash)
					return
				}
				if (persistDoc && docContentEqual(persistDoc, toLoad)) return

				// Incremental merge: only touch records that actually changed.
				// A full loadSnapshot replaces every record, causing tldraw to
				// unmount/remount all shapes (visual flash).  Incremental put/remove
				// keeps unchanged shapes stable — no flash on reconnection.
				applyingFromSyncRef.current = true
				try {
					const currentPageIds = new Set(getPageRecordIds(persistSnap, pageId))
					const incoming = toLoad.document?.store ?? {}
					const currentStore = persistSnap.store ?? {}

					const toPut: unknown[] = []
					const toRemoveIds: string[] = []

					// Records to add or update
					for (const [id, rec] of Object.entries(incoming)) {
						const existing = currentStore[id]
						if (!existing || JSON.stringify(existing) !== JSON.stringify(rec)) {
							toPut.push(rec)
						}
					}

					// Records to remove (in current page but not in incoming)
					for (const id of currentPageIds) {
						if (!(id in incoming)) toRemoveIds.push(id)
					}

					if (toPut.length > 0 || toRemoveIds.length > 0) {
						persistStore.mergeRemoteChanges(() => {
							if (toRemoveIds.length > 0) {
								persistStore.remove(
									toRemoveIds as Parameters<TLStore['remove']>[0]
								)
							}
							if (toPut.length > 0) {
								persistStore.put(toPut as Parameters<TLStore['put']>[0])
							}
						})
					}
				} finally {
					applyingFromSyncRef.current = false
				}
			} catch (err) {
				console.warn('[sync] syncToPersist error:', (err as Error)?.message)
			}
		}

		applySyncRef.current = syncToPersist

		const persistToSync = (): void => {
			if (applyingFromSyncRef.current) return
			pushingToSyncRef.current = true
			try {
				const doc = getPageDocumentFromStore(persistSnapshot(), pageId)
				if (doc) {
					const hash = docStoreHash(doc)
					pushedHashes.add(hash)
					// Evict oldest entries to prevent unbounded growth
					if (pushedHashes.size > MAX_PUSHED_HASHES) {
						const first = pushedHashes.values().next().value
						if (first !== undefined) pushedHashes.delete(first)
					}
					loadSnapshot(syncStore, doc as SnapshotParsed, {
						forceOverwriteSessionState: false,
					})
				}
			} catch (err) {
				console.warn('[sync] persistToSync error:', (err as Error)?.message)
			} finally {
				pushingToSyncRef.current = false
			}
		}

		// Set up listeners BEFORE the initial push so any server responses
		// that arrive after our push are handled by the listeners.
		const unlistenSync = syncStore.listen(syncToPersist)
		const unlistenPersist = persistStore.listen(persistToSync)

		// Push local data to the server.  Do NOT call syncToPersist() eagerly —
		// the sync store may contain an empty room state from the server that
		// hasn't received our data yet.  The listener will apply any real server
		// updates that arrive after the protocol processes our push.
		persistToSync()

		return () => {
			applySyncRef.current = null
			unlistenSync()
			unlistenPersist()
		}
	}, [syncStore, persistStore, pageId, isUserInteractingRef, applySyncRef])

	return null
}

// ── Readonly tracker (inside Tldraw) ───────────────────────────────────────────

function ReadonlyTracker({ editable }: { editable: boolean }) {
	const editor = useEditor()
	useEffect(() => {
		editor.updateInstanceState({ isReadonly: !editable })
	}, [editor, editable])
	return null
}

// ── User interaction tracker (inside Tldraw) ──────────────────────────────────

function UserInteractionTracker({
	isUserInteractingRef,
	onIdleEnd,
}: {
	isUserInteractingRef: React.MutableRefObject<boolean>
	onIdleEnd: () => void
}) {
	const editor = useEditor()
	useEffect(() => {
		const container = editor.getContainer()
		let idleTimer: ReturnType<typeof setTimeout> | null = null
		const scheduleIdleApply = (): void => {
			if (idleTimer) clearTimeout(idleTimer)
			idleTimer = setTimeout(() => {
				idleTimer = null
				isUserInteractingRef.current = false
				onIdleEnd()
			}, SYNC_APPLY_IDLE_MS)
		}
		const onPointerDown = (): void => {
			isUserInteractingRef.current = true
			scheduleIdleApply()
		}
		const onPointerUp = (): void => {
			scheduleIdleApply()
		}
		const onKeyActivity = (): void => {
			if (container.contains(document.activeElement)) {
				isUserInteractingRef.current = true
				scheduleIdleApply()
			}
		}
		container.addEventListener('pointerdown', onPointerDown)
		container.addEventListener('pointerup', onPointerUp)
		window.addEventListener('pointerup', onPointerUp)
		window.addEventListener('keydown', onKeyActivity)
		window.addEventListener('keyup', onKeyActivity)
		return () => {
			if (idleTimer) clearTimeout(idleTimer)
			container.removeEventListener('pointerdown', onPointerDown)
			container.removeEventListener('pointerup', onPointerUp)
			window.removeEventListener('pointerup', onPointerUp)
			window.removeEventListener('keydown', onKeyActivity)
			window.removeEventListener('keyup', onKeyActivity)
		}
	}, [editor, isUserInteractingRef, onIdleEnd])
	return null
}

// ── Menu panel with connection indicator ───────────────────────────────────────

function MenuPanelWithIndicator() {
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'row',
				alignItems: 'flex-start',
				gap: 3,
				minWidth: 0,
				margin: 0,
				padding: 0,
				marginTop: 4,
			}}
		>
			<DefaultMenuPanel />
			<div
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					flexShrink: 0,
					pointerEvents: 'all',
				}}
			>
				<ConnectionIndicator />
			</div>
		</div>
	)
}

const SYNC_PAGE_COMPONENTS = { MenuPanel: MenuPanelWithIndicator, SharePanel: null }

// ── App ────────────────────────────────────────────────────────────────────────

function App() {
	// 1. Create store (stable singleton)
	const store = useMemo(() => createTLStore(), [])

	// 2. Start state machine
	const [state, send] = useMachine(whiteboardMachine)
	const stateRef = useRef(state)
	stateRef.current = state

	// 3. Grid-mode tracking
	const gridRef = useRef<GridRef>({ m: new Map(), prev: null })

	// 4. Editor ref for Supabase sync
	const editorRef = useRef<TldrawEditor | null>(null)
	const tldrawOnMountCleanupRef = useRef<(() => void) | null>(null)

	// 5. Server sync interaction tracking
	const isUserInteractingRef = useRef(false)
	const applySyncRef = useRef<(() => void) | null>(null)
	const onIdleEnd = useCallback(() => {
		isUserInteractingRef.current = false
		applySyncRef.current?.()
	}, [])

	// Overrides (stable)
	const overrides = useMemo(() => [createPasteActionOverride()], [])

	// ── Load from localStorage immediately (no loading screen) ──
	useLayoutEffect(() => {
		const raw = loadStorageSnapshot()
		if (raw) {
			try {
				applyParsedSnapshot(store, JSON.parse(raw) as SnapshotParsed, gridRef)
			} catch (err) {
				console.warn('[whiteboard] Failed to load from localStorage:', err)
			}
		}
	}, [store])

	// ── Init Supabase in background ──
	useEffect(() => {
		void initSupabase().then((client) => {
			send(client ? { type: 'SUPABASE_READY' } : { type: 'SUPABASE_UNAVAILABLE' })
		})
	}, [send])

	// ── Hook: page tracking → machine events ──
	usePageTracker(store, send)

	// ── Hook: persistence (always active) ──
	usePersistence(store, gridRef, stateRef)

	// ── Hook: shared page connect (shared.connecting) ──
	useSharedPageConnect(store, state, send, gridRef)

	// ── Hook: Supabase direct sync (shared.supabaseSync) ──
	useSupabaseSync(store, stateRef, editorRef, send)

	// ── Log machine state on every transition ──
	useEffect(() => {
		const s = typeof state.value === 'string' ? state.value : JSON.stringify(state.value)
		const { shareId, pageId, supabaseReady } = state.context
		console.log(`[machine] ${s} | share=${shareId ?? '—'} page=${pageId ?? '—'} supabase=${supabaseReady}`)
	}, [state])

	// ── Derived state ──
	const editable = isEditable(state)
	const shared = isSharedPage(state)
	const serverSyncActive = isServerSynced(state)

	// Server sync bridge: mount during connecting, supabaseSync, or serverSync
	// so the WebSocket connection starts in parallel with the Supabase fetch.
	// During connecting, pageId may not be set yet — that's OK, the bridge only
	// needs it once the sync store is ready (by which time SUPABASE_CONNECTED
	// will have set it).
	const needsServerBridge =
		isSyncServerConfigured() &&
		(shouldAttemptServerConnection(state) || shouldRunServerSync(state)) &&
		Boolean(state.context.shareId)

	const syncUri = state.context.shareId ? buildSyncUri(state.context.shareId) : ''

	// Retry key — bumped to force-remount ServerSyncBridge (fresh useSync)
	const [serverRetryKey, setServerRetryKey] = useState(0)
	const bumpServerRetry = useCallback(() => setServerRetryKey((k) => k + 1), [])

	// Cleanup tldraw onMount callbacks
	useEffect(() => {
		return () => {
			tldrawOnMountCleanupRef.current?.()
			tldrawOnMountCleanupRef.current = null
		}
	}, [])

	return (
		<MachineCtx.Provider value={{ state, send }}>
			<ConnectionIndicatorProvider
				onRetry={() => send({ type: 'RETRY' })}
			>
				{/* Server sync bridge (headless — outside Tldraw) */}
				{needsServerBridge && (
					<ServerSyncBridge
						key={`${state.context.shareId}-${serverRetryKey}`}
						persistStore={store}
						pageId={state.context.pageId ?? ''}
						syncUri={syncUri}
						send={send}
						isUserInteractingRef={isUserInteractingRef}
						applySyncRef={applySyncRef}
						onRetry={bumpServerRetry}
					/>
				)}

				{/* Main editor — always rendered, no loading screen */}
				<div style={{ position: 'fixed', inset: 0 }}>
					<Tldraw
						store={store}
						licenseKey={licenseKey}
						overrides={overrides}
						components={{
							MainMenu: CustomMainMenu,
							ContextMenu: CustomContextMenu,
							PageMenu: CustomPageMenu,
							...SYNC_PAGE_COMPONENTS,
						}}
						onMount={(editor) => {
							editorRef.current = editor

							// Apply theme
							const cached = getTheme()
							editor.user.updateUserPreferences({ colorScheme: cached })

							// Auto-detect input mode if the user hasn't explicitly set one.
							// tldraw persists preferences under TLDRAW_USER_DATA_v3; when
							// inputMode is absent or null the user has never chosen, so we
							// pick a sensible default based on the device.
							const TLDRAW_PREFS_KEY = 'TLDRAW_USER_DATA_v3'
							try {
								const raw = localStorage.getItem(TLDRAW_PREFS_KEY)
								const saved = raw ? (JSON.parse(raw) as { user?: { inputMode?: string | null } }) : null
								const hasExplicitMode =
									saved?.user?.inputMode === 'trackpad' || saved?.user?.inputMode === 'mouse'

								if (!hasExplicitMode) {
									// Detect trackpad for mobile and Mac; mouse for Windows/Linux.
									// Avoid maxTouchPoints — unreliable on Windows (touch screens,
									// laptops report 2 for trackpad even when using mouse).
									const isMobile = /iPhone|iPad|iPod|Android/i.test(
										navigator.userAgent
									)
									const isMacLike = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
									const detected: 'trackpad' | 'mouse' =
										isMobile || isMacLike ? 'trackpad' : 'mouse'
									editor.user.updateUserPreferences({ inputMode: detected })
								}
							} catch {
								// localStorage unavailable — leave tldraw defaults
							}

							// If on a shared page, apply readonly based on current machine state
							if (!isEditable(stateRef.current)) {
								store.update(TLINSTANCE_ID, (i) => ({ ...i, isReadonly: true }))
							}

							// Zoom to fit
							const zoomToFitWithLayout = (): void => {
								requestAnimationFrame(() => {
									requestAnimationFrame(() =>
										editor.zoomToFit({ animation: { duration: 200 } })
									)
								})
							}
							zoomToFitWithLayout()

							// Zoom to fit on page change
							let prevPageId = editor.getCurrentPageId()
							const unlistenPage = store.listen(() => {
								const inst = store.get(TLINSTANCE_ID) as
									| { currentPageId?: string }
									| undefined
								const pageId = (inst?.currentPageId ?? '') as TLPageId
								if (pageId && pageId !== prevPageId) {
									prevPageId = pageId
									zoomToFitWithLayout()
								}
							})

							const rightClickPanCleanup = setupRightClickPan(editor)

							const cleanup = () => {
								editorRef.current = null
								unlistenPage()
								rightClickPanCleanup()
							}
							tldrawOnMountCleanupRef.current = cleanup
							return cleanup
						}}
					>
						<SyncThemeToDocument />
						<ReadonlyTracker editable={editable} />
						{shared && serverSyncActive && (
							<UserInteractionTracker
								isUserInteractingRef={isUserInteractingRef}
								onIdleEnd={onIdleEnd}
							/>
						)}
					</Tldraw>
				</div>
			</ConnectionIndicatorProvider>
		</MachineCtx.Provider>
	)
}

export default App
