import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

type DragState = {
	prevClientX: number
	prevClientY: number
	didPan: boolean
	activePointerId: number | null
	/** Captured at gesture start so we don't rely on getAppState() during drag (avoids drift from async/batched updates). */
	startClientX: number
	startClientY: number
	startScrollX: number
	startScrollY: number
	startZoom: number
	/** Pending requestAnimationFrame id; used to batch scroll updates to once per frame. */
	rafId: number | null
}

function createContextMenuHandler(
	_state: DragState,
): (e: Event) => void {
	return function onContextMenu(e: Event): void {
		if (_state.didPan) {
			e.preventDefault()
			e.stopPropagation()
		}
		document.removeEventListener('contextmenu', onContextMenu, true)
	}
}

function createPointerUpHandler(
	apiRef: { current: ExcalidrawImperativeAPI | null },
	state: DragState,
	onPointerMove: (e: PointerEvent) => void,
	onContextMenu: (e: Event) => void,
): (e: PointerEvent) => void {
	return function onPointerUp(e: PointerEvent): void {
		if (e.pointerId !== state.activePointerId) return
		if (state.rafId !== null) {
			cancelAnimationFrame(state.rafId)
			state.rafId = null
			applyPanFromState(apiRef, state)
		}
		document.body.style.cursor = ''
		document.removeEventListener('pointermove', onPointerMove, true)
		document.removeEventListener('pointerup', onPointerUp, true)
		document.removeEventListener('pointercancel', onPointerUp, true)
		state.activePointerId = null
		setTimeout(() => {
			if (state.activePointerId === null) {
				document.removeEventListener('contextmenu', onContextMenu, true)
			}
		}, 0)
	}
}

function applyPanFromState(
	apiRef: { current: ExcalidrawImperativeAPI | null },
	state: DragState,
): void {
	const api = apiRef.current
	if (api == null) return
	const z = state.startZoom
	const scrollX = state.startScrollX + (state.prevClientX - state.startClientX) / z
	const scrollY = state.startScrollY + (state.prevClientY - state.startClientY) / z
	api.updateScene({ appState: { scrollX, scrollY } })
}

function createPointerMoveHandler(
	apiRef: { current: ExcalidrawImperativeAPI | null },
	state: DragState,
): (e: PointerEvent) => void {
	return function onPointerMove(e: PointerEvent): void {
		if (e.pointerId !== state.activePointerId || e.buttons === 0) return
		if (apiRef.current == null) return
		if (!state.didPan) {
			state.didPan = true
			document.body.style.cursor = 'grabbing'
		}
		e.preventDefault()
		state.prevClientX = e.clientX
		state.prevClientY = e.clientY
		if (state.rafId === null) {
			state.rafId = requestAnimationFrame(() => {
				state.rafId = null
				applyPanFromState(apiRef, state)
			})
		}
	}
}

function createPointerDownHandler(
	apiRef: { current: ExcalidrawImperativeAPI | null },
	state: DragState,
	onPointerMove: (e: PointerEvent) => void,
	onPointerUp: (e: PointerEvent) => void,
	onContextMenu: (e: Event) => void,
): (e: PointerEvent) => void {
	return function onPointerDown(e: PointerEvent): void {
		if (e.button !== 2 || !(e.target instanceof HTMLCanvasElement)) return
		if (state.activePointerId !== null) return
		const api = apiRef.current
		if (api == null) return
		const appState = api.getAppState()
		state.startClientX = e.clientX
		state.startClientY = e.clientY
		state.startScrollX = appState.scrollX
		state.startScrollY = appState.scrollY
		state.startZoom = appState.zoom.value
		state.prevClientX = e.clientX
		state.prevClientY = e.clientY
		state.didPan = false
		state.activePointerId = e.pointerId
		state.rafId = null
		document.removeEventListener('contextmenu', onContextMenu, true)
		document.addEventListener('pointermove', onPointerMove, true)
		document.addEventListener('pointerup', onPointerUp, true)
		document.addEventListener('pointercancel', onPointerUp, true)
		document.addEventListener('contextmenu', onContextMenu, true)
	}
}

export function setupCanvasRightDragPan(apiRef: { current: ExcalidrawImperativeAPI | null }): () => void {
	const state: DragState = {
		prevClientX: 0,
		prevClientY: 0,
		didPan: false,
		activePointerId: null,
		startClientX: 0,
		startClientY: 0,
		startScrollX: 0,
		startScrollY: 0,
		startZoom: 1,
		rafId: null,
	}
	const onContextMenu = createContextMenuHandler(state)
	const onPointerMove = createPointerMoveHandler(apiRef, state)
	const onPointerUp = createPointerUpHandler(apiRef, state, onPointerMove, onContextMenu)
	const onPointerDown = createPointerDownHandler(apiRef, state, onPointerMove, onPointerUp, onContextMenu)

	document.addEventListener('pointerdown', onPointerDown, true)
	return () => {
		if (state.rafId !== null) {
			cancelAnimationFrame(state.rafId)
		}
		document.body.style.cursor = ''
		document.removeEventListener('pointerdown', onPointerDown, true)
		document.removeEventListener('pointermove', onPointerMove, true)
		document.removeEventListener('pointerup', onPointerUp, true)
		document.removeEventListener('pointercancel', onPointerUp, true)
		document.removeEventListener('contextmenu', onContextMenu, true)
	}
}
