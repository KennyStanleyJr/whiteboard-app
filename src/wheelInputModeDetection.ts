/**
 * Wheel-based input mode detection (CodePen smvilar/JNgZqy).
 * Trackpads fire >5 wheel events in 66ms; mouse wheels fire discrete clicks.
 * Only updates when the user has not manually set input mode (auto mode).
 * Returns a cleanup function to remove the listener.
 */

const WINDOW_MS = 66
const TRACKPAD_THRESHOLD = 5
const MOUSE_CONFIRM_MS = 2000

interface EditorLike {
	user: {
		updateUserPreferences(prefs: { inputMode: 'trackpad' | 'mouse' }): void
		getUserPreferences(): { inputMode?: 'trackpad' | 'mouse' | null }
	}
	getContainer(): HTMLElement
}

export function setupWheelInputModeDetection(
	editor: EditorLike,
	lastAutoDetectedRef: { current: 'trackpad' | 'mouse' }
): () => void {
	const container = editor.getContainer()
	let wheelCount = 0
	let windowStart = 0
	let detected = false
	let mouseConfirmTimer: ReturnType<typeof setTimeout> | null = null

	function clearMouseTimer(): void {
		if (mouseConfirmTimer !== null) {
			clearTimeout(mouseConfirmTimer)
			mouseConfirmTimer = null
		}
	}

	function canUpdateFromDetection(): boolean {
		const current = editor.user.getUserPreferences().inputMode ?? null
		// Update when: auto mode (null) or value still matches what we last set.
		// Skip when user has manually changed it (current differs from our last set).
		return current === null || current === lastAutoDetectedRef.current
	}

	function onWheel(): void {
		if (detected) return
		if (!canUpdateFromDetection()) return

		const now = performance.now()
		if (now - windowStart > WINDOW_MS) {
			wheelCount = 0
			windowStart = now
		}
		wheelCount += 1

		if (wheelCount > TRACKPAD_THRESHOLD) {
			detected = true
			clearMouseTimer()
			lastAutoDetectedRef.current = 'trackpad'
			editor.user.updateUserPreferences({ inputMode: 'trackpad' })
			return
		}

		// Mouse: discrete events. Start 2s timer on first wheel; if no burst
		// occurs before it fires, confirm mouse.
		if (mouseConfirmTimer === null) {
			mouseConfirmTimer = setTimeout(() => {
				mouseConfirmTimer = null
				if (!detected && canUpdateFromDetection()) {
					detected = true
					lastAutoDetectedRef.current = 'mouse'
					editor.user.updateUserPreferences({ inputMode: 'mouse' })
				}
			}, MOUSE_CONFIRM_MS)
		}
	}

	container.addEventListener('wheel', onWheel, { passive: true })

	return () => {
		clearMouseTimer()
		container.removeEventListener('wheel', onWheel)
	}
}
