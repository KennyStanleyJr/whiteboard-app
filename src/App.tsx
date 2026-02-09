import { Excalidraw, THEME } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { useCallback, useState } from 'react'
import { SyncHtmlTheme } from './SyncHtmlTheme'

function App() {
	const [theme, setTheme] = useState<typeof THEME.LIGHT | typeof THEME.DARK>(
		THEME.LIGHT,
	)

	const handleChange = useCallback(
		(_elements: unknown, appState: { theme?: string }) => {
			const next =
				appState.theme === 'dark' ? THEME.DARK : THEME.LIGHT
			setTheme(next)
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
			/>
		</div>
	)
}

export default App
