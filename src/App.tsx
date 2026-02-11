import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Editor as TldrawEditor } from '@tldraw/editor'
import type { TLPageId } from '@tldraw/tlschema'
import {
	createTLStore,
	getSnapshot,
	loadSnapshot,
	Tldraw,
	DefaultMenuPanel,
	TLINSTANCE_ID,
	TLStore,
} from 'tldraw'
import { inlineBase64AssetStore } from 'tldraw'
import { useSync } from '@tldraw/sync'
import 'tldraw/tldraw.css'
import {
	loadPersistedSnapshot,
	savePersistedSnapshot,
	PERSIST_KEY,
	throttle,
	THROTTLE_MS,
} from './persistStore'
import {
	addUrlChangeListener,
	buildSyncUri,
	clearShareIdFromUrl,
	docContentEqual,
	docStoreHash,
	getContentAsJsonDocForPage,
	getFirstPageIdFromStore,
	getPageDocumentFromStore,
	getPageRecordIds,
	getShareIdForPage,
	getShareIdFromUrl,
	isShareAvailable,
	isSyncAvailable,
	remapDocumentPageId,
	SHARED_PAGE_MERGED_EVENT,
	setShareIdForPage,
	setShareIdInUrl,
	triggerUrlChangeCheck,
	updateSharedPageInSupabase,
} from './sharePage'
import { CustomContextMenu, CustomMainMenu } from './ExportMenu'
import { CustomPageMenu } from './CustomPageMenu'
import { useEditor } from '@tldraw/editor'
import { createPasteActionOverride } from './pasteJson'
import { setupRightClickPan } from './rightClickPan'
import { setupShiftScrollPan } from './shiftScrollPan'
import {
	ConnectionIndicator,
	ConnectionIndicatorProvider,
	type SyncStatus,
} from './ConnectionIndicator'
import { LoadingView } from './LoadingAnimation'
import { getCachedTheme } from './themeUtils'
import { SyncThemeToDocument } from './SyncThemeToDocument'
import { useMergeSharedPage } from './useMergeSharedPage'

const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY ?? undefined

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
	const full = parsed as { document?: unknown; session?: { pageStates?: Array<{ pageId: string; isGridMode?: boolean }> } }
	const states = full.session?.pageStates ?? []
	for (const ps of states) {
		if (typeof ps.isGridMode === 'boolean') gridRef.current.m.set(ps.pageId, ps.isGridMode)
	}
	for (const ps of states) delete (ps as { pageId: string; isGridMode?: boolean }).isGridMode
	// When preserveSession: only load document—tldraw always overwrites currentPageId from snapshot.session
	const toLoad = (opts?.preserveSession && full.document ? { document: full.document } : parsed) as SnapshotParsed
	loadSnapshot(store, toLoad, { forceOverwriteSessionState: !opts?.preserveSession })
	const inst = store.get(TLINSTANCE_ID) as { currentPageId: string; isGridMode: boolean } | undefined
	if (inst) {
		const g = gridRef.current.m.get(inst.currentPageId) ?? false
		store.update(TLINSTANCE_ID, (i) => ({ ...i, isGridMode: g }))
		gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: g }
	}
}

type LoadingState =
	| { status: 'loading' }
	| { status: 'ready' }
	| { status: 'error'; error: string }

function App() {
	const [, setTick] = useState(0)
	useEffect(() => addUrlChangeListener(() => setTick((t) => t + 1)), [])
	const shareIdFromUrl = getShareIdFromUrl()
	return <EditorWithSync shareIdFromUrl={shareIdFromUrl} />
}

