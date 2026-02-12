/**
 * localStorage persistence layer.
 * Source of truth for share map, theme, and document snapshot.
 * The tldraw store is hydrated from here on boot and kept in sync.
 */

// ── Keys ───────────────────────────────────────────────────────────────────────

const SNAPSHOT_KEY = 'whiteboard-document'
const SHARE_MAP_KEY = 'whiteboard-share-map'
const THEME_KEY = 'whiteboard-theme'

export { SNAPSHOT_KEY, THEME_KEY }

// ── Throttle utility ───────────────────────────────────────────────────────────

export const THROTTLE_MS = 300

interface Throttled<T extends () => void> {
	run: T
	cancel: () => void
	flush: () => void
}

export function throttle<T extends () => void>(fn: T, intervalMs: number): Throttled<T> {
	let last = 0
	let timeout: ReturnType<typeof setTimeout> | null = null
	function run() {
		const now = Date.now()
		const elapsed = now - last
		if (elapsed >= intervalMs || last === 0) {
			last = now
			if (timeout) { clearTimeout(timeout); timeout = null }
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
		if (timeout !== null) { clearTimeout(timeout); timeout = null }
	}
	function flush() {
		if (timeout !== null) { clearTimeout(timeout); timeout = null }
		last = Date.now()
		fn()
	}
	return { run: run as T, cancel, flush }
}

// ── Snapshot (full document) ───────────────────────────────────────────────────

export function loadSnapshot(): string | null {
	try { return localStorage.getItem(SNAPSHOT_KEY) }
	catch { return null }
}

export function saveSnapshot(json: string): void {
	try { localStorage.setItem(SNAPSHOT_KEY, json) }
	catch { /* quota or private mode */ }
}

// ── Share map (pageId → shareId) ───────────────────────────────────────────────

function loadShareMap(): Map<string, string> {
	try {
		const raw = localStorage.getItem(SHARE_MAP_KEY)
		if (!raw) return new Map()
		const obj = JSON.parse(raw) as Record<string, unknown>
		const map = new Map<string, string>()
		for (const [k, v] of Object.entries(obj)) {
			if (typeof v === 'string') map.set(k, v)
		}
		return map
	} catch {
		return new Map()
	}
}

function saveShareMap(map: Map<string, string>): void {
	try {
		localStorage.setItem(SHARE_MAP_KEY, JSON.stringify(Object.fromEntries(map)))
	} catch { /* ignore */ }
}

export function getShareIdForPage(pageId: string): string | undefined {
	return loadShareMap().get(pageId)
}

export function getPageIdForShareId(shareId: string): string | undefined {
	const map = loadShareMap()
	for (const [pageId, sid] of map) {
		if (sid === shareId) return pageId
	}
	return undefined
}

export function setShareIdForPage(pageId: string, shareId: string): void {
	const map = loadShareMap()
	map.set(pageId, shareId)
	saveShareMap(map)
}

// ── Theme / user preferences ───────────────────────────────────────────────────

export function getTheme(): 'dark' | 'light' {
	try {
		const raw = localStorage.getItem(THEME_KEY)
		if (raw === 'light' || raw === 'dark') return raw
	} catch { /* ignore */ }
	return 'dark'
}

export function setTheme(theme: 'dark' | 'light'): void {
	try { localStorage.setItem(THEME_KEY, theme) }
	catch { /* ignore */ }
}

// ── URL utilities ──────────────────────────────────────────────────────────────

export function getShareIdFromUrl(): string | null {
	if (typeof window === 'undefined') return null
	const id = new URLSearchParams(window.location.search).get('p')
	return id?.trim() || null
}

export function setShareIdInUrl(id: string): void {
	if (typeof window === 'undefined') return
	const url = new URL(window.location.href)
	url.searchParams.set('p', id)
	window.history.replaceState({}, '', url.toString())
}

export function clearShareIdFromUrl(): void {
	if (typeof window === 'undefined') return
	const url = new URL(window.location.href)
	url.searchParams.delete('p')
	window.history.replaceState({}, '', url.toString())
}

export function buildShareUrl(id: string): string {
	if (typeof window === 'undefined') return `?p=${encodeURIComponent(id)}`
	return `${window.location.origin}${window.location.pathname || '/'}?p=${encodeURIComponent(id)}`
}
