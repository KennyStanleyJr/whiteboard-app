const PERSIST_KEY = 'whiteboard-document'
const THROTTLE_MS = 300

export { PERSIST_KEY, THROTTLE_MS }

export interface Throttled<T extends () => void> {
	run: T
	cancel: () => void
	flush: () => void
}

/**
 * Throttles a function to run at most once per `intervalMs`.
 * Returns { run, cancel, flush }; call cancel() on unmount; flush() runs immediately.
 */
export function throttle<T extends () => void>(fn: T, intervalMs: number): Throttled<T> {
	let last = 0
	let timeout: ReturnType<typeof setTimeout> | null = null
	function run() {
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
	function cancel() {
		if (timeout !== null) {
			clearTimeout(timeout)
			timeout = null
		}
	}
	function flush() {
		if (timeout !== null) {
			clearTimeout(timeout)
			timeout = null
		}
		last = Date.now()
		fn()
	}
	return { run: run as T, cancel, flush }
}

export function loadPersistedSnapshot(): string | null {
	try {
		return localStorage.getItem(PERSIST_KEY)
	} catch (e) {
		console.warn('[whiteboard] loadPersistedSnapshot failed:', e)
		return null
	}
}

export function savePersistedSnapshot(json: string): void {
	try {
		localStorage.setItem(PERSIST_KEY, json)
	} catch (e) {
		console.warn('[whiteboard] savePersistedSnapshot failed:', e)
	}
}

