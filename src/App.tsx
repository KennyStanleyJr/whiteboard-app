import { Excalidraw, MainMenu, THEME } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { applySceneJsonToCanvas } from './clipboardScene'
import {
	getSceneAsJSON,
	loadStoredScene,
	loadStoredTheme,
	saveSceneToStorage,
	saveStoredTheme,
	SAVE_DEBOUNCE_MS,
} from './storage'
import { SyncHtmlTheme } from './SyncHtmlTheme'
import type { ExcalidrawTheme, OnChangeParams } from './types'

const UI_OPTIONS = { canvasActions: { toggleTheme: true } } as const

/** Clipboard-list icon for Copy as JSON, sized to match other main menu icons. */
function CopyAsJsonIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
			<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
		</svg>
	)
}

function App() {
	const [theme, setTheme] = useState<ExcalidrawTheme>(loadStoredTheme)
	const [initialData] = useState(loadStoredScene)
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null)

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
			setTheme(isDark ? THEME.DARK : THEME.LIGHT)
			saveStoredTheme(isDark ? 'dark' : 'light')

			clearSaveTimeout()
			saveTimeoutRef.current = setTimeout(() => {
				saveTimeoutRef.current = null
				saveSceneToStorage(elements, appState, files)
			}, SAVE_DEBOUNCE_MS)
		},
		[clearSaveTimeout],
	)

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
			if (text == null || text === '') return
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
					<MainMenu.DefaultItems.SearchMenu />
					<MainMenu.DefaultItems.Help />
					<MainMenu.DefaultItems.ClearCanvas />
					<MainMenu.Separator />
					<MainMenu.DefaultItems.ToggleTheme />
					<MainMenu.DefaultItems.ChangeCanvasBackground />
				</MainMenu>
			</Excalidraw>
		</div>
	)
}

export default App
