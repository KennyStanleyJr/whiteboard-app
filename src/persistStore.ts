const PERSIST_KEY = 'whiteboard-document'
const THROTTLE_MS = 500

export { PERSIST_KEY, THROTTLE_MS }

/**
 * Throttles a function to run at most once per `intervalMs`.
 */
export function throttle<T extends () => void>(fn: T, intervalMs: number): () => void {
	let last = 0
	let timeout: ReturnType<typeof setTimeout> | null = null
	return function run() {
		const now = Date.now()
		const elapsed = now - last
		if (elapsed >= intervalMs || last === 0) {
			last = now
			if (timeout) {
				clearTimeout(timeout)
				timeout = null
			}
			fn()
		} else if (timeout === null) {
			timeout = setTimeout(() => {
				timeout = null
				last = Date.now()
				fn()
			}, intervalMs - elapsed)
		}
	}
}

export function loadPersistedSnapshot(): string | null {
	try {
		const raw = localStorage.getItem(PERSIST_KEY)
		if (raw !== null) {
			console.log('[whiteboard] Loaded from localStorage:', (raw.length / 1024).toFixed(2), 'KB')
		} else {
			console.log('[whiteboard] No persisted document in localStorage')
		}
		return raw
	} catch (e) {
		console.warn('[whiteboard] loadPersistedSnapshot failed:', e)
		return null
	}
}

export function savePersistedSnapshot(json: string): void {
	try {
		localStorage.setItem(PERSIST_KEY, json)
		console.log('[whiteboard] Saved to localStorage:', (json.length / 1024).toFixed(2), 'KB')
	} catch (e) {
		console.warn('[whiteboard] savePersistedSnapshot failed:', e)
	}
}