/** Error view for shared page load failures. Shows message and retry button. */
function SharedPageErrorView({ error, onRetry }: { error: string; onRetry: () => void }) {
	const theme = getCachedTheme() ?? 'dark'
	return (
		<div
			className={`tl-container tl-theme__${theme}`}
			style={{
				position: 'fixed',
				inset: 0,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 16,
				background: 'var(--tl-color-background, var(--app-bg))',
				color: 'var(--tl-color-text)',
				padding: 24,
			}}
		>
			<h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Error loading document</h2>
			<p style={{ margin: 0, opacity: 0.8, maxWidth: 400, textAlign: 'center' }}>{error}</p>
			<button
				type="button"
				onClick={onRetry}
				style={{
					padding: '8px 16px',
					fontSize: 14,
					fontWeight: 500,
					cursor: 'pointer',
					borderRadius: 6,
					border: '1px solid var(--tl-color-border)',
					background: 'var(--tl-color-background)',
					color: 'var(--tl-color-text)',
				}}
			>
				Retry
			</button>
		</div>
	)
}

/** Single Editor with persist store. Sync connects/disconnects based on current page (shared vs local).
 * When shareIdFromUrl is set (?p= in URL), runs merge first; shows loading until ready. */
function EditorWithSync({ shareIdFromUrl }: { shareIdFromUrl: string | null }) {
	const [mergeRetryKey, setMergeRetryKey] = useState(0)
	const persistStore = useMemo(() => createTLStore(), [])
	const mergeState = useMergeSharedPage(shareIdFromUrl ?? '', {
		retryKey: mergeRetryKey,
		store: persistStore,
	})
	const needsMerge = Boolean(shareIdFromUrl)
	const mergeLoading = needsMerge && mergeState.status === 'loading'
	const mergeError = needsMerge && mergeState.status === 'error'
	useEffect(() => {
		if (
			mergeState.status === 'ready' &&
			'targetPageId' in mergeState &&
			mergeState.targetPageId &&
			shareIdFromUrl
		) {
			setShareIdForPage(mergeState.targetPageId, shareIdFromUrl)
		}
	}, [mergeState, shareIdFromUrl])

	const [currentPageId, setCurrentPageId] = useState<string | null>(null)
	const [syncRetryKey, setSyncRetryKey] = useState(0)
	const [syncStatus, setSyncStatus] = useState<SyncStatus>({ status: 'no-sync' })
	useEffect(() => {
		const read = (): void => {
			const inst = persistStore.get(TLINSTANCE_ID) as { currentPageId?: string } | undefined
			setCurrentPageId(inst?.currentPageId ?? null)
		}
		read()
		const unlisten = persistStore.listen(read)
		return () => unlisten()
	}, [persistStore])
	const pageShareId = currentPageId ? getShareIdForPage(currentPageId) : undefined
	// Use shareIdFromUrl when we have it from URL but pageShareId isn't set yet (store loads late)
	const shareIdForSync = pageShareId ?? shareIdFromUrl ?? undefined
	const syncUri = shareIdForSync && isSyncAvailable() ? buildSyncUri(shareIdForSync) : ''
	const useSyncBridge = Boolean(syncUri)
	// Use targetPageId from merge when currentPageId not yet set (store loads after merge)
	const pageIdForSync =
		currentPageId ?? (mergeState.status === 'ready' && 'targetPageId' in mergeState ? mergeState.targetPageId : null)
	useEffect(() => {
		if (!useSyncBridge) setSyncStatus({ status: 'no-sync' })
	}, [useSyncBridge])
	const needsRetry =
		syncStatus.status === 'loading' || syncStatus.status === 'error'
	useEffect(() => {
		if (!needsRetry || !useSyncBridge) return
		const onVisibilityChange = (): void => {
			if (document.visibilityState === 'visible') setSyncRetryKey((k) => k + 1)
		}
		document.addEventListener('visibilitychange', onVisibilityChange)
		return () => document.removeEventListener('visibilitychange', onVisibilityChange)
	}, [needsRetry, useSyncBridge])
	// Must be before any early returns: hooks must run in same order every render
	const isUserInteractingRef = useRef(false)
	const applySyncRef = useRef<(() => void) | null>(null)
	const onIdleEnd = useCallback(() => {
		isUserInteractingRef.current = false
		applySyncRef.current?.()
	}, [])
	if (mergeError) {
		return (
			<SharedPageErrorView
				error={mergeState.error}
				onRetry={() => setMergeRetryKey((k) => k + 1)}
			/>
		)
	}
	if (mergeLoading) {
		return <LoadingView theme={getCachedTheme() ?? 'dark'} />
	}
	const editor = (
		<Editor
			store={persistStore}
			persistToLocalStorage
			shareId={shareIdForSync}
			syncBridgeActive={useSyncBridge}
			components={useSyncBridge ? SYNC_PAGE_COMPONENTS : undefined}
			isUserInteractingRef={useSyncBridge ? isUserInteractingRef : undefined}
			onIdleEnd={useSyncBridge ? onIdleEnd : undefined}
		/>
	)
	return (
		<ConnectionIndicatorProvider status={syncStatus} onRetry={() => setSyncRetryKey((k) => k + 1)}>
			{useSyncBridge && pageIdForSync && (
				<SharedPageSyncBridge
					key={`${pageIdForSync}-${shareIdForSync}-${syncRetryKey}`}
					persistStore={persistStore}
					pageId={pageIdForSync}
					syncUri={syncUri}
					onStatusChange={setSyncStatus}
					isUserInteractingRef={isUserInteractingRef}
					applySyncRef={applySyncRef}
				/>
			)}
			{editor}
		</ConnectionIndicatorProvider>
	)
}

