/**
 * Tiny connection indicator for shared pages. Shows sync status: "synced", "reconnecting...", or "error".
 * On timeout or error, shows a retry button. Compact container with colored dot.
 * Only shown when current page is shared.
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { useEditor, useValue } from '@tldraw/editor'
import { TldrawUiIcon } from 'tldraw'
import { getShareIdForPage } from './sharePage'

export type SyncStatus =
	| { status: 'no-sync' }
	| { status: 'loading' }
	| { status: 'error' }
	| { status: 'synced-remote'; connectionStatus: 'online' | 'offline' }

const INDICATOR_DELAY_MS = 300
const CONNECTION_TIMEOUT_MS = 10_000

/** True when we're waiting for a connection (loading or reconnecting). */
function isConnecting(status: SyncStatus): boolean {
	if (status.status === 'loading') return true
	if (status.status === 'synced-remote' && status.connectionStatus === 'offline') return true
	return false
}

const ConnectionIndicatorContext = createContext<{
	status: SyncStatus
	onRetry?: () => void
} | null>(null)

function getDotColor(status: SyncStatus): string {
	if (status.status === 'synced-remote' && status.connectionStatus === 'online') return 'var(--tl-color-success)'
	if (status.status === 'error') return 'var(--tl-color-danger)'
	return 'var(--tl-color-warning)'
}

function getDisplayText(status: SyncStatus): 'synced' | 'reconnecting...' | 'error' {
	if (status.status === 'synced-remote' && status.connectionStatus === 'online') return 'synced'
	if (status.status === 'synced-remote' && status.connectionStatus === 'offline') return 'reconnecting...'
	if (status.status === 'loading') return 'reconnecting...'
	if (status.status === 'error') return 'error'
	return 'reconnecting...'
}

function getSyncTooltip(status: SyncStatus): string {
	if (status.status === 'synced-remote' && status.connectionStatus === 'online')
		return 'Connected to sync server – changes sync in real time'
	if (status.status === 'synced-remote' && status.connectionStatus === 'offline')
		return 'Sync server disconnected – reconnecting…'
	if (status.status === 'error') return 'Sync server connection failed – click to retry'
	return 'Connecting to sync server…'
}

/** Renders sync status (dot + text). Only visible when current page is shared. Must be inside Tldraw and ConnectionIndicatorProvider. */
export function ConnectionIndicator() {
	const ctx = useContext(ConnectionIndicatorContext)
	const editor = useEditor()
	const currentPageId = useValue('currentPageId', () => editor.getCurrentPageId(), [editor])
	const isDarkMode = useValue('isDarkMode', () => editor.user.getIsDarkMode(), [editor])
	const theme = isDarkMode ? 'dark' : 'light'
	const isShared = currentPageId ? !!getShareIdForPage(currentPageId) : false
	const [visible, setVisible] = useState(false)
	const [timedOut, setTimedOut] = useState(false)

	useEffect(() => {
		const t = setTimeout(() => setVisible(true), INDICATOR_DELAY_MS)
		return () => clearTimeout(t)
	}, [])

	const statusKey =
		ctx?.status.status === 'synced-remote'
			? `synced-${ctx.status.connectionStatus}`
			: ctx?.status.status ?? 'none'
	useEffect(() => {
		if (!ctx || !isConnecting(ctx.status)) {
			setTimedOut(false)
			return
		}
		const t = setTimeout(() => setTimedOut(true), CONNECTION_TIMEOUT_MS)
		return () => clearTimeout(t)
	}, [ctx, statusKey])

	if (!ctx || !isShared || !visible) return null

	const effectiveStatus: SyncStatus =
		timedOut && isConnecting(ctx.status) ? { status: 'error' } : ctx.status
	const isError = effectiveStatus.status === 'error'
	const text = getDisplayText(effectiveStatus)
	const dotColor = getDotColor(effectiveStatus)
	const tooltip = getSyncTooltip(effectiveStatus)
	const textColor = theme === 'light' ? '#000' : '#fff'
	const textOpacity = theme === 'light' ? 0.5 : 0.25

	const baseStyle: React.CSSProperties = {
		display: 'inline-flex',
		alignItems: 'center',
		gap: 6,
		fontSize: 12,
		fontWeight: 400,
		lineHeight: 1,
		color: textColor,
		opacity: textOpacity,
		margin: 0,
		padding: 0,
		pointerEvents: 'all',
	}
	const content = (
		<>
			<span
				style={{
					width: 6,
					height: 6,
					borderRadius: '50%',
					backgroundColor: dotColor,
					flexShrink: 0,
				}}
			/>
			<span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1, transform: 'translateY(-1px)' }}>
				{text}
			</span>
			{isError && (
				<span style={{ display: 'inline-flex', transform: 'scale(0.8) translateY(1px)', lineHeight: 0 }}>
					<TldrawUiIcon icon="arrow-cycle" label="" small />
				</span>
			)}
		</>
	)
	if (isError && ctx.onRetry) {
		return (
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation()
					ctx.onRetry?.()
				}}
				aria-label={tooltip}
				title={tooltip}
				className={`tl-container tl-theme__${theme}`}
				style={{
					...baseStyle,
					background: 'transparent',
					border: 'none',
					cursor: 'pointer',
					fontFamily: 'inherit',
				}}
			>
				{content}
			</button>
		)
	}
	return (
		<div
			className={`tl-container tl-theme__${theme}`}
			style={baseStyle}
			title={tooltip}
			aria-label={tooltip}
		>
			{content}
		</div>
	)
}

export function ConnectionIndicatorProvider({
	status,
	onRetry,
	children,
}: {
	status: SyncStatus
	onRetry?: () => void
	children: React.ReactNode
}) {
	return (
		<ConnectionIndicatorContext.Provider value={{ status, onRetry }}>
			{children}
		</ConnectionIndicatorContext.Provider>
	)
}
