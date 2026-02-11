/**
 * Restores Shift+scroll horizontal pan and Ctrl+scroll vertical pan when wheelBehavior is 'zoom'.
 * Shift+scroll inverts the horizontal delta for natural feel; Ctrl+scroll uses raw delta.
 */

const IS_DARWIN = /Mac|iPod|iPhone|iPad/.test(
	typeof navigator !== 'undefined' ? navigator.platform : 'node'
)

const MIN_ZOOM = 0.01

interface EditorLike {
	getContainer(): HTMLElement
	getCamera(): { x: number; y: number; z: number }
	setCamera(
		point: { x: number; y: number; z?: number },
		opts?: { immediate?: boolean }
	): void
	getCameraOptions(): { wheelBehavior: string; panSpeed: number; isLocked?: boolean }
	getInstanceState(): { isFocused: boolean }
	stopCameraAnimation(): void
	stopFollowingUser(): void
}

/** Returns pan deltas (dx, dy) for Shift or Ctrl+scroll; Shift inverts horizontal. Null if not handling. */
function getPanDeltas(editor: EditorLike, event: WheelEvent): { dx: number; dy: number } | null {
	const isShift = event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
	const isCtrl = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey

	if (!isShift && !isCtrl) return null
	if (!editor.getInstanceState().isFocused) return null

	const opts = editor.getCameraOptions()
	if (opts.isLocked || opts.wheelBehavior !== 'zoom') return null

	if (isShift) {
		// On non-Darwin (e.g. Windows), Shift+vertical scroll sends deltaY; swap to horizontal.
		// On Darwin, trackpads send deltaX directly for horizontal gesture.
		const raw = IS_DARWIN ? event.deltaX : event.deltaY
		if (raw === 0) return null
		return { dx: raw, dy: 0 }
	}
	// Ctrl+scroll: vertical pan, invert direction
	const dy = event.deltaY
	if (dy === 0) return null
	return { dx: 0, dy: -dy }
}

export function setupShiftScrollPan(editor: EditorLike): () => void {
	const container = editor.getContainer()

	const onWheel = (event: WheelEvent): void => {
		const deltas = getPanDeltas(editor, event)
		if (deltas === null) return

		event.preventDefault()
		event.stopPropagation()

		const { panSpeed } = editor.getCameraOptions()
		const { x: cx, y: cy, z: cz } = editor.getCamera()
		const safeZ = Number.isFinite(cz) && cz >= MIN_ZOOM ? cz : 1

		editor.stopCameraAnimation()
		editor.stopFollowingUser()

		editor.setCamera(
			{
				x: cx + (deltas.dx * panSpeed) / safeZ,
				y: cy + (deltas.dy * panSpeed) / safeZ,
				z: cz,
			},
			{ immediate: true }
		)
	}

	const opts = { capture: true }
	container.addEventListener('wheel', onWheel, opts)
	return () => container.removeEventListener('wheel', onWheel, opts)
}