/** Headless: runs useSync and bidirectional sync. Reports status via onStatusChange. Does not wrap Editor. */
function SharedPageSyncBridge({
	persistStore,
	pageId,
	syncUri,
	onStatusChange,
	isUserInteractingRef,
	applySyncRef,
}: {
	persistStore: TLStore
	pageId: string
	syncUri: string
	onStatusChange: (status: SyncStatus) => void
	isUserInteractingRef: React.MutableRefObject<boolean>
	applySyncRef: React.MutableRefObject<(() => void) | null>
}) {
	const storeWithStatus = useSync({ uri: syncUri, assets: inlineBase64AssetStore })
	const syncStore = storeWithStatus.status === 'synced-remote' ? storeWithStatus.store : null
	const syncStatus: SyncStatus =
		storeWithStatus.status === 'synced-remote'
			? { status: 'synced-remote', connectionStatus: storeWithStatus.connectionStatus }
			: storeWithStatus.status === 'error'
				? { status: 'error' }
				: { status: 'loading' }
	const statusKey =
		storeWithStatus.status === 'synced-remote'
			? storeWithStatus.connectionStatus
			: storeWithStatus.status
	useEffect(() => {
		onStatusChange(syncStatus)
		// statusKey is the derived trigger; syncStatus is derived from the same source
		// eslint-disable-next-line react-hooks/exhaustive-deps -- statusKey captures status changes
	}, [statusKey, onStatusChange, syncUri])
	useEffect(() => {
		if (!syncStore) return
		const applyingFromSyncRef = { current: false }
		const pushingToSyncRef = { current: false }
		const pushedHashes = new Set<string>()
		const persistSnapshot = (): { store: Record<string, unknown>; schema?: unknown } =>
			persistStore.getStoreSnapshot('document') as { store: Record<string, unknown>; schema?: unknown }
		const syncSnapshot = (): { store: Record<string, unknown>; schema?: unknown } =>
			syncStore.getStoreSnapshot('document') as { store: Record<string, unknown>; schema?: unknown }
		const syncToPersist = (): void => {
			if (pushingToSyncRef.current) return
			// Skip applying remote updates while user is actively editing (e.g. dragging) to avoid
			// overwriting in-progress local changes. Apply queued sync on pointer up via applySyncRef.
			if (isUserInteractingRef.current) return
			const persistSnap = persistSnapshot()
			const syncSnap = syncSnapshot()
			const syncPageId = getFirstPageIdFromStore(syncSnap)
			if (!syncPageId) return
			const syncDoc = getPageDocumentFromStore(syncSnap, syncPageId)
			if (!syncDoc) return
			const toLoad = syncPageId !== pageId ? remapDocumentPageId(syncDoc, syncPageId, pageId) : syncDoc
			// Skip if this is our own echo (hash matches what we just pushed)
			const receivedHash = docStoreHash(toLoad)
			if (pushedHashes.has(receivedHash)) {
				pushedHashes.delete(receivedHash)
				return
			}
			// Skip if sync content matches our persist content (avoids redundant apply)
			const persistDoc = getPageDocumentFromStore(persistSnap, pageId)
			if (persistDoc && docContentEqual(persistDoc, toLoad)) return
			applyingFromSyncRef.current = true
			try {
				// Merge: persist (minus shared page) + sync's shared page. loadSnapshot replaces
				// the document, so we must build a merged doc to preserve other pages.
				const idsToRemove = new Set(getPageRecordIds(persistSnap, pageId))
				const persistStoreObj = persistSnap.store ?? {}
				const merged: Record<string, unknown> = {}
				for (const [id, rec] of Object.entries(persistStoreObj)) {
					if (!idsToRemove.has(id)) merged[id] = rec
				}
				const syncRecords = toLoad.document?.store ?? {}
				for (const [id, rec] of Object.entries(syncRecords)) {
					merged[id] = rec
				}
				const mergedDoc = {
					store: merged,
					schema: persistSnap.schema ?? toLoad.document?.schema,
				}
				loadSnapshot(persistStore, { document: mergedDoc } as SnapshotParsed, {
					forceOverwriteSessionState: false,
				})
			} finally {
				applyingFromSyncRef.current = false
			}
		}
		applySyncRef.current = syncToPersist
		const persistToSync = (): void => {
			if (applyingFromSyncRef.current) return
			pushingToSyncRef.current = true
			try {
				const doc = getPageDocumentFromStore(persistSnapshot(), pageId)
				if (doc) {
					pushedHashes.add(docStoreHash(doc))
					loadSnapshot(syncStore, doc as SnapshotParsed, { forceOverwriteSessionState: false })
				}
			} catch {
				// ignore merge errors
			} finally {
				pushingToSyncRef.current = false
			}
		}
		const throttledPersistToSync = throttle(persistToSync, THROTTLE_MS)
		persistToSync()
		syncToPersist()
		const unlistenSync = syncStore.listen(syncToPersist)
		const unlistenPersist = persistStore.listen(throttledPersistToSync.run)
		return () => {
			applySyncRef.current = null
			throttledPersistToSync.cancel()
			unlistenSync()
			unlistenPersist()
		}
	}, [syncStore, persistStore, pageId, isUserInteractingRef, applySyncRef])
	return null
}

