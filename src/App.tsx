import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
	createTLStore,
	DefaultSpinner,
	getSnapshot,
	loadSnapshot,
	Tldraw,
	TLINSTANCE_ID,
} from 'tldraw'
import 'tldraw/tldraw.css'
import {
	loadPersistedSnapshot,
	savePersistedSnapshot,
	throttle,
	THROTTLE_MS,
} from './persistStore'
import { setupRightClickPan } from './rightClickPan'
import { SyncThemeToDocument, THEME_CACHE_KEY } from './SyncThemeToDocument'

const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY ?? undefined

function getCachedTheme(): 'dark' | 'light' | null {
	try {
		const raw = localStorage.getItem(THEME_CACHE_KEY)
		if (raw === 'light' || raw === 'dark') return raw
	} catch {
		// Ignore storage errors
	}
	return null
}

type LoadingState =
	| { status: 'loading' }
	| { status: 'ready' }
	| { status: 'error'; error: string }

function App() {
	const store = useMemo(() => createTLStore(), [])
	const [loadingState, setLoadingState] = useState<LoadingState>({ status: 'loading' })
	const gridRef = useRef({
		m: new Map<string, boolean>(),
		prev: null as { pageId: string; isGridMode: boolean } | null,
	})

	useLayoutEffect(() => {
		setLoadingState({ status: 'loading' })
		const raw = loadPersistedSnapshot()
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as Parameters<typeof loadSnapshot>[1]
				const states = (parsed as { session?: { pageStates?: Array<{ pageId: string; isGridMode?: boolean }> } }).session?.pageStates ?? []
				for (const ps of states) {
					if (typeof ps.isGridMode === 'boolean') gridRef.current.m.set(ps.pageId, ps.isGridMode)
				}
				loadSnapshot(store, parsed, { forceOverwriteSessionState: true })
				const inst = store.get(TLINSTANCE_ID) as { currentPageId: string; isGridMode: boolean } | undefined
				if (inst) {
					const g = gridRef.current.m.get(inst.currentPageId) ?? false
					store.update(TLINSTANCE_ID, (i) => ({ ...i, isGridMode: g }))
					gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: g }
				}
			} catch (err) {
				setLoadingState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
				return
			}
		}
		setLoadingState({ status: 'ready' })

		let lastJson: string | null = null
		const persist = throttle(() => {
			try {
				const inst = store.get(TLINSTANCE_ID) as { currentPageId: string; isGridMode: boolean } | undefined
				if (inst) {
					const p = gridRef.current.prev
					if (p && inst.currentPageId !== p.pageId) {
						const g = gridRef.current.m.get(inst.currentPageId) ?? false
						store.update(TLINSTANCE_ID, (i) => ({ ...i, isGridMode: g }))
						gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: g }
					} else if (p && inst.isGridMode !== p.isGridMode) {
						gridRef.current.m.set(inst.currentPageId, inst.isGridMode)
						gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: inst.isGridMode }
					} else if (!p) gridRef.current.prev = { pageId: inst.currentPageId, isGridMode: inst.isGridMode }
				}
				const snap = getSnapshot(store)
				const sessionClone = structuredClone(snap.session) ?? {}
				const pageStates = sessionClone.pageStates ?? []
				for (const ps of pageStates) {
					const pageState = ps as { pageId: string; isGridMode?: boolean }
					pageState.isGridMode = gridRef.current.m.get(pageState.pageId) ?? false
				}
				// Use 'all' scope so camera (and instance) records are included; default 'document' omits them
				const documentSnapshot = store.getStoreSnapshot('all')
				const toSave = { document: documentSnapshot, session: sessionClone }
				const json = JSON.stringify(toSave)
				if (json !== lastJson) {
					savePersistedSnapshot(json)
					lastJson = json
				}
			} catch {
				// session not ready
			}
		}, THROTTLE_MS)
		const cleanup = store.listen(persist)
		return () => cleanup()
	}, [store])

	if (loadingState.status === 'loading') {
		return (
			<div className="tldraw__editor" style={{ position: 'fixed', inset: 0 }}>
				<DefaultSpinner />
			</div>
		)
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
				onMount={(editor) => {
					const cached = getCachedTheme()
					if (cached !== null) {
						editor.user.updateUserPreferences({ colorScheme: cached })
					} else {
						const prefs = editor.user.getUserPreferences()
						if (prefs.colorScheme === undefined) {
							editor.user.updateUserPreferences({ colorScheme: 'dark' })
						}
					}
					return setupRightClickPan(editor)
				}}
			>
				<SyncThemeToDocument />
			</Tldraw>
		</div>
	)
}

export default App
