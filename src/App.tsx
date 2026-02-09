import { Excalidraw, MainMenu, THEME } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
	loadStoredScene,
	loadStoredTheme,
	saveSceneToStorage,
	saveStoredTheme,
	SAVE_DEBOUNCE_MS,
} from './storage'
import { SyncHtmlTheme } from './SyncHtmlTheme'
import type { ExcalidrawTheme, OnChangeParams } from './types'

const UI_OPTIONS = { canvasActions: { toggleTheme: true } } as const

function App() {
	const [theme, setTheme] = useState<ExcalidrawTheme>(loadStoredTheme)
	const [initialData] = useState(loadStoredScene)
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<SyncHtmlTheme theme={theme} />
			<Excalidraw
				theme={theme}
				initialData={initialData ?? undefined}
				onChange={handleChange}
				UIOptions={UI_OPTIONS}
			>
				<MainMenu>
					<MainMenu.DefaultItems.LoadScene />
					<MainMenu.DefaultItems.SaveToActiveFile />
					<MainMenu.DefaultItems.Export />
					<MainMenu.DefaultItems.SaveAsImage />
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
