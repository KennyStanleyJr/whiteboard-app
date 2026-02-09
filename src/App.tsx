import { Tldraw } from 'tldraw'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'
import { SyncHtmlTheme } from './SyncHtmlTheme'

function App() {
	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw>
				<SyncHtmlTheme />
			</Tldraw>
			<PwaUpdatePrompt />
		</div>
	)
}

export default App