/** Menu panel with connection indicator to the right. Used when sync is enabled. */
function MenuPanelWithIndicator() {
	return (
		<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 3, minWidth: 0, margin: 0, padding: 0, marginTop: 4 }}>
			<DefaultMenuPanel />
			<div style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, pointerEvents: 'all' }}>
				<ConnectionIndicator />
			</div>
		</div>
	)
}

const SYNC_PAGE_COMPONENTS = { MenuPanel: MenuPanelWithIndicator, SharePanel: null }

/** Idle delay before applying remote updates after user stops interacting. */
const SYNC_APPLY_IDLE_MS = 400

/** Tracks pointer/key activity so sync skips applying remote updates during active edits.
 * Applies queued updates only after user has been idle for SYNC_APPLY_IDLE_MS. */
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

type EditorProps =
	| {
			store: TLStore
			persistToLocalStorage: false
			shareId?: string
			syncBridgeActive?: boolean
			components?: { MenuPanel?: React.ComponentType }
			isReadonly?: boolean
			isUserInteractingRef?: React.MutableRefObject<boolean>
			onIdleEnd?: () => void
		}
	| {
			store?: TLStore
			persistToLocalStorage: true
			shareId?: string
			syncBridgeActive?: boolean
			components?: { MenuPanel?: React.ComponentType }
			isReadonly?: boolean
			isUserInteractingRef?: React.MutableRefObject<boolean>
			onIdleEnd?: () => void
		}

