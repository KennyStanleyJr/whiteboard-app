import { useLayoutEffect, useMemo, useState } from 'react'
import {
	createTLStore,
	DefaultSpinner,
	getSnapshot,
	loadSnapshot,
	Tldraw,
} from 'tldraw'
import 'tldraw/tldraw.css'
import {
	loadPersistedSnapshot,
	savePersistedSnapshot,
	throttle,
	THROTTLE_MS,
} from './persistStore'
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

	useLayoutEffect(() => {
		setLoadingState({ status: 'loading' })
		console.log('[whiteboard] Loading document...')
		const raw = loadPersistedSnapshot()
		if (raw) {
			try {
				const snapshot = JSON.parse(raw) as Parameters<typeof loadSnapshot>[1]
				loadSnapshot(store, snapshot)
				console.log('[whiteboard] Document restored from localStorage')
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				console.error('[whiteboard] Failed to load document:', err)
				setLoadingState({ status: 'error', error: message })
				return
			}
		} else {
			console.log('[whiteboard] Starting with empty document')
		}
		setLoadingState({ status: 'ready' })

		let lastSavedJson: string | null = null
		const persist = throttle(() => {
			try {
				const snapshot = getSnapshot(store)
				const json = JSON.stringify(snapshot)
				if (json !== lastSavedJson) {
					savePersistedSnapshot(json)
					lastSavedJson = json
				}
			} catch {
				console.debug('[whiteboard] Skip save (session not ready)')
			}
		}, THROTTLE_MS)
		const cleanup = store.listen(persist)
		console.log('[whiteboard] Persistence listener attached')
		return () => {
			cleanup()
			console.log('[whiteboard] Persistence listener removed')
		}
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
				}}
			>
				<SyncThemeToDocument />
			</Tldraw>
		</div>
	)
}

export default App
