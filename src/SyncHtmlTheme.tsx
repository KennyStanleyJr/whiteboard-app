import { useEffect } from 'react'

/** Background colors matching Excalidraw light/dark themes */
const LIGHT_BG = 'hsl(210, 20%, 98%)'
const DARK_BG = 'hsl(240, 5%, 6.5%)'

export type Theme = 'light' | 'dark'

export interface SyncHtmlThemeProps {
	theme: Theme
}

/**
 * Syncs the document root background and theme-color meta tag to the app's
 * light/dark mode. Pass the current theme from the canvas component.
 */
export function SyncHtmlTheme({ theme }: SyncHtmlThemeProps) {
	useEffect(() => {
		const isDarkMode = theme === 'dark'
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
	}, [theme])

	return null
}
