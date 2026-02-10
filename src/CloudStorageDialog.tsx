import { THEME } from '@excalidraw/excalidraw'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getSceneAsJSON } from './storage'
import { isSupabaseConfigured } from './supabase/client'
import {
	deleteWhiteboard,
	listWhiteboards,
	loadWhiteboard,
	saveWhiteboard,
	type ListWhiteboardItem,
} from './supabase/whiteboards'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { RefObject } from 'react'
import type { ExcalidrawTheme } from './types'

type Mode = 'closed' | 'save' | 'load'

type Props = {
	mode: Mode
	onClose: () => void
	excalidrawAPIRef: RefObject<ExcalidrawImperativeAPI | null>
	onLoadScene: (data: unknown) => void
	theme: ExcalidrawTheme
}

type PendingOverwrite = {
	name: string
	password: string
	data: unknown
}

/** When set, user must enter current password in the form's password field to overwrite. */
type PendingOverwriteWithPassword = {
	name: string
	existingId: string
	newPassword: string
	data: unknown
}

function SaveForm({
	onClose,
	onSaved,
	excalidrawAPIRef,
}: {
	onClose: () => void
	onSaved: () => void
	excalidrawAPIRef: RefObject<ExcalidrawImperativeAPI | null>
}) {
	const [name, setName] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const [overwriteConfirm, setOverwriteConfirm] =
		useState<PendingOverwrite | null>(null)
	const [pendingOverwriteWithPassword, setPendingOverwriteWithPassword] =
		useState<PendingOverwriteWithPassword | null>(null)

	const performSave = useCallback(
		async (params: { name: string; password: string; data: unknown }) => {
			const result = await saveWhiteboard({
				name: params.name,
				password: params.password.trim() || undefined,
				data: params.data,
			})
			if (result.ok) {
				onSaved()
			} else {
				setError(result.error)
			}
		},
		[onSaved],
	)

	const handleOverwriteConfirm = useCallback(() => {
		if (!overwriteConfirm) return
		setLoading(true)
		setOverwriteConfirm(null)
		void performSave(overwriteConfirm).finally(() => setLoading(false))
	}, [overwriteConfirm, performSave])

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			void (async () => {
				setError('')
				const api = excalidrawAPIRef.current
				if (!api) return

				if (pendingOverwriteWithPassword) {
					setLoading(true)
					const result = await loadWhiteboard(
						pendingOverwriteWithPassword.existingId,
						password.trim(),
					)
					setLoading(false)
					if (result.ok) {
						const requestedNew = pendingOverwriteWithPassword.newPassword.trim()
						const currentPassword = password.trim()
						// Empty new password = keep current password; otherwise use the new one.
						const passwordToSave = requestedNew
							? requestedNew
							: currentPassword
						setOverwriteConfirm({
							name: pendingOverwriteWithPassword.name,
							password: passwordToSave,
							data: pendingOverwriteWithPassword.data,
						})
						setPendingOverwriteWithPassword(null)
						setPassword(passwordToSave)
					} else {
						setError(result.error)
					}
					return
				}

				const trimmedName = name.trim()
				const elements = api.getSceneElements()
				const appState = api.getAppState()
				const files = api.getFiles()
				const data = JSON.parse(
					getSceneAsJSON(elements, appState, files),
				) as unknown
				setLoading(true)
				const listResult = await listWhiteboards()
				setLoading(false)
				if (!listResult.ok) {
					setError(listResult.error)
					return
				}
				const existingItem = listResult.items.find(
					(item) => item.name === trimmedName,
				)
				if (existingItem) {
					if (existingItem.hasPassword) {
						setPendingOverwriteWithPassword({
							name: trimmedName,
							existingId: existingItem.id,
							newPassword: password.trim(),
							data,
						})
						setPassword('')
					} else {
						setOverwriteConfirm({
							name: trimmedName,
							password: password.trim(),
							data,
						})
					}
				} else {
					setLoading(true)
					await performSave({
						name: trimmedName,
						password: password.trim(),
						data,
					})
					setLoading(false)
				}
			})()
		},
		[name, password, excalidrawAPIRef, performSave, pendingOverwriteWithPassword],
	)

	return (
		<>
			<form onSubmit={handleSubmit} className="cloud-storage-dialog-form">
				<label>
					Name
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="My whiteboard"
						required
						autoFocus
						readOnly={!!pendingOverwriteWithPassword}
						aria-readonly={!!pendingOverwriteWithPassword}
					/>
				</label>
				<label>
					<div className="cloud-storage-dialog-label-row">
						<span>
							{pendingOverwriteWithPassword
								? 'Password'
								: 'Password (optional)'}
						</span>
						{error && (
							<span className="cloud-storage-dialog-error">{error}</span>
						)}
					</div>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder={
							pendingOverwriteWithPassword
								? 'Enter current password to overwrite'
								: 'Leave empty for no password'
						}
						required={!!pendingOverwriteWithPassword}
					/>
				</label>
				<p className="cloud-storage-dialog-warning">
					{pendingOverwriteWithPassword ? (
						<>
							&quot;{pendingOverwriteWithPassword.name}&quot; is password-protected.
							<br />
							Enter its current password above to overwrite.
						</>
					) : (
						<>
							The password cannot be changed later.
							<br />
							Save a copy if you might need it.
						</>
					)}
				</p>
				<div className="cloud-storage-dialog-actions">
					<button
						type="button"
						onClick={() => {
							if (pendingOverwriteWithPassword) {
								setPendingOverwriteWithPassword(null)
							} else {
								onClose()
							}
						}}
						className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary"
					>
						{pendingOverwriteWithPassword ? 'Back' : 'Cancel'}
					</button>
					<button
						type="submit"
						disabled={loading || (!!pendingOverwriteWithPassword && !password.trim())}
						className="cloud-storage-dialog-btn cloud-storage-dialog-btn--primary"
					>
						{loading
							? pendingOverwriteWithPassword
								? 'Verifying…'
								: 'Saving…'
							: pendingOverwriteWithPassword
								? 'Verify and continue'
								: 'Save'}
					</button>
				</div>
			</form>

			{overwriteConfirm && (
				<div
					className="cloud-storage-dialog-overlay cloud-storage-dialog-overlay-confirm"
					role="alertdialog"
					aria-labelledby="overwrite-confirm-title"
					aria-describedby="overwrite-confirm-desc"
					onClick={() => setOverwriteConfirm(null)}
				>
					<div
						className="cloud-storage-dialog-panel cloud-storage-dialog-confirm-panel"
						onClick={(e) => e.stopPropagation()}
					>
						<h2 id="overwrite-confirm-title" className="cloud-storage-dialog-confirm-title">
							Overwrite?
						</h2>
						<p id="overwrite-confirm-desc" className="cloud-storage-dialog-confirm-desc">
							A whiteboard named &quot;{overwriteConfirm.name}&quot; already exists.
							<br />
							Replace it with the current canvas?
						</p>
						<div className="cloud-storage-dialog-actions">
							<button
								type="button"
								onClick={() => setOverwriteConfirm(null)}
								className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleOverwriteConfirm}
								className="cloud-storage-dialog-btn cloud-storage-dialog-btn--primary"
							>
								Overwrite
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	)
}

