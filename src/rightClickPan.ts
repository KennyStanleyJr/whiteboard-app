/**
 * Sets up right-click + hold + drag to pan the canvas (same behavior as middle mouse or spacebar + drag).
 * Returns a cleanup function to remove listeners.
 */

const RIGHT_BUTTON = 2
const DRAG_THRESHOLD_SQ = 16 // 4px movement to start pan (avoids treating right-click as pan)

interface EditorLike {
	getContainer(): HTMLElement
	getCamera(): { x: number; y: number; z: number }
	setCamera(
		point: { x: number; y: number; z?: number },
		opts?: { immediate?: boolean }
	): void
	setCursor(opts: { type: string; rotation: number }): void
	getInstanceState(): { cursor: { type: string } }
}

export function setupRightClickPan(editor: EditorLike): () => void {
	const container = editor.getContainer()

	let rightDown = false
	let panning = false
	let justFinishedPan = false
	let lastScreenX = 0
	let lastScreenY = 0
	let prevCursor: string | null = null
	let accDx = 0
	let accDy = 0
	let rafId = 0

	function getScreenPoint(e: PointerEvent): { x: number; y: number } {
		const rect = container.getBoundingClientRect()
		return { x: e.clientX - rect.left, y: e.clientY - rect.top }
	}

	function onPointerDown(e: PointerEvent): void {
		if (e.button !== RIGHT_BUTTON) return
		rightDown = true
		panning = false
		const p = getScreenPoint(e)
		lastScreenX = p.x
		lastScreenY = p.y
	}

	function onPointerMove(e: PointerEvent): void {
		// On move, use 'buttons' bitmask; 'button' is only for down/up and is 0 on move.
		// buttons: 1=left, 2=right, 4=middle
		const rightPressed = (e.buttons & 2) !== 0
		if (!rightDown || !rightPressed) return
		const p = getScreenPoint(e)
		const dx = p.x - lastScreenX
		const dy = p.y - lastScreenY

		if (!panning) {
			const distSq = dx * dx + dy * dy
			if (distSq < DRAG_THRESHOLD_SQ) return
			panning = true
			prevCursor = editor.getInstanceState().cursor.type
			editor.setCursor({ type: 'grabbing', rotation: 0 })
			container.style.cursor = 'grabbing'
			container.setPointerCapture(e.pointerId)
		}

		e.preventDefault()
		e.stopPropagation()
		accDx += dx
		accDy += dy
		lastScreenX = p.x
		lastScreenY = p.y
		if (rafId === 0) {
			rafId = requestAnimationFrame(() => {
				rafId = 0
				if (!panning) return
				const dxApply = accDx
				const dyApply = accDy
				accDx = 0
				accDy = 0
				const { x: cx, y: cy, z: cz } = editor.getCamera()
				editor.setCamera(
					{ x: cx + dxApply / cz, y: cy + dyApply / cz, z: cz },
					{ immediate: true }
				)
			})
		}
	}

	function onPointerUp(e: PointerEvent): void {
		if (e.button !== RIGHT_BUTTON) return
		if (panning) {
			justFinishedPan = true
			e.preventDefault()
			e.stopPropagation()
			if (rafId !== 0) {
				cancelAnimationFrame(rafId)
				rafId = 0
			}
			// Apply any remaining accumulated delta once before ending
			if (accDx !== 0 || accDy !== 0) {
				const { x: cx, y: cy, z: cz } = editor.getCamera()
				editor.setCamera(
					{ x: cx + accDx / cz, y: cy + accDy / cz, z: cz },
					{ immediate: true }
				)
				accDx = 0
				accDy = 0
			}
			container.style.cursor = ''
			if (prevCursor !== null) {
				editor.setCursor({ type: prevCursor, rotation: 0 })
				prevCursor = null
			}
			try {
				container.releasePointerCapture(e.pointerId)
			} catch {
				// ignore if already released
			}
		}
		rightDown = false
		panning = false
	}

	function onContextMenu(e: Event): void {
		if (panning || justFinishedPan) {
			e.preventDefault()
			justFinishedPan = false
		}
	}

	const opts = { capture: true }
	container.addEventListener('pointerdown', onPointerDown, opts)
	container.addEventListener('pointermove', onPointerMove, opts)
	container.addEventListener('pointerup', onPointerUp, opts)
	container.addEventListener('pointercancel', onPointerUp, opts)
	container.addEventListener('contextmenu', onContextMenu, opts)

	return () => {
		if (rafId !== 0) {
			cancelAnimationFrame(rafId)
			rafId = 0
		}
		container.removeEventListener('pointerdown', onPointerDown, opts)
		container.removeEventListener('pointermove', onPointerMove, opts)
		container.removeEventListener('pointerup', onPointerUp, opts)
		container.removeEventListener('pointercancel', onPointerUp, opts)
		container.removeEventListener('contextmenu', onContextMenu, opts)
	}
}
