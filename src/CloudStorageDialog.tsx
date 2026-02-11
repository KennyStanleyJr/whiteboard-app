import { THEME } from '@excalidraw/excalidraw'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
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
import type { Dispatch, RefObject, SetStateAction } from 'react'
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

type SavePhaseState =
	| { phase: 'idle'; error: string }
	| { phase: 'listing'; error: string }
	| { phase: 'overwrite_confirm'; payload: PendingOverwrite; error: string }
	| { phase: 'saving'; error: string }

type SavePhaseAction =
	| { type: 'LIST_START' }
	| { type: 'LIST_RESULT_EXISTS'; item: ListWhiteboardItem; data: unknown; password: string }
	| { type: 'OVERWRITE_CONFIRM'; payload: PendingOverwrite }
	| { type: 'START_SAVE' }
	| { type: 'SAVE_DONE' }
	| { type: 'SAVE_ERROR'; error: string }
	| { type: 'SET_ERROR'; error: string }
	| { type: 'CANCEL' }

const initialSavePhase: SavePhaseState = { phase: 'idle', error: '' }

/** Runs the save flow after list is fetched: verify overwrite or confirm or save. */
async function runSaveSubmitFlow(
	trimmedName: string,
	password: string,
	data: unknown,
	listResult: { ok: true; items: ListWhiteboardItem[] },
	dispatchSave: Dispatch<SavePhaseAction>,
	performSave: (params: { name: string; password: string; data: unknown }) => Promise<void>,
): Promise<void> {
	const existingItem = listResult.items.find((item) => item.name === trimmedName)
	if (existingItem) {
		if (existingItem.hasPassword) {
			const verifyResult = await loadWhiteboard(existingItem.id, password)
			if (!verifyResult.ok) {
				dispatchSave({ type: 'SET_ERROR', error: verifyResult.error })
				return
			}
		}
		dispatchSave({
			type: 'LIST_RESULT_EXISTS',
			item: existingItem,
			data,
			password,
		})
	} else {
		dispatchSave({ type: 'START_SAVE' })
		void performSave({ name: trimmedName, password, data })
	}
}

function savePhaseReducer(state: SavePhaseState, action: SavePhaseAction): SavePhaseState {
	switch (action.type) {
		case 'LIST_START':
			return { phase: 'listing', error: '' }
		case 'LIST_RESULT_EXISTS': {
			const { item, data, password } = action
			return { phase: 'overwrite_confirm', payload: { name: item.name, password, data }, error: '' }
		}
		case 'OVERWRITE_CONFIRM':
			return { ...state, phase: 'overwrite_confirm', payload: action.payload, error: '' }
		case 'START_SAVE':
			return { phase: 'saving', error: '' }
		case 'SAVE_DONE':
			return { phase: 'idle', error: '' }
		case 'SAVE_ERROR':
			return { phase: 'idle', error: action.error }
		case 'SET_ERROR':
			if (state.phase === 'listing') {
				return { phase: 'idle', error: action.error }
			}
			return { ...state, error: action.error }
		case 'CANCEL':
			return { phase: 'idle', error: '' }
		default:
			return state
	}
}

function SaveOverwriteConfirmOverlay({
	overwriteConfirm,
	onCancel,
	onOverwrite,
}: {
	overwriteConfirm: PendingOverwrite
	onCancel: () => void
	onOverwrite: () => void
}) {
	return (
		<div
			className="cloud-storage-dialog-overlay cloud-storage-dialog-overlay-confirm"
			role="alertdialog"
			aria-labelledby="overwrite-confirm-title"
			aria-describedby="overwrite-confirm-desc"
			onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
		>
			<div
				className="cloud-storage-dialog-panel cloud-storage-dialog-confirm-panel"
				onMouseDown={(e) => e.stopPropagation()}
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
					<button type="button" onClick={onCancel} className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary">
						Cancel
					</button>
					<button type="button" onClick={onOverwrite} className="cloud-storage-dialog-btn cloud-storage-dialog-btn--primary">
						Overwrite
					</button>
				</div>
			</div>
		</div>
	)
}

