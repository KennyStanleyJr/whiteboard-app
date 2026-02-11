import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import { SyncThemeToDocument, THEME_CACHE_KEY } from './SyncThemeToDocument'

const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY ?? undefined

function getCachedTheme(): 'dark' | 'light' | null {
	try {
		const raw = localStorage.getItem(THEME_CACHE_KEY)
		if (raw === 'light' || raw === 'dark') return raw
	} catch {
		// Ignore storage errors
	}
	return null
}

function App() {
	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				licenseKey={licenseKey}
				onMount={(editor) => {
					const cached = getCachedTheme()
					if (cached !== null) {
						editor.user.updateUserPreferences({ colorScheme: cached })
					} else {
						const prefs = editor.user.getUserPreferences()
						if (prefs.colorScheme === undefined) {
							editor.user.updateUserPreferences({ colorScheme: 'dark' })
						}
					}
				}}
			>
				<SyncThemeToDocument />
			</Tldraw>
		</div>
	)
}

export default App
