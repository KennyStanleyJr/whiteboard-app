import { MIN_ZOOM, MAX_ZOOM } from '@excalidraw/common'
import type { ExcalidrawImperativeAPI, NormalizedZoomValue } from '@excalidraw/excalidraw/types'

/**
 * Relative zoom step per wheel delta (deltaY × this × currentZoom = zoom change).
 * Scaling by current zoom keeps perceived sensitivity consistent at any zoom level.
 */
const WHEEL_ZOOM_SENSITIVITY = 0.002

/**
 * Compute scroll and zoom so that the point (viewportX, viewportY) stays fixed
 * when zoom changes. Matches Excalidraw's internal getStateForZoom logic.
 */
function getStateForZoomAtPoint(
	viewportX: number,
	viewportY: number,
	nextZoom: number,
	state: { scrollX: number; scrollY: number; zoom: { value: number }; offsetLeft: number; offsetTop: number },
): { scrollX: number; scrollY: number; zoom: { value: NormalizedZoomValue } } {
	const appLayerX = viewportX - state.offsetLeft
	const appLayerY = viewportY - state.offsetTop
	const currentZoom = state.zoom.value
	const baseScrollX = state.scrollX + (appLayerX - appLayerX / currentZoom)
	const baseScrollY = state.scrollY + (appLayerY - appLayerY / currentZoom)
	const zoomOffsetScrollX = -(appLayerX - appLayerX / nextZoom)
	const zoomOffsetScrollY = -(appLayerY - appLayerY / nextZoom)
	return {
		scrollX: baseScrollX + zoomOffsetScrollX,
		scrollY: baseScrollY + zoomOffsetScrollY,
		zoom: { value: nextZoom as NormalizedZoomValue },
	}
}

function clampZoom(value: number): number {
	return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
}

/**
 * Install a capture-phase wheel listener so that:
 * - Ctrl/Cmd + wheel: pan (scroll) the canvas up/down.
 * - Plain wheel over canvas: zoom in/out from cursor position.
 */
export function setupCanvasWheelZoom(
	apiRef: { current: ExcalidrawImperativeAPI | null },
): () => void {
	function onWheel(e: WheelEvent): void {
		if (!(e.target instanceof HTMLCanvasElement)) return

		const api = apiRef.current
		if (api == null) return

		const state = api.getAppState()
		const { deltaX, deltaY } = e
		const zoomVal = state.zoom.value

		if (e.ctrlKey || e.metaKey) {
			e.preventDefault()
			e.stopPropagation()
			api.updateScene({
				appState: {
					scrollX: state.scrollX - deltaX / zoomVal,
					scrollY: state.scrollY - deltaY / zoomVal,
				},
			})
			return
		}
		if (e.shiftKey) return

		e.preventDefault()
		e.stopPropagation()
		const delta = -deltaY * WHEEL_ZOOM_SENSITIVITY * zoomVal
		const nextZoom = clampZoom(zoomVal + delta) as NormalizedZoomValue
		const next = getStateForZoomAtPoint(e.clientX, e.clientY, nextZoom, state)
		api.updateScene({ appState: next })
	}

	const opts = { passive: false, capture: true }
	document.addEventListener('wheel', onWheel, opts)
	return () => document.removeEventListener('wheel', onWheel, opts)
}