function Editor(props: EditorProps) {
	const internalStore = useMemo(() => createTLStore(), [])
	const store = props.persistToLocalStorage
		? ((props as { store?: TLStore }).store ?? internalStore)
		: (props as { store: TLStore }).store
	const persistToLocalStorage = props.persistToLocalStorage
	const shareId = 'shareId' in props ? props.shareId : undefined
	const syncBridgeActive = 'syncBridgeActive' in props ? props.syncBridgeActive : false
	const componentOverrides = props.components
	const isReadonly = props.isReadonly ?? false
	const isUserInteractingRef = 'isUserInteractingRef' in props ? props.isUserInteractingRef : undefined
	const onIdleEnd = 'onIdleEnd' in props ? props.onIdleEnd : undefined
	const editorRef = useRef<TldrawEditor | null>(null)
	const overrides = useMemo(() => [createPasteActionOverride()], [])
	const [loadingState, setLoadingState] = useState<LoadingState>({ status: 'loading' })
	const gridRef = useRef<GridRef>({ m: new Map(), prev: null })
	const tldrawOnMountCleanupRef = useRef<(() => void) | null>(null)

	useLayoutEffect(() => {
		if (!persistToLocalStorage) {
			setLoadingState({ status: 'ready' })
			return
		}
		setLoadingState({ status: 'loading' })

		const raw = loadPersistedSnapshot()
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as SnapshotParsed
				applyParsedSnapshot(store, parsed, gridRef)
			} catch (err) {
				setLoadingState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
				return
			}
		}
		setLoadingState({ status: 'ready' })

		let lastJson: string | null = null
		const throttled = throttle(() => {
			try {
				const inst = store.get(TLINSTANCE_ID) as { currentPageId: string; isGridMode: boolean } | undefined
				if (inst) syncGridRef(inst, gridRef, store)
				const snap = getSnapshot(store)
				const sessionClone = structuredClone(snap.session) ?? {}
				const pageStates = sessionClone.pageStates ?? []
				for (const ps of pageStates) {
					const pageState = ps as { pageId: string; isGridMode?: boolean; camera?: unknown }
					pageState.isGridMode = gridRef.current.m.get(pageState.pageId) ?? false
					delete pageState.camera
				}
				// Use 'all' scope so instance records are included; omit camera so we always zoom to fit on open
				const rawSnapshot = store.getStoreSnapshot('all')
				const doc = rawSnapshot as { store: Record<string, unknown>; schema: unknown }
				const filtered: Record<string, unknown> = {}
				for (const [id, rec] of Object.entries(doc.store ?? {})) {
					const r = rec as { typeName?: string }
					if (r?.typeName !== 'camera') filtered[id] = rec
				}
				const documentSnapshot = { store: filtered, schema: doc.schema } as typeof rawSnapshot
				const toSave = { document: documentSnapshot, session: sessionClone }
				const json = JSON.stringify(toSave)
				if (json !== lastJson) {
					savePersistedSnapshot(json)
					lastJson = json
				}
				// Shared pages: sync bridge pushes to sync server (which persists to Supabase). Skip direct Supabase when sync is active.
				if (
					!syncBridgeActive &&
					shareId &&
					isShareAvailable() &&
					editorRef.current
				) {
					const inst = store.get(TLINSTANCE_ID) as { currentPageId: string } | undefined
					if (inst) {
						const pageShareId = getShareIdForPage(inst.currentPageId) ?? shareId
						if (pageShareId) {
							void getContentAsJsonDocForPage(editorRef.current, inst.currentPageId as TLPageId)
								.then((doc) => (doc ? updateSharedPageInSupabase(pageShareId, doc) : undefined))
								.catch(() => { /* Supabase update failed; ignore to avoid unhandled rejection */ })
						}
					}
				}
			} catch {
				// session not ready
			}
		}, THROTTLE_MS)
		const unlisten = store.listen(throttled.run)
		const flushOnUnload = (): void => throttled.flush()
		window.addEventListener('beforeunload', flushOnUnload)
		window.addEventListener('pagehide', flushOnUnload)
		return () => {
			throttled.flush()
			throttled.cancel()
			unlisten()
			window.removeEventListener('beforeunload', flushOnUnload)
			window.removeEventListener('pagehide', flushOnUnload)
		}
	}, [store, persistToLocalStorage, shareId, syncBridgeActive])

	// When sync disconnects, save shared page to Supabase so changes aren't lost. Skip when sync bridge is active—sync server handles it.
	useEffect(() => {
		if (
			syncBridgeActive ||
			!shareId ||
			!isShareAvailable() ||
			!editorRef.current ||
			loadingState.status !== 'ready'
		)
			return
		const inst = store.get(TLINSTANCE_ID) as { currentPageId?: string } | undefined
		const pageId = inst?.currentPageId
		const pageShareId = pageId ? getShareIdForPage(pageId) : undefined
		if (!pageId || !pageShareId) return
		void getContentAsJsonDocForPage(editorRef.current, pageId as TLPageId)
			.then((doc) => (doc ? updateSharedPageInSupabase(pageShareId, doc) : undefined))
			.catch(() => { /* Supabase update failed; ignore */ })
	}, [syncBridgeActive, shareId, store, loadingState.status])

	// Sync from localStorage when another tab writes (storage event) or when returning
	// to this tab after another tab wrote (storage event sets flag; focus applies).
	// Only apply when we know another tab wrote—avoid overwriting our own unsaved changes in single-tab.
	// Skip when viewing a shared page—shared pages get updates from sync server or Supabase, not localStorage.
	// Preserve current page when applying from storage—only first load should switch pages.
	useEffect(() => {
		if (!persistToLocalStorage || loadingState.status !== 'ready' || syncBridgeActive || shareId) return
		const storageReceivedRef = { current: false }
		const applyRawSnapshot = (raw: string | null): void => {
			if (!raw) return
			try {
				applyParsedSnapshot(store, JSON.parse(raw) as SnapshotParsed, gridRef, { preserveSession: true })
			} catch {
				// ignore parse errors
			}
		}
		const onFocus = (): void => {
			if (!storageReceivedRef.current) return
			storageReceivedRef.current = false
			applyRawSnapshot(loadPersistedSnapshot())
		}
		const onStorage = (e: StorageEvent): void => {
			if (e.key !== PERSIST_KEY || e.newValue == null) return
			storageReceivedRef.current = true
			// Only apply when this tab is in the background; if the user is editing here,
			// applying would overwrite their in-progress changes.
			if (!document.hasFocus()) applyRawSnapshot(e.newValue)
		}
		window.addEventListener('focus', onFocus)
		window.addEventListener('storage', onStorage)
		return () => {
			window.removeEventListener('focus', onFocus)
			window.removeEventListener('storage', onStorage)
		}
	}, [store, loadingState.status, persistToLocalStorage, syncBridgeActive, shareId])

	// On tab focus: if current page is shared and sync is available, re-check URL so we can switch to sync.
	useEffect(() => {
		if (!persistToLocalStorage || loadingState.status !== 'ready' || !isSyncAvailable()) return
		const onVisibilityChange = (): void => {
			if (document.visibilityState !== 'visible') return
			const inst = store.get(TLINSTANCE_ID) as { currentPageId: string } | undefined
			if (!inst?.currentPageId) return
			if (getShareIdForPage(inst.currentPageId)) triggerUrlChangeCheck()
		}
		document.addEventListener('visibilitychange', onVisibilityChange)
		return () => document.removeEventListener('visibilitychange', onVisibilityChange)
	}, [store, loadingState.status, persistToLocalStorage])

	// When shared page merge completes (background fetch), reload from localStorage.
	useEffect(() => {
		if (!persistToLocalStorage || !shareId) return
		const onMerged = (e: Event): void => {
			const ev = e as CustomEvent<{ shareId: string }>
			if (ev.detail?.shareId === shareId) {
				const raw = loadPersistedSnapshot()
				if (raw) {
					try {
						applyParsedSnapshot(store, JSON.parse(raw) as SnapshotParsed, gridRef)
					} catch {
						// ignore parse errors
					}
				}
			}
		}
		window.addEventListener(SHARED_PAGE_MERGED_EVENT, onMerged)
		return () => window.removeEventListener(SHARED_PAGE_MERGED_EVENT, onMerged)
	}, [store, persistToLocalStorage, shareId])

	// Update URL when switching pages: shared pages show ?p=ID, local pages don't.
	// No dispatch—avoids view switch so the same Editor stays mounted and page changes work.
	const prevPageIdRef = useRef<string | null>(null)
	useEffect(() => {
		const updateUrlForCurrentPage = (): void => {
			const inst = store.get(TLINSTANCE_ID) as { currentPageId: string } | undefined
			if (!inst) return
			const pageId = inst.currentPageId
			if (prevPageIdRef.current === pageId) return
			prevPageIdRef.current = pageId
			const pageShareId = getShareIdForPage(pageId)
			if (pageShareId) {
				setShareIdInUrl(pageShareId)
			} else {
				clearShareIdFromUrl()
				triggerUrlChangeCheck() // Re-render so sync bridge turns off; avoids merging wrong page
			}
		}
		updateUrlForCurrentPage()
		const unlisten = store.listen(updateUrlForCurrentPage)
		return () => unlisten()
	}, [store])

	// Guarantee onMount cleanups (right-click pan, shift-scroll pan) on unmount. Tldraw invokes
	// onMount's return value; this defends against API changes or unexpected unmount order.
	useEffect(() => {
		return () => {
			tldrawOnMountCleanupRef.current?.()
			tldrawOnMountCleanupRef.current = null
		}
	}, [])

	if (loadingState.status === 'loading') {
		return <LoadingView theme={getCachedTheme() ?? 'dark'} />
	}
	if (loadingState.status === 'error') {
		return (
			<div className="tldraw__editor" style={{ position: 'fixed', inset: 0 }}>
				<h2>Error loading document</h2>
				<p>{loadingState.error}</p>
			</div>
		)
	}

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				store={store}
				licenseKey={licenseKey}
				overrides={overrides}
				components={{
					MainMenu: CustomMainMenu,
					ContextMenu: CustomContextMenu,
					PageMenu: CustomPageMenu,
					...(componentOverrides ?? {}),
				}}
				cameraOptions={{ zoomSpeed: 1.5, wheelBehavior: 'zoom' }}
				onMount={(editor) => {
					editorRef.current = editor
					if (isReadonly) {
						store.update(TLINSTANCE_ID, (i) => ({ ...i, isReadonly: true }))
					}
					const cached = getCachedTheme()
					if (cached !== null) {
						editor.user.updateUserPreferences({ colorScheme: cached })
					} else {
						const prefs = editor.user.getUserPreferences()
						if (prefs.colorScheme === undefined) {
							editor.user.updateUserPreferences({ colorScheme: 'dark' })
						}
					}
					if (shareId) setShareIdForPage(editor.getCurrentPageId(), shareId)
					const zoomToFitWithLayout = (): void => {
						requestAnimationFrame(() => {
							requestAnimationFrame(() => editor.zoomToFit({ animation: { duration: 200 } }))
						})
					}
					zoomToFitWithLayout()
					let prevPageId = editor.getCurrentPageId()
					const unlistenPage = store.listen(() => {
						const inst = store.get(TLINSTANCE_ID) as { currentPageId?: string } | undefined
						const pageId = (inst?.currentPageId ?? '') as TLPageId
						if (pageId && pageId !== prevPageId) {
							prevPageId = pageId
							zoomToFitWithLayout()
						}
					})
					const rightClickPanCleanup = setupRightClickPan(editor)
					const shiftScrollPanCleanup = setupShiftScrollPan(editor)
					const cleanup = () => {
						editorRef.current = null
						unlistenPage()
						shiftScrollPanCleanup()
						rightClickPanCleanup()
					}
					tldrawOnMountCleanupRef.current = cleanup
					return cleanup
				}}
			>
				<SyncThemeToDocument />
				{isUserInteractingRef && onIdleEnd && (
					<UserInteractionTracker
						isUserInteractingRef={isUserInteractingRef}
						onIdleEnd={onIdleEnd}
					/>
				)}
			</Tldraw>
		</div>
	)
}

export default App
