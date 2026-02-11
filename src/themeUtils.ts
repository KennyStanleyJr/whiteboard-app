export const THEME_CACHE_KEY = 'whiteboard-theme'

export function getCachedTheme(): 'dark' | 'light' | null {
	try {
		const raw = localStorage.getItem(THEME_CACHE_KEY)
		if (raw === 'light' || raw === 'dark') return raw
	} catch {
		// ignore
	}
	return null
}