/** Three vertical dots (kebab) icon for list item menu. */
function MoreIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
			<circle cx="8" cy="5" r="1.25" />
			<circle cx="8" cy="8" r="1.25" />
			<circle cx="8" cy="11" r="1.25" />
		</svg>
	)
}

function LoadForm({
	onClose,
	onLoaded,
	theme,
}: {
	onClose: () => void
	onLoaded: (data: unknown) => void
	theme: ExcalidrawTheme
}) {
	const [items, setItems] = useState<ListWhiteboardItem[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [loadingId, setLoadingId] = useState<string | null>(null)
	const [passwordFor, setPasswordFor] = useState<string | null>(null)
	const [password, setPassword] = useState('')
	const [openMenuId, setOpenMenuId] = useState<string | null>(null)
	const [dropdownPosition, setDropdownPosition] = useState<{
		bottom: number
		right: number
	} | null>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const dropdownContainerRef = useRef<HTMLDivElement>(null)
	const dropdownMinWidth = 140

	useEffect(() => {
		if (!openMenuId || !menuRef.current) {
			setDropdownPosition(null)
			return
		}
		const rect = menuRef.current.getBoundingClientRect()
		setDropdownPosition({ bottom: rect.bottom, right: rect.right })
	}, [openMenuId])

	type DeleteState =
		| { step: 'password'; item: ListWhiteboardItem }
		| { step: 'confirm'; item: ListWhiteboardItem; password?: string }
	const [deleteState, setDeleteState] = useState<DeleteState | null>(null)
	const [deletePassword, setDeletePassword] = useState('')
	const [deleteError, setDeleteError] = useState('')
	const [copyPasswordFor, setCopyPasswordFor] = useState<{
		id: string
		name: string
	} | null>(null)
	const [copyPassword, setCopyPassword] = useState('')
	const [copyError, setCopyError] = useState('')
	const [copyVerifying, setCopyVerifying] = useState(false)
	const [deleting, setDeleting] = useState(false)

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			const target = e.target as Node
			if (!openMenuId) return
			const inMenu = menuRef.current?.contains(target)
			const inDropdown = dropdownContainerRef.current?.contains(target)
			if (!inMenu && !inDropdown) {
				setOpenMenuId(null)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [openMenuId])

	const fetchList = useCallback(async () => {
		setLoading(true)
		setError('')
		const result = await listWhiteboards()
		setLoading(false)
		if (result.ok) {
			setItems(result.items)
		} else {
			setError(result.error)
		}
	}, [])

	useEffect(() => {
		void fetchList()
	}, [fetchList])

	const handleLoad = useCallback(
		(item: ListWhiteboardItem) => {
			if (item.hasPassword) {
				setPasswordFor(item.id)
				setPassword('')
				return
			}
			void (async () => {
				setLoadingId(item.id)
				setError('')
				const result = await loadWhiteboard(item.id)
				setLoadingId(null)
				if (result.ok) {
					onLoaded(result.data)
				} else {
					setError(result.error)
				}
			})()
		},
		[onLoaded],
	)

	const handlePasswordSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			if (!passwordFor) return
			void (async () => {
				setLoadingId(passwordFor)
				setError('')
				const result = await loadWhiteboard(passwordFor, password)
				setLoadingId(null)
				if (result.ok) {
					setPasswordFor(null)
					setPassword('')
					onLoaded(result.data)
				} else {
					setError(result.error)
				}
			})()
		},
		[passwordFor, password, onLoaded],
	)

	const handleCopyJson = useCallback(
		async (item: ListWhiteboardItem) => {
			setOpenMenuId(null)
			if (item.hasPassword) {
				setCopyPasswordFor({ id: item.id, name: item.name })
				setCopyPassword('')
				setCopyError('')
				return
			}
			const result = await loadWhiteboard(item.id)
			if (result.ok) {
				const json = JSON.stringify(result.data)
				await navigator.clipboard.writeText(json)
			}
		},
		[],
	)

	const handleCopyPasswordSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			if (!copyPasswordFor) return
			void (async () => {
				setCopyError('')
				setCopyVerifying(true)
				const result = await loadWhiteboard(copyPasswordFor.id, copyPassword)
				setCopyVerifying(false)
				if (result.ok) {
					const json = JSON.stringify(result.data)
					await navigator.clipboard.writeText(json)
					setCopyPasswordFor(null)
					setCopyPassword('')
				} else {
					setCopyError(result.error)
				}
			})()
		},
		[copyPasswordFor, copyPassword],
	)

	const handleDeleteClick = useCallback((item: ListWhiteboardItem) => {
		setOpenMenuId(null)
		if (item.hasPassword) {
			setDeleteState({ step: 'password', item })
			setDeletePassword('')
			setDeleteError('')
		} else {
			setDeleteState({ step: 'confirm', item })
		}
	}, [])

	const handleDeletePasswordSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			if (!deleteState || deleteState.step !== 'password') return
			void (async () => {
				setDeleteError('')
				const result = await loadWhiteboard(deleteState.item.id, deletePassword)
				if (result.ok) {
					setDeleteState({
						step: 'confirm',
						item: deleteState.item,
						password: deletePassword,
					})
					setDeletePassword('')
				} else {
					setDeleteError(result.error)
				}
			})()
		},
		[deleteState, deletePassword],
	)

	const handleDeleteConfirm = useCallback(() => {
		if (!deleteState || deleteState.step !== 'confirm') return
		void (async () => {
			setDeleting(true)
			const result = await deleteWhiteboard(
				deleteState.item.id,
				deleteState.password,
			)
			setDeleting(false)
			setDeleteState(null)
			if (result.ok) {
				void fetchList()
			}
		})()
	}, [deleteState, fetchList])

	if (passwordFor) {
		return (
			<form
				onSubmit={handlePasswordSubmit}
				className="cloud-storage-dialog-form"
			>
				<label>
					<div className="cloud-storage-dialog-label-row">
						<span>Password</span>
						{error && (
							<span className="cloud-storage-dialog-error">{error}</span>
						)}
					</div>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						autoFocus
					/>
				</label>
				<p className="cloud-storage-dialog-hint">
					Enter password for the selected whiteboard.
				</p>
				<div className="cloud-storage-dialog-actions">
					<button
						type="button"
						onClick={() => {
							setPasswordFor(null)
							setPassword('')
							setError('')
						}}
						className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary"
					>
						Back
					</button>
					<button
						type="submit"
						disabled={loadingId !== null}
						className="cloud-storage-dialog-btn cloud-storage-dialog-btn--primary"
					>
						{loadingId ? 'Loading…' : 'Load'}
					</button>
				</div>
			</form>
		)
	}

	return (
		<div className="cloud-storage-dialog-form">
			<button
				type="button"
				onClick={() => void fetchList()}
				className="cloud-storage-dialog-refresh"
			>
				Refresh
			</button>
			{loading ? (
				<div className="cloud-storage-dialog-loading">Loading…</div>
			) : error ? (
				<div className="cloud-storage-dialog-error">{error}</div>
			) : items.length === 0 ? (
				<div className="cloud-storage-dialog-hint">No saved whiteboards yet.</div>
			) : (
				<ul className="cloud-storage-dialog-list">
					{items.map((item) => (
						<li key={item.id} className="cloud-storage-dialog-list-item">
							<span className="cloud-storage-dialog-item-name">{item.name}</span>
							<span className="cloud-storage-dialog-item-meta">
								{item.hasPassword ? '🔒' : ''}{' '}
								{new Date(item.updated_at).toLocaleDateString()}
							</span>
							<div
								ref={openMenuId === item.id ? menuRef : undefined}
								className="cloud-storage-dialog-item-menu-wrap"
							>
								<button
									type="button"
									onClick={() =>
										setOpenMenuId(openMenuId === item.id ? null : item.id)
									}
									className="cloud-storage-dialog-item-menu-btn"
									aria-label="Options"
									aria-expanded={openMenuId === item.id}
								>
									<MoreIcon />
								</button>
								{openMenuId === item.id &&
									dropdownPosition &&
									createPortal(
										<div ref={dropdownContainerRef} className={themeClass(theme)}>
											<div
												className="cloud-storage-dialog-item-dropdown cloud-storage-dialog-item-dropdown--fixed"
												role="menu"
												style={{
												top: dropdownPosition.bottom + 2,
												right: window.innerWidth - dropdownPosition.right,
												minWidth: dropdownMinWidth,
											}}
											>
											<button
												type="button"
												role="menuitem"
												onClick={() => void handleCopyJson(item)}
												className="cloud-storage-dialog-dropdown-item"
											>
												Copy JSON
											</button>
											<button
												type="button"
												role="menuitem"
												onClick={() => handleDeleteClick(item)}
												className="cloud-storage-dialog-dropdown-item cloud-storage-dialog-dropdown-item--danger"
											>
												Delete
											</button>
											</div>
										</div>,
										document.body,
									)}
							</div>
							<button
								type="button"
								onClick={() => handleLoad(item)}
								disabled={loadingId !== null}
								className="cloud-storage-dialog-load-btn"
							>
								{loadingId === item.id ? 'Loading…' : 'Load'}
							</button>
						</li>
					))}
				</ul>
			)}
			{copyPasswordFor && (
				<div
					className="cloud-storage-dialog-overlay cloud-storage-dialog-overlay-confirm"
					role="dialog"
					aria-labelledby="copy-password-title"
					onClick={() => {
						if (!copyVerifying) {
							setCopyPasswordFor(null)
							setCopyPassword('')
							setCopyError('')
						}
					}}
				>
					<div
						className="cloud-storage-dialog-panel cloud-storage-dialog-confirm-panel"
						onClick={(e) => e.stopPropagation()}
					>
						<h2 id="copy-password-title" className="cloud-storage-dialog-confirm-title">
							Copy JSON
						</h2>
						<p className="cloud-storage-dialog-confirm-desc">
							Enter password for &quot;{copyPasswordFor.name}&quot;.
						</p>
						<form onSubmit={handleCopyPasswordSubmit} className="cloud-storage-dialog-form">
							<label>
								<div className="cloud-storage-dialog-label-row">
									<span>Password</span>
									{copyError && (
										<span className="cloud-storage-dialog-error">{copyError}</span>
									)}
								</div>
								<input
									type="password"
									value={copyPassword}
									onChange={(e) => setCopyPassword(e.target.value)}
									required
									autoFocus
									disabled={copyVerifying}
								/>
							</label>
							<div className="cloud-storage-dialog-actions">
								<button
									type="button"
									onClick={() => {
										setCopyPasswordFor(null)
										setCopyPassword('')
										setCopyError('')
									}}
									disabled={copyVerifying}
									className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={copyVerifying}
									className="cloud-storage-dialog-btn cloud-storage-dialog-btn--primary"
								>
									{copyVerifying ? 'Verifying…' : 'Copy'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
			{deleteState?.step === 'password' && (
				<div
					className="cloud-storage-dialog-overlay cloud-storage-dialog-overlay-confirm"
					role="dialog"
					aria-labelledby="delete-password-title"
					onClick={() => {
						setDeleteState(null)
						setDeletePassword('')
						setDeleteError('')
					}}
				>
					<div
						className="cloud-storage-dialog-panel cloud-storage-dialog-confirm-panel"
						onClick={(e) => e.stopPropagation()}
					>
						<h2 id="delete-password-title" className="cloud-storage-dialog-confirm-title">
							Delete whiteboard
						</h2>
						<p className="cloud-storage-dialog-confirm-desc">
							&quot;{deleteState.item.name}&quot; is password-protected. Enter its
							password to continue.
						</p>
						<form
							onSubmit={handleDeletePasswordSubmit}
							className="cloud-storage-dialog-form"
						>
							<label>
								<div className="cloud-storage-dialog-label-row">
									<span>Password</span>
									{deleteError && (
										<span className="cloud-storage-dialog-error">{deleteError}</span>
									)}
								</div>
								<input
									type="password"
									value={deletePassword}
									onChange={(e) => setDeletePassword(e.target.value)}
									required
									autoFocus
								/>
							</label>
							<div className="cloud-storage-dialog-actions">
								<button
									type="button"
									onClick={() => {
										setDeleteState(null)
										setDeletePassword('')
										setDeleteError('')
									}}
									className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary"
								>
									Cancel
								</button>
								<button
									type="submit"
									className="cloud-storage-dialog-btn cloud-storage-dialog-btn--primary"
								>
									Continue
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
			{deleteState?.step === 'confirm' && (
				<div
					className="cloud-storage-dialog-overlay cloud-storage-dialog-overlay-confirm"
					role="alertdialog"
					aria-labelledby="delete-confirm-title"
					aria-describedby="delete-confirm-desc"
					onClick={() => setDeleteState(null)}
				>
					<div
						className="cloud-storage-dialog-panel cloud-storage-dialog-confirm-panel"
						onClick={(e) => e.stopPropagation()}
					>
						<h2 id="delete-confirm-title" className="cloud-storage-dialog-confirm-title">
							Delete whiteboard?
						</h2>
						<p id="delete-confirm-desc" className="cloud-storage-dialog-confirm-desc">
							&quot;{deleteState.item.name}&quot; will be permanently deleted.
							<br />
							This cannot be undone.
						</p>
						<div className="cloud-storage-dialog-actions">
							<button
								type="button"
								onClick={() => setDeleteState(null)}
								className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleDeleteConfirm}
								disabled={deleting}
								className="cloud-storage-dialog-btn cloud-storage-dialog-btn--danger"
							>
								{deleting ? 'Deleting…' : 'Delete'}
							</button>
						</div>
					</div>
				</div>
			)}
			<div className="cloud-storage-dialog-actions">
				<button
					type="button"
					onClick={onClose}
					className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary"
				>
					Close
				</button>
			</div>
		</div>
	)
}

function themeClass(theme: ExcalidrawTheme): string {
	return theme === THEME.DARK ? 'excalidraw theme--dark' : 'excalidraw theme--light'
}

export function CloudStorageDialog({
	mode,
	onClose,
	excalidrawAPIRef,
	onLoadScene,
	theme,
}: Props) {
	const configured = isSupabaseConfigured()

	if (mode === 'closed') return null

	const title = mode === 'save' ? 'Save to cloud' : 'Load from cloud'

	if (!configured) {
		return (
			<div
				className="cloud-storage-dialog-overlay"
				onClick={onClose}
				role="presentation"
			>
				<div className={themeClass(theme)}>
					<div
						className="cloud-storage-dialog-panel"
						onClick={(e) => e.stopPropagation()}
						role="dialog"
						aria-labelledby="cloud-dialog-title"
					>
						<h2 id="cloud-dialog-title">{title}</h2>
						<p className="cloud-storage-dialog-hint">
							Supabase is not configured. Add VITE_SUPABASE_URL and
							VITE_SUPABASE_ANON_KEY to your .env file.
						</p>
						<button
							type="button"
							onClick={onClose}
							className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div
			className="cloud-storage-dialog-overlay"
			onClick={onClose}
			role="presentation"
		>
			<div className={themeClass(theme)}>
				<div
					className="cloud-storage-dialog-panel"
					onClick={(e) => e.stopPropagation()}
					role="dialog"
					aria-labelledby="cloud-dialog-title"
				>
					<h2 id="cloud-dialog-title">{title}</h2>
					<p className="cloud-storage-dialog-hint cloud-storage-dialog-description">
						Please use cloud storage responsibly.
					</p>
					{mode === 'save' ? (
						<SaveForm
							onClose={onClose}
							onSaved={onClose}
							excalidrawAPIRef={excalidrawAPIRef}
						/>
					) : (
						<LoadForm
							onClose={onClose}
							onLoaded={onLoadScene}
							theme={theme}
						/>
					)}
				</div>
			</div>
		</div>
	)
}
