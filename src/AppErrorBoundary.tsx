import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
	children: ReactNode
}

interface State {
	error: Error | null
}

/**
 * Catches React render errors so we show a fallback instead of a white screen.
 * Helps diagnose crashes (e.g. after a few seconds in Chrome).
 */
export class AppErrorBoundary extends Component<Props, State> {
	override state: State = { error: null }

	static getDerivedStateFromError(error: Error): State {
		return { error }
	}

	override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		console.error('AppErrorBoundary caught:', error, errorInfo)
	}

	override render(): ReactNode {
		if (this.state.error) {
			return (
				<div
					style={{
						position: 'fixed',
						inset: 0,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						padding: 24,
						backgroundColor: 'hsl(210, 20%, 98%)',
						fontFamily: 'Inter, sans-serif',
						textAlign: 'center',
					}}
				>
					<h1 style={{ fontSize: '1.25rem', marginBottom: 8 }}>Something went wrong</h1>
					<pre
						style={{
							maxWidth: '100%',
							overflow: 'auto',
							padding: 16,
							backgroundColor: 'hsl(210, 20%, 92%)',
							borderRadius: 8,
							fontSize: 12,
							textAlign: 'left',
							marginBottom: 16,
						}}
					>
						{this.state.error.message}
					</pre>
					<button
						type="button"
						onClick={() => this.setState({ error: null })}
						style={{
							padding: '8px 16px',
							fontSize: 14,
							cursor: 'pointer',
							borderRadius: 6,
							border: '1px solid hsl(210, 20%, 80%)',
							backgroundColor: 'white',
						}}
					>
						Try again
					</button>
				</div>
			)
		}
		return this.props.children
	}
}
