/**
 * Loading view: full viewport, no scrollbar, theme-aware. Centers the animation.
 */
export function LoadingView({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
	return (
		<div
			className={`tl-container tl-theme__${theme}`}
			style={{
				position: 'fixed',
				inset: 0,
				overflow: 'hidden',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'var(--tl-color-background, var(--app-bg))',
				color: 'var(--tl-color-text)',
			}}
		>
			<LoadingAnimation />
		</div>
	)
}

/**
 * Custom loading animation: a rounded square stroke that draws and undraws.
 * Pure CSS + SVG, no dependencies. Inherits color from parent (works in light/dark mode).
 */
export function LoadingAnimation() {
	return (
		<svg
			width={48}
			height={48}
			viewBox="0 0 48 48"
			aria-hidden="true"
			className="loading-animation"
		>
			<path
				d="M14 8 L34 8 Q40 8 40 14 L40 34 Q40 40 34 40 L14 40 Q8 40 8 34 L8 14 Q8 8 14 8"
				fill="none"
				stroke="currentColor"
				strokeWidth={2.5}
				strokeLinecap="round"
				strokeLinejoin="round"
				pathLength={1}
			/>
		</svg>
	)
}
