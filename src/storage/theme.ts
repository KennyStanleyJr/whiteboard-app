import { THEME } from '@excalidraw/excalidraw'
import type { ExcalidrawTheme } from '../types'

export const THEME_STORAGE_KEY = 'whiteboard-theme'

export function loadStoredTheme(): ExcalidrawTheme {
	if (typeof window === 'undefined') return THEME.LIGHT
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY)
		return stored === 'dark' ? THEME.DARK : THEME.LIGHT
	} catch {
		return THEME.LIGHT
	}
}

export function saveStoredTheme(value: 'light' | 'dark'): void {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, value)
	} catch {
		// Ignore storage errors (e.g. private mode)
	}
}
