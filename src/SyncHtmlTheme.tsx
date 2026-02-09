import { THEME } from '@excalidraw/excalidraw'
import { useEffect } from 'react'
import { DARK_BG, LIGHT_BG } from './themeConstants'
import type { ExcalidrawTheme } from './types'

let themeColorMetaCache: HTMLMetaElement | null | undefined = undefined

function getThemeColorMeta(): HTMLMetaElement | null {
	if (themeColorMetaCache === undefined) {
		const el = document.querySelector('meta[name="theme-color"]')
		themeColorMetaCache = el instanceof HTMLMetaElement ? el : null
	}
	return themeColorMetaCache ?? null
}

export interface SyncHtmlThemeProps {
	theme: ExcalidrawTheme
}

/**
 * Syncs the document root background and theme-color meta tag to the app's
 * light/dark mode. Pass the current theme from the canvas component.
 */
export function SyncHtmlTheme({ theme }: SyncHtmlThemeProps) {
	useEffect(() => {
		const isDarkMode = theme === THEME.DARK
		const bg = isDarkMode ? DARK_BG : LIGHT_BG
		const root = document.documentElement
		root.style.setProperty('--app-bg', bg)

		const meta = getThemeColorMeta()
		if (meta) meta.setAttribute('content', bg)

		return () => {
			root.style.removeProperty('--app-bg')
			if (meta) meta.setAttribute('content', LIGHT_BG)
		}
	}, [theme])

	return null
}
