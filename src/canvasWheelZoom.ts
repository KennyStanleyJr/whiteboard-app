import { MIN_ZOOM, MAX_ZOOM } from '@excalidraw/common'
import type { ExcalidrawImperativeAPI, NormalizedZoomValue } from '@excalidraw/excalidraw/types'

const WHEEL_ZOOM_SENSITIVITY = 0.002

function getStateForZoomAtPoint(
	viewportX: number, viewportY: number, nextZoom: number,
	state: { scrollX: number; scrollY: number; zoom: { value: number }; offsetLeft: number; offsetTop: number },
): { scrollX: number; scrollY: number; zoom: { value: NormalizedZoomValue } } {
	const appLayerX = viewportX - state.offsetLeft
	const appLayerY = viewportY - state.offsetTop
	const cur = state.zoom.value
	const baseScrollX = state.scrollX + (appLayerX - appLayerX / cur)
	const baseScrollY = state.scrollY + (appLayerY - appLayerY / cur)
	return {
		scrollX: baseScrollX - (appLayerX - appLayerX / nextZoom),
		scrollY: baseScrollY - (appLayerY - appLayerY / nextZoom),
		zoom: { value: nextZoom as NormalizedZoomValue },
	}
}

function clampZoom(value: number): number {
	return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
}

export function setupCanvasWheelZoom(apiRef: { current: ExcalidrawImperativeAPI | null }): () => void {
	function onWheel(e: WheelEvent): void {
		if (!(e.target instanceof HTMLCanvasElement)) return
		const api = apiRef.current
		if (api == null) return
		const { deltaX, deltaY } = e
		if (e.ctrlKey || e.metaKey) {
			e.preventDefault()
			e.stopPropagation()
			const state = api.getAppState()
			const z = state.zoom.value
			api.updateScene({ appState: { scrollX: state.scrollX - deltaX / z, scrollY: state.scrollY - deltaY / z } })
			return
		}
		if (e.shiftKey) return
		e.preventDefault()
		e.stopPropagation()
		const state = api.getAppState()
		const z = state.zoom.value
		const nextZ = clampZoom(z - deltaY * WHEEL_ZOOM_SENSITIVITY * z)
		api.updateScene({ appState: getStateForZoomAtPoint(e.clientX, e.clientY, nextZ, state) })
	}
	const opts = { passive: false, capture: true }
	document.addEventListener('wheel', onWheel, opts)
	return () => document.removeEventListener('wheel', onWheel, opts)
}
