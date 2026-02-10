import { CommandPalette, Excalidraw, MainMenu, THEME } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CloudStorageDialog } from './CloudStorageDialog'
import { setupCanvasWheelZoom } from './canvasWheelZoom'
import { applySceneJsonToCanvas } from './clipboardScene'
import { setupContextMenuCopyJsonInjection } from './contextMenuCopyJson'
import { getInitialData } from './initialData'
import {
	CommandPaletteIcon,
	CopyAsJsonIcon,
	LoadCloudIcon,
	SaveCloudIcon,
} from './mainMenuIcons'
import {
	extractPreferences,
	getSceneAsJSON,
	getSelectedSceneAsJSON,
	loadStoredSettings,
	restoreSceneFromData,
	saveSceneToStorage,
	saveStoredSettings,
	SAVE_DEBOUNCE_MS,
} from './storage'
import { SyncHtmlTheme } from './SyncHtmlTheme'
import type { ExcalidrawTheme, OnChangeParams } from './types'

type CloudDialogMode = 'closed' | 'save' | 'load'

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
	const [cloudDialogMode, setCloudDialogMode] = useState<CloudDialogMode>('closed')
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
			// Sync exportWithDarkMode so copy-as-image (context menu) inherits light/dark mode.
			// Export from menu is unchanged: it uses appState and the dialog's toggle.
			if (themeChanged) {
				excalidrawAPIRef.current?.updateScene({
					appState: { exportWithDarkMode: isDark },
				})
			}
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

	const handleLoadCloudScene = useCallback((data: unknown) => {
		const restored = restoreSceneFromData(data)
		if (!restored) return
		const api = excalidrawAPIRef.current
		if (!api) return
		const fileList = Object.values(restored.files)
		if (fileList.length > 0) {
			api.addFiles(fileList)
		}
		const appStateForScene = { ...restored.appState } as Record<string, unknown>
		delete appStateForScene.theme
		api.updateScene({
			elements: restored.elements,
			appState: appStateForScene as typeof restored.appState,
		})
		setCloudDialogMode('closed')
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

	/** Custom wheel: plain scroll zooms from cursor; Ctrl+scroll pans. */
	useEffect(() => {
		return setupCanvasWheelZoom(excalidrawAPIRef)
	}, [])

	/** Paste: apply scene JSON only when focus is not in a text field; otherwise let browser paste. */
	useEffect(() => {
		function isFocusInTextField(): boolean {
			const el = document.activeElement
			if (!(el instanceof HTMLElement)) return false
			return (
				el.closest('input, textarea') != null ||
				el.isContentEditable ||
				el.closest('[contenteditable="true"], [contenteditable=""]') != null
			)
		}

		function onPasteCapture(e: ClipboardEvent) {
			if (isFocusInTextField()) return
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
			<CloudStorageDialog
				mode={cloudDialogMode}
				onClose={() => setCloudDialogMode('closed')}
				excalidrawAPIRef={excalidrawAPIRef}
				onLoadScene={handleLoadCloudScene}
				theme={theme}
			/>
			<Excalidraw
				theme={theme}
				initialData={initialData ?? undefined}
				onChange={handleChange}
				UIOptions={UI_OPTIONS}
				excalidrawAPI={(api) => {
					excalidrawAPIRef.current = api
					// Defer sync until after Excalidraw has mounted (next macrotask).
					setTimeout(() => {
						const current = excalidrawAPIRef.current
						if (!current) return
						const { theme: appTheme } = current.getAppState()
						const { preferences } = loadStoredSettings()
						current.updateScene({
							appState: {
								exportWithDarkMode: appTheme === 'dark',
								exportBackground: preferences.exportBackground ?? false,
							},
						})
					}, 0)
				}}
			>
				<CommandPalette />
				<MainMenu>
					<MainMenu.Group
						className="main-menu-cloud-row"
						style={{ display: 'flex', flexDirection: 'row', gap: 0 }}
					>
						<MainMenu.Item
							icon={<SaveCloudIcon />}
							onSelect={() => setCloudDialogMode('save')}
							title="Save to cloud"
							aria-label="Save to cloud"
						>
							{' '}
						</MainMenu.Item>
						<MainMenu.Item
							icon={<LoadCloudIcon />}
							onSelect={() => setCloudDialogMode('load')}
							title="Load from cloud"
							aria-label="Load from cloud"
						>
							{' '}
						</MainMenu.Item>
					</MainMenu.Group>
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