function SaveFormNameField({
	name,
	setName,
	existingItems,
	theme,
	open,
	setOpen,
}: {
	name: string
	setName: (v: string) => void
	existingItems: ListWhiteboardItem[]
	theme: ExcalidrawTheme
	open: boolean
	setOpen: Dispatch<SetStateAction<boolean>>
}) {
	const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)
	const nameComboRef = useRef<HTMLDivElement>(null)
	const nameDropdownRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open || !nameComboRef.current) {
			setPosition(null)
			return
		}
		const rect = nameComboRef.current.getBoundingClientRect()
		setPosition({ top: rect.bottom + 2, left: rect.left, width: rect.width })
	}, [open])
	useEffect(() => {
		if (!open) return
		function handleClickOutside(e: MouseEvent) {
			const target = e.target as Node
			if (!nameComboRef.current?.contains(target) && !nameDropdownRef.current?.contains(target)) setOpen(false)
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [open, setOpen])
	const themeClassName = theme === THEME.DARK ? 'excalidraw theme--dark' : 'excalidraw theme--light'
	return (
		<label className="cloud-storage-dialog-name-combo">
			Name
			<div ref={nameComboRef} className="cloud-storage-dialog-name-input-wrap">
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					onBlur={() => setTimeout(() => setOpen(false), 150)}
					placeholder="My whiteboard"
					required
					autoFocus
					autoComplete="off"
					aria-expanded={open}
					aria-haspopup="listbox"
					aria-controls="save-name-listbox"
					id="save-name-input"
				/>
				<button
					type="button"
					className="cloud-storage-dialog-name-dropdown-btn"
					onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o) }}
					aria-label="Show saved whiteboards"
					aria-expanded={open}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
						<path d="M4 6l4 4 4-4" />
					</svg>
				</button>
				{open && position &&
					createPortal(
						<div ref={nameDropdownRef} className={themeClassName}>
							<div
								id="save-name-listbox"
								className="cloud-storage-dialog-name-dropdown cloud-storage-dialog-name-dropdown--fixed"
								role="listbox"
								style={{ top: position.top, left: position.left, width: position.width }}
							>
								{existingItems.length > 0 ? (
									existingItems.map((item) => (
										<button
											key={item.id}
											type="button"
											role="option"
											className="cloud-storage-dialog-name-dropdown-item"
											onMouseDown={(e) => { e.preventDefault(); setName(item.name); setOpen(false) }}
										>
											{item.name}{item.hasPassword ? ' 🔒' : ''}
										</button>
									))
								) : (
									<div className="cloud-storage-dialog-name-dropdown-empty">No saved whiteboards</div>
								)}
							</div>
						</div>,
						document.body,
					)}
			</div>
		</label>
	)
}

function SaveForm({
	onClose,
	onSaved,
	excalidrawAPIRef,
	theme,
}: {
	onClose: () => void
	onSaved: () => void
	excalidrawAPIRef: RefObject<ExcalidrawImperativeAPI | null>
	theme: ExcalidrawTheme
}) {
	const [name, setName] = useState('')
	const [password, setPassword] = useState('')
	const [saveState, dispatchSave] = useReducer(savePhaseReducer, initialSavePhase)
	const [existingItems, setExistingItems] = useState<ListWhiteboardItem[]>([])
	const [nameDropdownOpen, setNameDropdownOpen] = useState(false)

	useEffect(() => {
		void listWhiteboards().then((r) => r.ok && setExistingItems(r.items))
	}, [])

	const loading = saveState.phase === 'listing' || saveState.phase === 'saving'
	const error = saveState.error
	const overwriteConfirm = saveState.phase === 'overwrite_confirm' ? saveState.payload : null
	const isOverwritingProtected = existingItems.some((item) => item.name === name.trim() && item.hasPassword)

	const performSave = useCallback(
		async (params: { name: string; password: string; data: unknown }) => {
			const result = await saveWhiteboard({
				name: params.name,
				password: params.password.trim() || undefined,
				data: params.data,
			})
			if (result.ok) {
				dispatchSave({ type: 'SAVE_DONE' })
				onSaved()
			} else {
				dispatchSave({ type: 'SAVE_ERROR', error: result.error })
			}
		},
		[onSaved],
	)

	const handleOverwriteConfirm = useCallback(() => {
		if (saveState.phase !== 'overwrite_confirm') return
		dispatchSave({ type: 'START_SAVE' })
		void performSave(saveState.payload)
	}, [saveState, performSave])

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			void (async () => {
				const api = excalidrawAPIRef.current
				if (!api) return
				const trimmedName = name.trim()
				const data = JSON.parse(
					getSceneAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles()),
				) as unknown
				dispatchSave({ type: 'LIST_START' })
				const listResult = await listWhiteboards()
				if (!listResult.ok) {
					dispatchSave({ type: 'SAVE_ERROR', error: listResult.error })
					return
				}
				await runSaveSubmitFlow(trimmedName, password.trim(), data, listResult, dispatchSave, performSave)
			})()
		},
		[name, password, excalidrawAPIRef, performSave],
	)

	return (
		<>
			<form onSubmit={handleSubmit} className="cloud-storage-dialog-form">
				<SaveFormNameField
					name={name}
					setName={setName}
					existingItems={existingItems}
					theme={theme}
					open={nameDropdownOpen}
					setOpen={setNameDropdownOpen}
				/>
				<label>
					<div className="cloud-storage-dialog-label-row">
						<span>{isOverwritingProtected ? 'Password' : 'Password (optional)'}</span>
						{error && <span className="cloud-storage-dialog-error">{error}</span>}
					</div>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder={isOverwritingProtected ? 'Current password' : 'Leave empty for no password'}
					/>
				</label>
				<p className="cloud-storage-dialog-warning">
					{isOverwritingProtected ? (
						<>&quot;{name.trim() || '…'}&quot; is password-protected.<br />Enter the current password to overwrite.</>
					) : (
						<>The password cannot be changed later.<br />Save a copy if you might need it.</>
					)}
				</p>
				<div className="cloud-storage-dialog-actions">
					<button type="button" onClick={onClose} className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary">
						Cancel
					</button>
					<button type="submit" disabled={loading} className="cloud-storage-dialog-btn cloud-storage-dialog-btn--primary">
						{loading ? (isOverwritingProtected ? 'Overwriting…' : 'Saving…') : (isOverwritingProtected ? 'Overwrite' : 'Save')}
					</button>
				</div>
			</form>
			{overwriteConfirm && (
				<SaveOverwriteConfirmOverlay
					overwriteConfirm={overwriteConfirm}
					onCancel={() => dispatchSave({ type: 'CANCEL' })}
					onOverwrite={handleOverwriteConfirm}
				/>
			)}
		</>
	)
}

