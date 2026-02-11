import { useEditor, useValue } from 'tldraw'
import { useEffect } from 'react'

const DARK_BG = 'hsl(240, 5%, 6.5%)'
const LIGHT_BG = 'hsl(210, 20%, 98%)'

const THEME_CACHE_KEY = 'whiteboard-theme'

function applyThemeToDocument(isDark: boolean) {
	const bg = isDark ? DARK_BG : LIGHT_BG
	document.documentElement.style.setProperty('--app-bg', bg)
	const meta = document.querySelector('meta[name="theme-color"]')
	if (meta) meta.setAttribute('content', bg)
	try {
		window.localStorage.setItem(THEME_CACHE_KEY, isDark ? 'dark' : 'light')
	} catch {
		// Ignore storage errors (private mode, quota, etc.)
	}
}

export { THEME_CACHE_KEY }

/**
 * Syncs tldraw's theme (dark/light) to document background and PWA theme-color.
 * Must be rendered inside Tldraw so useEditor() is available.
 */
export function SyncThemeToDocument() {
	const editor = useEditor()
	const isDarkMode = useValue('isDarkMode', () => editor.user.getIsDarkMode(), [editor])

	useEffect(() => {
		applyThemeToDocument(isDarkMode)
	}, [isDarkMode])

	return null
}
