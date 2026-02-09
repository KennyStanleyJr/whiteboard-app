import { Tldraw } from 'tldraw'
import { SyncHtmlTheme } from './SyncHtmlTheme'

function App() {
	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw>
				<SyncHtmlTheme />
			</Tldraw>
		</div>
	)
}

export default App