/** LoadForm: list + load + copy + delete flows in one reducer. */
type LoadFormList = { items: ListWhiteboardItem[]; loading: boolean; error: string }
type LoadFormLoad =
	| { phase: 'idle' }
	| { phase: 'loading'; id: string }
	| { phase: 'password'; id: string; password: string; error: string }
	| { phase: 'loading_password'; id: string; password: string }
type LoadFormCopy =
	| null
	| { phase: 'prompt'; id: string; name: string; password: string; error: string }
	| { phase: 'verifying'; id: string; name: string; password: string }
type LoadFormDelete =
	| null
	| { step: 'password'; item: ListWhiteboardItem; password: string; error: string }
	| { step: 'confirm'; item: ListWhiteboardItem; password?: string; error?: string }
	| { step: 'deleting'; item: ListWhiteboardItem; password?: string }

type LoadFormState = { list: LoadFormList; load: LoadFormLoad; copy: LoadFormCopy; delete: LoadFormDelete }

type LoadFormAction =
	| { type: 'LIST_START' }
	| { type: 'LIST_OK'; items: ListWhiteboardItem[] }
	| { type: 'LIST_ERROR'; error: string }
	| { type: 'LOAD_START'; id: string }
	| { type: 'LOAD_PASSWORD_PROMPT'; id: string }
	| { type: 'LOAD_PASSWORD_SET'; password: string }
	| { type: 'LOAD_VERIFY_START' }
	| { type: 'LOAD_ERROR'; error: string }
	| { type: 'LOAD_CANCEL' }
	| { type: 'COPY_PROMPT'; id: string; name: string }
	| { type: 'COPY_PASSWORD_SET'; password: string }
	| { type: 'COPY_VERIFY_START' }
	| { type: 'COPY_OK' }
	| { type: 'COPY_ERROR'; error: string }
	| { type: 'COPY_CANCEL' }
	| { type: 'DELETE_PASSWORD_PROMPT'; item: ListWhiteboardItem }
	| { type: 'DELETE_CONFIRM_PROMPT'; item: ListWhiteboardItem }
	| { type: 'DELETE_PASSWORD_SET'; password: string }
	| { type: 'DELETE_VERIFY_OK'; password: string }
	| { type: 'DELETE_VERIFY_ERROR'; error: string }
	| { type: 'DELETE_START' }
	| { type: 'DELETE_DONE' }
	| { type: 'DELETE_FAILED'; error: string }
	| { type: 'DELETE_CANCEL' }

const initialLoadFormList: LoadFormList = { items: [], loading: true, error: '' }
const initialLoadFormLoad: LoadFormLoad = { phase: 'idle' }

