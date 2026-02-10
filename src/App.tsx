import { CommandPalette, Excalidraw, MainMenu, THEME } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { applySceneJsonToCanvas } from './clipboardScene'
import { setupContextMenuCopyJsonInjection } from './contextMenuCopyJson'
import { getInitialData } from './initialData'
import { CommandPaletteIcon, CopyAsJsonIcon } from './mainMenuIcons'
import {
	extractPreferences,
	getSceneAsJSON,
	getSelectedSceneAsJSON,
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

	const copySceneToClipboard = useCallback((selectionOnly: boolean) => {
		const api = excalidrawAPIRef.current
		if (api == null) return
		const elements = api.getSceneElements()
		const appState = api.getAppState()
		const files = api.getFiles()
		const json = selectionOnly
			? getSelectedSceneAsJSON(elements, appState, files)
			: getSceneAsJSON(elements, appState, files)
		void navigator.clipboard.writeText(json)
	}, [])

	/** Inject "Copy as JSON" (selection only) and strip "to clipboard" from other copy labels in context menu. */
	useEffect(
		() => setupContextMenuCopyJsonInjection(copySceneToClipboard, excalidrawAPIRef),
		[copySceneToClipboard],
	)

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
						onSelect={() => copySceneToClipboard(false)}
					>
						Copy all as JSON
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
