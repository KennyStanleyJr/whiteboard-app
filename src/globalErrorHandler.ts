/**
 * Shows a full-screen overlay when an uncaught error or unhandled rejection
 * occurs. Runs outside React so it catches errors that bypass the error boundary
 * (async code, timers, event handlers). Use in production to diagnose white-screen
 * crashes.
 */
const OVERLAY_ID = 'global-error-overlay'
const RELOAD_HATCH_ID = 'reload-escape-hatch'

function injectReloadEscapeHatch(): void {
	if (document.getElementById(RELOAD_HATCH_ID)) return
	const a = document.createElement('a')
	a.id = RELOAD_HATCH_ID
	a.href = window.location.href
	a.textContent = 'Reload'
	a.style.cssText = [
		'position:fixed',
		'bottom:12px',
		'right:12px',
		'zIndex:2147483646',
		'padding:8px 14px',
		'fontSize:13px',
		'fontFamily:Inter,sans-serif',
		'backgroundColor:#1a1a1a',
		'color:#fff',
		'textDecoration:none',
		'borderRadius:8px',
		'boxShadow:0 2px 8px rgba(0,0,0,0.2)',
	].join(';')
	a.onclick = (e) => {
		e.preventDefault()
		window.location.reload()
	}
	document.body.appendChild(a)
}

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
	injectReloadEscapeHatch()

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
	startWebGLContextWatchdog()
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

const canvasesWithListeners = new WeakSet<HTMLCanvasElement>()

/**
 * When a WebGL (or 2D) context is lost, the canvas goes blank with no JS error.
 * Attach context-lost listeners to all canvases (including ones tldraw adds
 * later) and show overlay so the user can reload.
 */
function startWebGLContextWatchdog(): void {
	function attachToCanvas(canvas: HTMLCanvasElement): void {
		if (canvasesWithListeners.has(canvas)) return
		canvasesWithListeners.add(canvas)
		canvas.addEventListener(
			'webglcontextlost',
			(event: Event) => {
				event.preventDefault()
				showOverlay(
					'Display problem',
					'The canvas lost its graphics context (often due to too many WebGL contexts or GPU memory). Reload the page to recover.',
				)
			},
			{ capture: true },
		)
	}

	function scanCanvases(): void {
		if (document.getElementById(OVERLAY_ID)) return
		const canvases = document.querySelectorAll('canvas')
		for (let i = 0; i < canvases.length; i++) {
			const el = canvases[i]
			if (el instanceof HTMLCanvasElement) attachToCanvas(el)
		}
	}

	window.setTimeout(() => {
		scanCanvases()
		window.setInterval(scanCanvases, 3000)
	}, 2000)
}
