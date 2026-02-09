import { Excalidraw, MainMenu, THEME } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { useCallback, useState } from 'react'
import { SyncHtmlTheme } from './SyncHtmlTheme'

const THEME_STORAGE_KEY = 'whiteboard-theme'

function loadStoredTheme(): typeof THEME.LIGHT | typeof THEME.DARK {
	if (typeof window === 'undefined') return THEME.LIGHT
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY)
		return stored === 'dark' ? THEME.DARK : THEME.LIGHT
	} catch {
		return THEME.LIGHT
	}
}

function App() {
	const [theme, setTheme] = useState<typeof THEME.LIGHT | typeof THEME.DARK>(
		loadStoredTheme,
	)

	const handleChange = useCallback(
		(_elements: unknown, appState: { theme?: string }) => {
			const next =
				appState.theme === 'dark' ? THEME.DARK : THEME.LIGHT
			setTheme(next)
			try {
				localStorage.setItem(
					THEME_STORAGE_KEY,
					appState.theme === 'dark' ? 'dark' : 'light',
				)
			} catch {
				// Ignore storage errors (e.g. private mode)
			}
		},
		[],
	)

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<SyncHtmlTheme theme={theme} />
			<Excalidraw
				theme={theme}
				onChange={handleChange}
				UIOptions={{
					canvasActions: {
						toggleTheme: true,
					},
				}}
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
