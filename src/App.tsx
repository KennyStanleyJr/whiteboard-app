import { CommandPalette, Excalidraw, MainMenu, THEME } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { applySceneJsonToCanvas } from './clipboardScene'
import {
	applyPreferencesToAppState,
	extractPreferences,
	getSceneAsJSON,
	loadStoredScene,
	loadStoredSettings,
	saveSceneToStorage,
	saveStoredSettings,
	SAVE_DEBOUNCE_MS,
} from './storage'
import { SyncHtmlTheme } from './SyncHtmlTheme'
import type { ExcalidrawTheme, OnChangeParams } from './types'

const UI_OPTIONS = { canvasActions: { toggleTheme: true } } as const

/** Platform-appropriate modifier key for shortcuts (Ctrl on Windows/Linux, ⌘ on Mac). */
const SHORTCUT_MOD =
	typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
		? '⌘/'
		: 'Ctrl+/'

/** Base SVG props for main menu icons (20x20, stroke-based). */
const MENU_ICON_PROPS = {
	width: 20,
	height: 20,
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 2,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	'aria-hidden': true,
} as const

function CommandPaletteIcon() {
	return (
		<svg {...MENU_ICON_PROPS}>
			<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
		</svg>
	)
}

function CopyAsJsonIcon() {
	return (
		<svg {...MENU_ICON_PROPS}>
			<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
			<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
		</svg>
	)
}

function getInitialData() {
	const settings = loadStoredSettings()
	const scene = loadStoredScene()
	if (scene == null) return null
	const appState = scene.appState as unknown as Record<string, unknown>
	applyPreferencesToAppState(appState, settings.preferences)
	return scene
}

function App() {
	const [theme, setTheme] = useState<ExcalidrawTheme>(
		() => (loadStoredSettings().theme === 'dark' ? THEME.DARK : THEME.LIGHT),
	)
	const [initialData] = useState(getInitialData)
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null)
	const lastSavedSettingsRef = useRef<{ theme: ExcalidrawTheme; prefs: string } | null>(null)

	const clearSaveTimeout = useCallback(() => {
		if (saveTimeoutRef.current != null) {
			clearTimeout(saveTimeoutRef.current)
			saveTimeoutRef.current = null
		}
	}, [])

	useEffect(() => () => clearSaveTimeout(), [clearSaveTimeout])

	const handleChange = useCallback(
		(
			elements: OnChangeParams[0],
			appState: OnChangeParams[1],
			files: OnChangeParams[2],
		) => {
			const isDark = appState.theme === 'dark'
			const newTheme = isDark ? THEME.DARK : THEME.LIGHT
			setTheme(newTheme)
			const newPrefs = extractPreferences(appState as unknown as Record<string, unknown>)
			const prefsJson = JSON.stringify(newPrefs)
			const last = lastSavedSettingsRef.current
			const themeChanged = last?.theme !== newTheme
			const prefsChanged = last?.prefs !== prefsJson
			if (themeChanged || prefsChanged) {
				saveStoredSettings({
					theme: isDark ? 'dark' : 'light',
					preferences: newPrefs,
				})
				lastSavedSettingsRef.current = { theme: newTheme, prefs: prefsJson }
			}

			clearSaveTimeout()
			saveTimeoutRef.current = setTimeout(() => {
				saveTimeoutRef.current = null
				saveSceneToStorage(elements, appState, files)
			}, SAVE_DEBOUNCE_MS)
		},
		[clearSaveTimeout],
	)

	const handleOpenCommandPalette = useCallback(() => {
		excalidrawAPIRef.current?.updateScene({
			appState: { openDialog: { name: 'commandPalette' } },
		})
	}, [])

	const handleCopyAsJson = useCallback(() => {
		const api = excalidrawAPIRef.current
		if (api == null) return
		const elements = api.getSceneElements()
		const appState = api.getAppState()
		const files = api.getFiles()
		const json = getSceneAsJSON(elements, appState, files)
		void navigator.clipboard.writeText(json)
	}, [])

	useEffect(() => {
		function onPasteCapture(e: ClipboardEvent) {
			const text = e.clipboardData?.getData('text/plain')?.trim()
			if (!text) return
			if (!applySceneJsonToCanvas(text, excalidrawAPIRef.current)) return
			e.preventDefault()
			e.stopPropagation()
		}
		// Capture phase so we run before Excalidraw and can consume scene-JSON paste once.
		window.addEventListener('paste', onPasteCapture, true)
		return () => window.removeEventListener('paste', onPasteCapture, true)
	}, [])

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<SyncHtmlTheme theme={theme} />
			<Excalidraw
				theme={theme}
				initialData={initialData ?? undefined}
				onChange={handleChange}
				UIOptions={UI_OPTIONS}
				excalidrawAPI={(api) => {
					excalidrawAPIRef.current = api
				}}
			>
				<CommandPalette />
				<MainMenu>
					<MainMenu.DefaultItems.LoadScene />
					<MainMenu.DefaultItems.SaveToActiveFile />
					<MainMenu.DefaultItems.Export />
					<MainMenu.DefaultItems.SaveAsImage />
					<MainMenu.Item
						icon={<CopyAsJsonIcon />}
						onSelect={handleCopyAsJson}
					>
						Copy as JSON
					</MainMenu.Item>
					<MainMenu.Item
						icon={<CommandPaletteIcon />}
						onSelect={handleOpenCommandPalette}
						shortcut={SHORTCUT_MOD}
					>
						Command palette
					</MainMenu.Item>
					<MainMenu.DefaultItems.SearchMenu />
					<MainMenu.DefaultItems.Help />
					<MainMenu.DefaultItems.ClearCanvas />
					<MainMenu.Separator />
					<MainMenu.DefaultItems.ToggleTheme />
					<MainMenu.DefaultItems.Preferences>
						<MainMenu.DefaultItems.Preferences.ToggleGridMode />
						<MainMenu.DefaultItems.Preferences.ToggleZenMode />
						<MainMenu.DefaultItems.Preferences.ToggleViewMode />
						<MainMenu.DefaultItems.Preferences.ToggleElementProperties />
						<MainMenu.DefaultItems.Preferences.ToggleToolLock />
						<MainMenu.DefaultItems.Preferences.ToggleSnapMode />
					</MainMenu.DefaultItems.Preferences>
					<MainMenu.DefaultItems.ChangeCanvasBackground />
				</MainMenu>
			</Excalidraw>
		</div>
	)
}

export default App