function loadFormReducer(state: LoadFormState, action: LoadFormAction): LoadFormState {
	switch (action.type) {
		case 'LIST_START':
			return { ...state, list: { ...state.list, loading: true, error: '' } }
		case 'LIST_OK':
			return { ...state, list: { items: action.items, loading: false, error: '' } }
		case 'LIST_ERROR':
			return { ...state, list: { ...state.list, loading: false, error: action.error } }
		case 'LOAD_START':
			return { ...state, load: { phase: 'loading', id: action.id }, list: { ...state.list, error: '' } }
		case 'LOAD_PASSWORD_PROMPT':
			return { ...state, load: { phase: 'password', id: action.id, password: '', error: '' } }
		case 'LOAD_PASSWORD_SET':
			return state.load.phase === 'password'
				? { ...state, load: { ...state.load, password: action.password } }
				: state
		case 'LOAD_VERIFY_START':
			return state.load.phase === 'password'
				? { ...state, load: { phase: 'loading_password', id: state.load.id, password: state.load.password } }
				: state
		case 'LOAD_ERROR':
			if (state.load.phase === 'password') {
				return { ...state, load: { ...state.load, error: action.error } }
			}
			if (state.load.phase === 'loading_password') {
				return { ...state, load: { phase: 'password', id: state.load.id, password: state.load.password, error: action.error } }
			}
			if (state.load.phase === 'loading') {
				return { ...state, load: initialLoadFormLoad, list: { ...state.list, error: action.error } }
			}
			return state
		case 'LOAD_CANCEL':
			return { ...state, load: initialLoadFormLoad }
		case 'COPY_PROMPT':
			return { ...state, copy: { phase: 'prompt', id: action.id, name: action.name, password: '', error: '' } }
		case 'COPY_PASSWORD_SET':
			return state.copy !== null && state.copy.phase === 'prompt'
				? { ...state, copy: { ...state.copy, password: action.password } }
				: state
		case 'COPY_VERIFY_START':
			return state.copy !== null && state.copy.phase === 'prompt'
				? { ...state, copy: { phase: 'verifying', id: state.copy.id, name: state.copy.name, password: state.copy.password } }
				: state
		case 'COPY_OK':
		case 'COPY_CANCEL':
			return { ...state, copy: null }
		case 'COPY_ERROR':
			return state.copy !== null && state.copy.phase === 'prompt'
				? { ...state, copy: { ...state.copy, error: action.error } }
				: state.copy !== null && state.copy.phase === 'verifying'
					? { ...state, copy: { phase: 'prompt', id: state.copy.id, name: state.copy.name, password: state.copy.password, error: action.error } }
					: state
		case 'DELETE_PASSWORD_PROMPT':
			return { ...state, delete: { step: 'password', item: action.item, password: '', error: '' } }
		case 'DELETE_CONFIRM_PROMPT':
			return { ...state, delete: { step: 'confirm', item: action.item } }
		case 'DELETE_PASSWORD_SET':
			return state.delete !== null && state.delete.step === 'password'
				? { ...state, delete: { ...state.delete, password: action.password } }
				: state
		case 'DELETE_VERIFY_OK':
			return state.delete !== null && state.delete.step === 'password'
				? { ...state, delete: { step: 'confirm', item: state.delete.item, password: action.password } }
				: state
		case 'DELETE_VERIFY_ERROR':
			return state.delete !== null && state.delete.step === 'password'
				? { ...state, delete: { ...state.delete, error: action.error } }
				: state
		case 'DELETE_START':
			return state.delete !== null && state.delete.step === 'confirm'
				? { ...state, delete: { step: 'deleting', item: state.delete.item, password: state.delete.password } }
				: state
		case 'DELETE_DONE':
		case 'DELETE_CANCEL':
			return { ...state, delete: null }
		case 'DELETE_FAILED':
			return state.delete !== null && state.delete.step === 'deleting'
				? { ...state, delete: { step: 'confirm', item: state.delete.item, password: state.delete.password, error: action.error } }
				: state
		default:
			return state
	}
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

function useLoadFormHandlers(
	dispatchLoad: Dispatch<LoadFormAction>,
	fetchList: () => Promise<void>,
	onLoaded: (data: unknown) => void,
	setOpenMenuId: (id: string | null) => void,
	state: LoadFormState,
) {
	const { load, copy, delete: deletePhase } = state
	const password = load.phase === 'password' ? load.password : load.phase === 'loading_password' ? load.password : ''
	const handleLoad = useCallback(
		(item: ListWhiteboardItem) => {
			if (item.hasPassword) {
				dispatchLoad({ type: 'LOAD_PASSWORD_PROMPT', id: item.id })
				return
			}
			void (async () => {
				dispatchLoad({ type: 'LOAD_START', id: item.id })
				const result = await loadWhiteboard(item.id)
				if (result.ok) {
					dispatchLoad({ type: 'LOAD_CANCEL' })
					onLoaded(result.data)
				} else {
					dispatchLoad({ type: 'LOAD_ERROR', error: result.error })
				}
			})()
		},
		[dispatchLoad, onLoaded],
	)
	const handlePasswordSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			if (load.phase !== 'password') return
			void (async () => {
				dispatchLoad({ type: 'LOAD_VERIFY_START' })
				const result = await loadWhiteboard(load.id, password)
				if (result.ok) {
					dispatchLoad({ type: 'LOAD_CANCEL' })
					onLoaded(result.data)
				} else {
					dispatchLoad({ type: 'LOAD_ERROR', error: result.error })
				}
			})()
		},
		[load, password, dispatchLoad, onLoaded],
	)
	const handleCopyJson = useCallback(
		async (item: ListWhiteboardItem) => {
			setOpenMenuId(null)
			if (item.hasPassword) {
				dispatchLoad({ type: 'COPY_PROMPT', id: item.id, name: item.name })
				return
			}
			const result = await loadWhiteboard(item.id)
			if (result.ok) await navigator.clipboard.writeText(JSON.stringify(result.data))
		},
		[dispatchLoad, setOpenMenuId],
	)
	const handleCopyPasswordSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			if (copy === null || copy.phase !== 'prompt') return
			void (async () => {
				dispatchLoad({ type: 'COPY_VERIFY_START' })
				const result = await loadWhiteboard(copy.id, copy.password)
				if (result.ok) {
					await navigator.clipboard.writeText(JSON.stringify(result.data))
					dispatchLoad({ type: 'COPY_OK' })
				} else {
					dispatchLoad({ type: 'COPY_ERROR', error: result.error })
				}
			})()
		},
		[copy, dispatchLoad],
	)
	const handleDeleteClick = useCallback((item: ListWhiteboardItem) => {
		setOpenMenuId(null)
		if (item.hasPassword) dispatchLoad({ type: 'DELETE_PASSWORD_PROMPT', item })
		else dispatchLoad({ type: 'DELETE_CONFIRM_PROMPT', item })
	}, [dispatchLoad, setOpenMenuId])
	const handleDeletePasswordSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			if (deletePhase === null || deletePhase.step !== 'password') return
			void (async () => {
				const result = await loadWhiteboard(deletePhase.item.id, deletePhase.password)
				if (result.ok) {
					dispatchLoad({ type: 'DELETE_VERIFY_OK', password: deletePhase.password })
				} else {
					dispatchLoad({ type: 'DELETE_VERIFY_ERROR', error: result.error })
				}
			})()
		},
		[deletePhase, dispatchLoad],
	)
	const handleDeleteConfirm = useCallback(() => {
		if (deletePhase === null || deletePhase.step !== 'confirm') return
		void (async () => {
			dispatchLoad({ type: 'DELETE_START' })
			const result = await deleteWhiteboard(deletePhase.item.id, deletePhase.password)
			if (result.ok) {
				dispatchLoad({ type: 'DELETE_DONE' })
				void fetchList()
			} else {
				dispatchLoad({ type: 'DELETE_FAILED', error: result.error })
			}
		})()
	}, [deletePhase, dispatchLoad, fetchList])
	return {
		handleLoad,
		handlePasswordSubmit,
		handleCopyJson,
		handleCopyPasswordSubmit,
		handleDeleteClick,
		handleDeletePasswordSubmit,
		handleDeleteConfirm,
	}
}

