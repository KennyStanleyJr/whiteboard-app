import { useIsDarkMode } from 'tldraw'
import { useEffect } from 'react'

/** Background colors matching tldraw's .tl-theme__light and .tl-theme__dark */
const LIGHT_BG = 'hsl(210, 20%, 98%)'
const DARK_BG = 'hsl(240, 5%, 6.5%)'

/**
 * Syncs the document root background and theme-color meta tag to the app's
 * light/dark mode. Must be rendered inside Tldraw so useIsDarkMode() is available.
 */
export function SyncHtmlTheme() {
	const isDarkMode = useIsDarkMode()

	useEffect(() => {
		const root = document.documentElement
		root.style.backgroundColor = isDarkMode ? DARK_BG : LIGHT_BG

		const meta = document.querySelector('meta[name="theme-color"]')
		if (meta) {
			meta.setAttribute('content', isDarkMode ? DARK_BG : LIGHT_BG)
		}

		return () => {
			root.style.backgroundColor = ''
			if (meta) {
				meta.setAttribute('content', LIGHT_BG)
			}
		}
	}, [isDarkMode])

	return null
}
