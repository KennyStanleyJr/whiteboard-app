/**
 * Shows a full-screen overlay when an uncaught error or unhandled rejection
 * occurs. Runs outside React so it catches errors that bypass the error boundary
 * (async code, timers, event handlers). Use in production to diagnose white-screen
 * crashes.
 */
const OVERLAY_ID = 'global-error-overlay'

function showOverlay(title: string, message: string): void {
	if (document.getElementById(OVERLAY_ID)) return

	const root = document.createElement('div')
	root.id = OVERLAY_ID
	root.style.cssText = [
		'position:fixed',
		'inset:0',
		'display:flex',
		'flexDirection:column',
		'alignItems:center',
		'justifyContent:center',
		'padding:24px',
		'backgroundColor:hsl(210,20%,98%)',
		'fontFamily:Inter,sans-serif',
		'textAlign:center',
		'zIndex:2147483647',
		'boxSizing:border-box',
	].join(';')

	const heading = document.createElement('h1')
	heading.textContent = title
	heading.style.cssText = 'font-size:1.25rem;margin:0 0 8px 0;'

	const pre = document.createElement('pre')
	pre.textContent = message
	pre.style.cssText = [
		'max-width:100%',
		'overflow:auto',
		'padding:16px',
		'backgroundColor:hsl(210,20%,92%)',
		'borderRadius:8px',
		'fontSize:12px',
		'textAlign:left',
		'margin:0 0 16px 0',
		'whiteSpace:pre-wrap',
		'wordBreak:break-word',
	].join(';')

	const button = document.createElement('button')
	button.textContent = 'Reload'
	button.type = 'button'
	button.style.cssText =
		'padding:8px 16px;font-size:14px;cursor:pointer;borderRadius:6px;border:1px solid hsl(210,20%,80%);background:white;'
	button.onclick = () => window.location.reload()

	root.append(heading, pre, button)
	document.body.appendChild(root)
}

export function installGlobalErrorHandlers(): void {
	window.onerror = (msg, _source, _lineno, _colno, error) => {
		const message =
			error instanceof Error
				? error.stack ?? error.message
				: typeof msg === 'string'
					? msg
					: 'Unknown error'
		showOverlay('Something went wrong', message)
		return true
	}

	window.onunhandledrejection = (event: PromiseRejectionEvent) => {
		const r: unknown = event.reason
		const message =
			r instanceof Error
				? r.stack ?? r.message
				: typeof r === 'string'
					? r
					: 'Unknown rejection'
		showOverlay('Unhandled error', message)
		event.preventDefault()
	}

	startDomWatchdog()
}

const WATCHDOG_INTERVAL_MS = 2000
const WATCHDOG_DELAY_MS = 5000

/**
 * If the app root becomes empty (e.g. React unmounts or canvas/WebGL fails
 * without throwing), show recovery overlay. Catches "white screen" with no
 * console errors.
 */
function startDomWatchdog(): void {
	let emptyCount = 0
	window.setTimeout(() => {
		const intervalId = window.setInterval(() => {
			if (document.getElementById(OVERLAY_ID)) return
			const root = document.getElementById('root')
			const isEmpty =
				!root || root.childNodes.length === 0 || root.textContent?.trim() === ''
			if (isEmpty) {
				emptyCount += 1
				if (emptyCount >= 2) {
					window.clearInterval(intervalId)
					showOverlay(
						'App stopped rendering',
						'The app content disappeared (e.g. WebGL context lost or render tree cleared). Reload to recover.',
					)
				}
			} else {
				emptyCount = 0
			}
		}, WATCHDOG_INTERVAL_MS)
	}, WATCHDOG_DELAY_MS)
}