function LoadPasswordFormView({
	password,
	loadError,
	loading,
	onPasswordChange,
	onSubmit,
	onCancel,
}: {
	password: string
	loadError: string
	loading: boolean
	onPasswordChange: (v: string) => void
	onSubmit: (e: React.FormEvent) => void
	onCancel: () => void
}) {
	return (
		<form onSubmit={onSubmit} className="cloud-storage-dialog-form">
			<label>
				<div className="cloud-storage-dialog-label-row">
					<span>Password</span>
					{loadError && <span className="cloud-storage-dialog-error">{loadError}</span>}
				</div>
				<input
					type="password"
					value={password}
					onChange={(e) => onPasswordChange(e.target.value)}
					required
					autoFocus
					disabled={loading}
				/>
			</label>
			<p className="cloud-storage-dialog-hint">Enter password for the selected whiteboard.</p>
			<div className="cloud-storage-dialog-actions">
				<button type="button" onClick={onCancel} className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary">
					Back
				</button>
				<button type="submit" disabled={loading} className="cloud-storage-dialog-btn cloud-storage-dialog-btn--primary">
					{loading ? 'Loading…' : 'Load'}
				</button>
			</div>
		</form>
	)
}

function CopyPasswordOverlay({
	visible,
	name,
	password,
	error,
	verifying,
	onPasswordChange,
	onSubmit,
	onCancel,
}: {
	visible: boolean
	name: string
	password: string
	error: string
	verifying: boolean
	onPasswordChange: (v: string) => void
	onSubmit: (e: React.FormEvent) => void
	onCancel: () => void
}) {
	if (!visible) return null
	return (
		<div
			className="cloud-storage-dialog-overlay cloud-storage-dialog-overlay-confirm"
			role="dialog"
			aria-labelledby="copy-password-title"
			onMouseDown={(e) => e.target === e.currentTarget && !verifying && onCancel()}
		>
			<div className="cloud-storage-dialog-panel cloud-storage-dialog-confirm-panel" onMouseDown={(e) => e.stopPropagation()}>
				<h2 id="copy-password-title" className="cloud-storage-dialog-confirm-title">Copy JSON</h2>
				<p className="cloud-storage-dialog-confirm-desc">Enter password for &quot;{name}&quot;.</p>
				<form onSubmit={onSubmit} className="cloud-storage-dialog-form">
					<label>
						<div className="cloud-storage-dialog-label-row">
							<span>Password</span>
							{error && <span className="cloud-storage-dialog-error">{error}</span>}
						</div>
						<input
							type="password"
							value={password}
							onChange={(e) => onPasswordChange(e.target.value)}
							required
							autoFocus
							disabled={verifying}
						/>
					</label>
					<div className="cloud-storage-dialog-actions">
						<button type="button" onClick={onCancel} disabled={verifying} className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary">Cancel</button>
						<button type="submit" disabled={verifying} className="cloud-storage-dialog-btn cloud-storage-dialog-btn--primary">{verifying ? 'Verifying…' : 'Copy'}</button>
					</div>
				</form>
			</div>
		</div>
	)
}

