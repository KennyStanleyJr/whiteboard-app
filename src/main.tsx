import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AppErrorBoundary } from './AppErrorBoundary.tsx'
import './index.css'

if (import.meta.env.PROD) {
	type PwaRegister = { registerSW: (opts: { immediate: boolean }) => void }
	import('virtual:pwa-register')
		.then((mod: PwaRegister) => {
			mod.registerSW({ immediate: true })
		})
		.catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<AppErrorBoundary>
			<App />
		</AppErrorBoundary>
	</React.StrictMode>
)
