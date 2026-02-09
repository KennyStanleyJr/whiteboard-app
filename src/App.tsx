import { Tldraw } from 'tldraw'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'
import { SyncHtmlTheme } from './SyncHtmlTheme'

/** Disable Minimap to avoid WebGL context exhaustion/loss (causes white screen). */
const tldrawComponents = { Minimap: null }

function App() {
	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw components={tldrawComponents}>
				<SyncHtmlTheme />
			</Tldraw>
			<PwaUpdatePrompt />
		</div>
	)
}

export default App