function DeletePasswordOverlay({
	visible,
	itemName,
	password,
	error,
	onPasswordChange,
	onSubmit,
	onCancel,
}: {
	visible: boolean
	itemName: string
	password: string
	error: string
	onPasswordChange: (v: string) => void
	onSubmit: (e: React.FormEvent) => void
	onCancel: () => void
}) {
	if (!visible) return null
	return (
		<div
			className="cloud-storage-dialog-overlay cloud-storage-dialog-overlay-confirm"
			role="dialog"
			aria-labelledby="delete-password-title"
			onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
		>
			<div className="cloud-storage-dialog-panel cloud-storage-dialog-confirm-panel" onMouseDown={(e) => e.stopPropagation()}>
				<h2 id="delete-password-title" className="cloud-storage-dialog-confirm-title">Delete whiteboard</h2>
				<p className="cloud-storage-dialog-confirm-desc">&quot;{itemName}&quot; is password-protected.<br />Enter its password to continue.</p>
				<form onSubmit={onSubmit} className="cloud-storage-dialog-form">
					<label>
						<div className="cloud-storage-dialog-label-row">
							<span>Password</span>
							{error && <span className="cloud-storage-dialog-error">{error}</span>}
						</div>
						<input type="password" value={password} onChange={(e) => onPasswordChange(e.target.value)} required autoFocus />
					</label>
					<div className="cloud-storage-dialog-actions">
						<button type="button" onClick={onCancel} className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary">Cancel</button>
						<button type="submit" className="cloud-storage-dialog-btn cloud-storage-dialog-btn--primary">Continue</button>
					</div>
				</form>
			</div>
		</div>
	)
}

function DeleteConfirmOverlay({
	visible,
	itemName,
	error,
	deleting,
	onCancel,
	onConfirm,
}: {
	visible: boolean
	itemName: string
	error: string
	deleting: boolean
	onCancel: () => void
	onConfirm: () => void
}) {
	if (!visible) return null
	return (
		<div
			className="cloud-storage-dialog-overlay cloud-storage-dialog-overlay-confirm"
			role="alertdialog"
			aria-labelledby="delete-confirm-title"
			aria-describedby="delete-confirm-desc"
			onMouseDown={(e) => e.target === e.currentTarget && !deleting && onCancel()}
		>
			<div className="cloud-storage-dialog-panel cloud-storage-dialog-confirm-panel" onMouseDown={(e) => e.stopPropagation()}>
				<h2 id="delete-confirm-title" className="cloud-storage-dialog-confirm-title">Delete whiteboard?</h2>
				<p id="delete-confirm-desc" className="cloud-storage-dialog-confirm-desc">&quot;{itemName}&quot; will be permanently deleted.<br />This cannot be undone.</p>
				{error && <p className="cloud-storage-dialog-error" role="alert">{error}</p>}
				<div className="cloud-storage-dialog-actions">
					<button type="button" onClick={onCancel} className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary">Cancel</button>
					<button type="button" onClick={onConfirm} disabled={deleting} className="cloud-storage-dialog-btn cloud-storage-dialog-btn--danger">
						{deleting ? 'Deleting…' : 'Delete'}
					</button>
				</div>
			</div>
		</div>
	)
}

