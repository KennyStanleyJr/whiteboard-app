import { useEffect, useRef, useState } from 'react'

/**
 * Registers the PWA service worker in production when enabled, and shows a
 * prompt when an update is available. Uses prompt mode so the page is never
 * taken over by a new SW unexpectedly.
 *
 * Service worker registration is disabled by default (white screen in prod).
 * Set VITE_ENABLE_PWA=true at build time to enable SW and update prompts.
 * Uses immediate: true so registration runs when this effect runs instead of
 * waiting for the load event.
 */
type UpdateSw = (reloadPage?: boolean) => Promise<void>

const PWA_ENABLED = import.meta.env.VITE_ENABLE_PWA === 'true'

export function PwaUpdatePrompt() {
	const [needRefresh, setNeedRefresh] = useState(false)
	const updateSwRef = useRef<UpdateSw | null>(null)

	useEffect(() => {
		if (!import.meta.env.PROD || !PWA_ENABLED) return

		void import('virtual:pwa-register').then(({ registerSW }) => {
			const updateSw = registerSW({
				immediate: true,
				onNeedRefresh: () => setNeedRefresh(true),
				onOfflineReady: () => {},
			})
			updateSwRef.current = updateSw
		})
	}, [])

	if (!needRefresh) return null

	const handleReload = (): void => {
		void updateSwRef.current?.()
	}

	const handleLater = (): void => {
		setNeedRefresh(false)
	}

	return (
		<div
			role="alert"
			aria-live="polite"
			style={{
				position: 'fixed',
				bottom: 16,
				left: 16,
				right: 16,
				maxWidth: 360,
				margin: '0 auto',
				padding: 16,
				backgroundColor: 'hsl(210, 20%, 14%)',
				color: 'hsl(210, 20%, 98%)',
				borderRadius: 12,
				boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
				fontFamily: 'Inter, sans-serif',
				fontSize: 14,
				zIndex: 9999,
				display: 'flex',
				flexDirection: 'column',
				gap: 12,
			}}
		>
			<span>A new version is available.</span>
			<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
				<button
					type="button"
					onClick={handleLater}
					style={{
						padding: '8px 14px',
						fontSize: 13,
						border: 'none',
						borderRadius: 6,
						background: 'hsl(210, 20%, 28%)',
						color: 'inherit',
						cursor: 'pointer',
					}}
				>
					Later
				</button>
				<button
					type="button"
					onClick={handleReload}
					style={{
						padding: '8px 14px',
						fontSize: 13,
						border: 'none',
						borderRadius: 6,
						background: 'hsl(210, 80%, 50%)',
						color: 'white',
						cursor: 'pointer',
					}}
				>
					Reload
				</button>
			</div>
		</div>
	)
}