function LoadListWithMenu({
	items,
	loadingId,
	openMenuId,
	setOpenMenuId,
	menuRef,
	dropdownContainerRef,
	dropdownPosition,
	theme,
	dropdownMinWidth,
	onLoad,
	onCopyJson,
	onDeleteClick,
}: {
	items: ListWhiteboardItem[]
	loadingId: string | null
	openMenuId: string | null
	setOpenMenuId: (id: string | null) => void
	menuRef: RefObject<HTMLDivElement | null>
	dropdownContainerRef: RefObject<HTMLDivElement | null>
	dropdownPosition: { bottom: number; right: number } | null
	theme: ExcalidrawTheme
	dropdownMinWidth: number
	onLoad: (item: ListWhiteboardItem) => void
	onCopyJson: (item: ListWhiteboardItem) => void
	onDeleteClick: (item: ListWhiteboardItem) => void
}) {
	const themeClassName = theme === THEME.DARK ? 'excalidraw theme--dark' : 'excalidraw theme--light'
	return (
		<ul className="cloud-storage-dialog-list">
			{items.map((item) => (
				<li key={item.id} className="cloud-storage-dialog-list-item">
					<span className="cloud-storage-dialog-item-name">{item.name}</span>
					<span className="cloud-storage-dialog-item-meta">
						{item.hasPassword ? '🔒' : ''} {new Date(item.updated_at).toLocaleDateString()}
					</span>
					<div ref={openMenuId === item.id ? menuRef : undefined} className="cloud-storage-dialog-item-menu-wrap">
						<button
							type="button"
							onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
							className="cloud-storage-dialog-item-menu-btn"
							aria-label="Options"
							aria-expanded={openMenuId === item.id}
						>
							<MoreIcon />
						</button>
						{openMenuId === item.id && dropdownPosition &&
							createPortal(
								<div ref={dropdownContainerRef} className={themeClassName}>
									<div
										className="cloud-storage-dialog-item-dropdown cloud-storage-dialog-item-dropdown--fixed"
										role="menu"
										style={{
											top: dropdownPosition.bottom + 2,
											right: window.innerWidth - dropdownPosition.right,
											minWidth: dropdownMinWidth,
										}}
									>
										<button type="button" role="menuitem" onClick={() => void onCopyJson(item)} className="cloud-storage-dialog-dropdown-item">Copy JSON</button>
										<button type="button" role="menuitem" onClick={() => onDeleteClick(item)} className="cloud-storage-dialog-dropdown-item cloud-storage-dialog-dropdown-item--danger">Delete</button>
									</div>
								</div>,
								document.body,
							)}
					</div>
					<button type="button" onClick={() => onLoad(item)} disabled={loadingId !== null} className="cloud-storage-dialog-load-btn">
						{loadingId === item.id ? 'Loading…' : 'Load'}
					</button>
				</li>
			))}
		</ul>
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
	const [loadState, dispatchLoad] = useReducer(loadFormReducer, {
		list: initialLoadFormList,
		load: initialLoadFormLoad,
		copy: null,
		delete: null,
	})
	const [openMenuId, setOpenMenuId] = useState<string | null>(null)
	const [dropdownPosition, setDropdownPosition] = useState<{ bottom: number; right: number } | null>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const dropdownContainerRef = useRef<HTMLDivElement>(null)
	const dropdownMinWidth = 140

	const fetchList = useCallback(async () => {
		dispatchLoad({ type: 'LIST_START' })
		const result = await listWhiteboards()
		if (result.ok) dispatchLoad({ type: 'LIST_OK', items: result.items })
		else dispatchLoad({ type: 'LIST_ERROR', error: result.error })
	}, [])

	useEffect(() => void fetchList(), [fetchList])
	useEffect(() => {
		if (!openMenuId || !menuRef.current) {
			setDropdownPosition(null)
			return
		}
		setDropdownPosition({ bottom: menuRef.current.getBoundingClientRect().bottom, right: menuRef.current.getBoundingClientRect().right })
	}, [openMenuId])
	useEffect(() => {
		if (!openMenuId) return
		const fn = (e: MouseEvent) => {
			const target = e.target as Node
			if (!menuRef.current?.contains(target) && !dropdownContainerRef.current?.contains(target)) setOpenMenuId(null)
		}
		document.addEventListener('mousedown', fn)
		return () => document.removeEventListener('mousedown', fn)
	}, [openMenuId])

	const handlers = useLoadFormHandlers(dispatchLoad, fetchList, onLoaded, setOpenMenuId, loadState)
	const { list, load, copy, delete: deletePhase } = loadState
	const loading = list.loading
	const error = list.error
	const items = list.items
	const loadingId = load.phase === 'loading' || load.phase === 'loading_password' ? load.id : null
	const passwordFor = load.phase === 'password' || load.phase === 'loading_password' ? load.id : null
	const password = load.phase === 'password' ? load.password : load.phase === 'loading_password' ? load.password : ''
	const deleteConfirmVisible = deletePhase?.step === 'confirm' || deletePhase?.step === 'deleting'
	const deleteConfirmError =
		deletePhase?.step === 'confirm' && deletePhase.error !== undefined ? deletePhase.error : ''
	const deleteConfirmDeleting = deletePhase?.step === 'deleting'

	if (passwordFor) {
		return (
			<LoadPasswordFormView
				password={password}
				loadError={load.phase === 'password' ? load.error : ''}
				loading={load.phase === 'loading_password'}
				onPasswordChange={(v) => dispatchLoad({ type: 'LOAD_PASSWORD_SET', password: v })}
				onSubmit={handlers.handlePasswordSubmit}
				onCancel={() => dispatchLoad({ type: 'LOAD_CANCEL' })}
			/>
		)
	}

	return (
		<div className="cloud-storage-dialog-form">
			<button type="button" onClick={() => void fetchList()} className="cloud-storage-dialog-refresh">
				Refresh
			</button>
			{loading ? (
				<div className="cloud-storage-dialog-loading">Loading…</div>
			) : error ? (
				<div className="cloud-storage-dialog-error">{error}</div>
			) : items.length === 0 ? (
				<div className="cloud-storage-dialog-hint">No saved whiteboards yet.</div>
			) : (
				<LoadListWithMenu
					items={items}
					loadingId={loadingId}
					openMenuId={openMenuId}
					setOpenMenuId={setOpenMenuId}
					menuRef={menuRef}
					dropdownContainerRef={dropdownContainerRef}
					dropdownPosition={dropdownPosition}
					theme={theme}
					dropdownMinWidth={dropdownMinWidth}
					onLoad={handlers.handleLoad}
					onCopyJson={(item) => void handlers.handleCopyJson(item)}
					onDeleteClick={handlers.handleDeleteClick}
				/>
			)}
			<CopyPasswordOverlay
				visible={copy !== null}
				name={copy?.phase === 'prompt' || copy?.phase === 'verifying' ? copy.name : ''}
				password={copy?.phase === 'prompt' ? copy.password : ''}
				error={copy?.phase === 'prompt' ? copy.error : ''}
				verifying={copy?.phase === 'verifying'}
				onPasswordChange={(v) => dispatchLoad({ type: 'COPY_PASSWORD_SET', password: v })}
				onSubmit={handlers.handleCopyPasswordSubmit}
				onCancel={() => dispatchLoad({ type: 'COPY_CANCEL' })}
			/>
			<DeletePasswordOverlay
				visible={deletePhase?.step === 'password'}
				itemName={deletePhase?.step === 'password' ? deletePhase.item.name : ''}
				password={deletePhase?.step === 'password' ? deletePhase.password : ''}
				error={deletePhase?.step === 'password' ? deletePhase.error : ''}
				onPasswordChange={(v) => dispatchLoad({ type: 'DELETE_PASSWORD_SET', password: v })}
				onSubmit={handlers.handleDeletePasswordSubmit}
				onCancel={() => dispatchLoad({ type: 'DELETE_CANCEL' })}
			/>
			<DeleteConfirmOverlay
				visible={deleteConfirmVisible}
				itemName={deletePhase?.step === 'confirm' || deletePhase?.step === 'deleting' ? deletePhase.item.name : ''}
				error={deleteConfirmError}
				deleting={deleteConfirmDeleting}
				onCancel={() => dispatchLoad({ type: 'DELETE_CANCEL' })}
				onConfirm={handlers.handleDeleteConfirm}
			/>
			<div className="cloud-storage-dialog-actions">
				<button type="button" onClick={onClose} className="cloud-storage-dialog-btn cloud-storage-dialog-btn--secondary">
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
	const panelRef = useRef<HTMLDivElement>(null)
	const handleOverlayPointerDown = useCallback(
		(e: React.MouseEvent) => {
			if (!panelRef.current?.contains(e.target as Node)) onClose()
		},
		[onClose],
	)

	if (mode === 'closed') return null

	const title = mode === 'save' ? 'Save to cloud' : 'Load from cloud'

	if (!configured) {
		return (
			<div
				className="cloud-storage-dialog-overlay"
				onMouseDown={handleOverlayPointerDown}
				role="presentation"
			>
				<div className={themeClass(theme)}>
					<div
						ref={panelRef}
						className="cloud-storage-dialog-panel"
						onMouseDown={(e) => e.stopPropagation()}
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
			onMouseDown={handleOverlayPointerDown}
			role="presentation"
		>
			<div className={themeClass(theme)}>
				<div
					ref={panelRef}
					className="cloud-storage-dialog-panel"
					onMouseDown={(e) => e.stopPropagation()}
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
							theme={theme}
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
