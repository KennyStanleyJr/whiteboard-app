/**
 * Export/Import JSON menu items and helpers for main menu and context menu.
 */

import type { TLContent } from '@tldraw/editor'
import { getSnapshot } from 'tldraw'
import { importJsonFromText } from './pasteJson'
import type { TLStore } from 'tldraw'
import { useCallback } from 'react'
import {
	ArrangeMenuSubmenu,
	ClipboardMenuGroup,
	CursorChatItem,
	DefaultContextMenu,
	DefaultMainMenu,
	EditMenuSubmenu,
	ExtrasGroup,
	MiscMenuGroup,
	MoveToPageMenu,
	PreferencesGroup,
	ReorderMenuSubmenu,
	SelectAllMenuItem,
	TldrawUiMenuActionItem,
	UndoRedoGroup,
	TldrawUiMenuGroup,
	TldrawUiMenuItem,
	TldrawUiMenuSubmenu,
	ToggleLockMenuItem,
	ToggleTransparentBgMenuItem,
	UnlockAllMenuItem,
	useEditor,
	useShowCollaborationUi,
	useToasts,
	useValue,
	ViewSubmenu,
	type TLUiContextMenuProps,
	type TLUiEventSource,
	type TLUiMainMenuProps,
} from 'tldraw'

const EXPORT_FILENAME = 'whiteboard-export.json'

function getStoreJsonString(store: TLStore): string {
	const documentSnapshot = store.getStoreSnapshot('all')
	const snap = getSnapshot(store)
	const session = snap?.session ?? {}
	const payload = { document: documentSnapshot, session }
	return JSON.stringify(payload)
}

function exportStoreAsJson(store: TLStore): void {
	const json = getStoreJsonString(store)
	const blob = new Blob([json], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = EXPORT_FILENAME
	HTMLAnchorElement.prototype.click.call(a)
	URL.revokeObjectURL(url)
}

/** Convert TLContent (selected shapes) to pasteable document format. */
function contentToDocSnapshot(
	content: TLContent,
	pageId: string,
	pageRecord: { typeName: string; id: string; name: string; index: string; meta: unknown } | null
): { document: { store: Record<string, unknown>; schema: unknown } } {
	const store: Record<string, unknown> = {}
	for (const s of content.shapes) store[s.id] = s
	for (const b of content.bindings ?? []) store[b.id] = b
	for (const a of content.assets) store[a.id] = a
	if (pageRecord) store[pageId] = pageRecord
	else store[pageId] = { typeName: 'page', id: pageId, name: 'Page', index: 'a0', meta: {} }
	return { document: { store, schema: content.schema } }
}

function ExportJsonMenuItem() {
	const editor = useEditor()
	const onSelect = useCallback(
		(_source: TLUiEventSource) => {
			exportStoreAsJson(editor.store)
		},
		[editor]
	)
	return (
		<TldrawUiMenuItem
			id="export-json"
			label="JSON"
			icon="external-link"
			onSelect={onSelect}
		/>
	)
}

/** Copy JSON for selected shapes (Edit/context Copy as). */
function CopyJsonMenuItem() {
	const editor = useEditor()
	const toasts = useToasts()
	const onSelect = useCallback(
		async (_source: TLUiEventSource) => {
			try {
				const ids = editor.getSelectedShapeIds()
				const shapeIds = ids.length > 0 ? ids : Array.from(editor.getCurrentPageShapeIds())
				const content = editor.getContentFromCurrentPage(shapeIds)
				if (!content) return
				const resolved = await editor.resolveAssetsInContent(content)
				if (!resolved) return
				const pageId = editor.getCurrentPageId()
				const page = editor.store.get(pageId) as { typeName: string; id: string; name: string; index: string; meta: unknown } | undefined
				const doc = contentToDocSnapshot(resolved, pageId, page ?? null)
				const json = JSON.stringify(doc)
				if (!navigator.clipboard?.writeText) return
				await navigator.clipboard.writeText(json)
			} catch {
				toasts.addToast({
					title: 'Copy failed',
					description: 'Could not copy to clipboard.',
					severity: 'error',
				})
			}
		},
		[editor, toasts]
	)
	return (
		<TldrawUiMenuItem
			id="copy-json"
			label="JSON"
			icon="external-link"
			onSelect={onSelect}
		/>
	)
}

/** Export JSON for selected shapes (Edit/context Export as). */
function ExportJsonSelectionMenuItem() {
	const editor = useEditor()
	const toasts = useToasts()
	const onSelect = useCallback(
		async (_source: TLUiEventSource) => {
			try {
				const ids = editor.getSelectedShapeIds()
				const shapeIds = ids.length > 0 ? ids : Array.from(editor.getCurrentPageShapeIds())
				const content = editor.getContentFromCurrentPage(shapeIds)
				if (!content) return
				const resolved = await editor.resolveAssetsInContent(content)
				if (!resolved) return
				const pageId = editor.getCurrentPageId()
				const page = editor.store.get(pageId) as { typeName: string; id: string; name: string; index: string; meta: unknown } | undefined
				const doc = contentToDocSnapshot(resolved, pageId, page ?? null)
				const json = JSON.stringify(doc)
				const blob = new Blob([json], { type: 'application/json' })
				const url = URL.createObjectURL(blob)
				const a = document.createElement('a')
				a.href = url
				a.download = EXPORT_FILENAME
				HTMLAnchorElement.prototype.click.call(a)
				URL.revokeObjectURL(url)
			} catch {
				toasts.addToast({
					title: 'Export failed',
					description: 'Could not export selection.',
					severity: 'error',
				})
			}
		},
		[editor, toasts]
	)
	return (
		<TldrawUiMenuItem
			id="export-json-selection"
			label="JSON"
			icon="external-link"
			onSelect={onSelect}
		/>
	)
}

/** Copy as submenu with SVG, PNG, and JSON options. */
function CustomCopyAsMenuGroup() {
	const editor = useEditor()
	const atLeastOneShapeOnPage = useValue(
		'atLeastOneShapeOnPage',
		() => editor.getCurrentPageShapeIds().size > 0,
		[editor]
	)

	return (
		<TldrawUiMenuSubmenu
			id="copy-as"
			label="context-menu.copy-as"
			size="small"
			disabled={!atLeastOneShapeOnPage}
		>
			<TldrawUiMenuGroup id="copy-as-group">
				<TldrawUiMenuActionItem actionId="copy-as-svg" />
				{typeof window.navigator?.clipboard?.write === 'function' && (
					<TldrawUiMenuActionItem actionId="copy-as-png" />
				)}
				<CopyJsonMenuItem />
			</TldrawUiMenuGroup>
			<TldrawUiMenuGroup id="copy-as-bg">
				<ToggleTransparentBgMenuItem />
			</TldrawUiMenuGroup>
		</TldrawUiMenuSubmenu>
	)
}

/** Import JSON menu item - opens file picker, merges content onto current page. */
function ImportJsonMenuItem() {
	const editor = useEditor()
	const toasts = useToasts()
	const onSelect = useCallback(
		(_source: TLUiEventSource) => {
			const input = document.createElement('input')
			input.type = 'file'
			input.accept = '.json,application/json'
			input.onchange = async () => {
				const file = input.files?.[0]
				if (!file) return
				try {
					const text = await file.text()
					if (!importJsonFromText(editor, text)) {
						toasts.addToast({
							title: 'Import failed',
							description: 'File is not a valid whiteboard JSON file.',
							severity: 'error',
						})
					}
				} catch {
					toasts.addToast({
						title: 'Import failed',
						description: 'Could not read file.',
						severity: 'error',
					})
				}
			}
			HTMLInputElement.prototype.click.call(input)
		},
		[editor, toasts]
	)
	return (
		<TldrawUiMenuItem
			id="import-json"
			label="Import JSON"
			icon="download"
			onSelect={onSelect}
		/>
	)
}

/** Export submenu with SVG, PNG, and JSON options. */
function CustomExportFileContentSubMenu() {
	return (
		<TldrawUiMenuSubmenu id="export-all-as" label="context-menu.export-all-as" size="small">
			<TldrawUiMenuGroup id="export-all-as-group">
				<TldrawUiMenuActionItem actionId="export-all-as-svg" />
				<TldrawUiMenuActionItem actionId="export-all-as-png" />
				<ExportJsonMenuItem />
			</TldrawUiMenuGroup>
			<TldrawUiMenuGroup id="export-all-as-bg">
				<ToggleTransparentBgMenuItem />
			</TldrawUiMenuGroup>
		</TldrawUiMenuSubmenu>
	)
}

/** Edit submenu with JSON in Export as submenu. */
function CustomEditSubmenu() {
	return (
		<TldrawUiMenuSubmenu id="edit" label="menu.edit">
			<UndoRedoGroup />
			<ClipboardMenuGroup />
			<CustomConversionsMenuGroup />
			<MiscMenuGroup />
			<TldrawUiMenuGroup id="lock">
				<ToggleLockMenuItem />
				<UnlockAllMenuItem />
			</TldrawUiMenuGroup>
			<TldrawUiMenuGroup id="select-all">
				<SelectAllMenuItem />
			</TldrawUiMenuGroup>
		</TldrawUiMenuSubmenu>
	)
}

/** Main menu - same structure as default, with JSON in Edit->Export as and top-level Export as. */
export function CustomMainMenu(props: TLUiMainMenuProps) {
	return (
		<DefaultMainMenu {...props}>
			<TldrawUiMenuGroup id="basic">
				<CustomEditSubmenu />
				<ViewSubmenu />
				<CustomExportFileContentSubMenu />
				<ImportJsonMenuItem />
				<ExtrasGroup />
			</TldrawUiMenuGroup>
			<PreferencesGroup />
		</DefaultMainMenu>
	)
}

/** Conversions group with JSON in the existing Export as submenu. */
function CustomConversionsMenuGroup() {
	const editor = useEditor()
	const atLeastOneShapeOnPage = useValue(
		'atLeastOneShapeOnPage',
		() => editor.getCurrentPageShapeIds().size > 0,
		[editor]
	)

	if (!atLeastOneShapeOnPage) return null

	return (
		<TldrawUiMenuGroup id="conversions">
			<CustomCopyAsMenuGroup />
			<TldrawUiMenuSubmenu id="export-as" label="context-menu.export-as" size="small">
				<TldrawUiMenuGroup id="export-as-group">
					<TldrawUiMenuActionItem actionId="export-as-svg" />
					<TldrawUiMenuActionItem actionId="export-as-png" />
					<ExportJsonSelectionMenuItem />
				</TldrawUiMenuGroup>
				<TldrawUiMenuGroup id="export-as-bg">
					<ToggleTransparentBgMenuItem />
				</TldrawUiMenuGroup>
			</TldrawUiMenuSubmenu>
		</TldrawUiMenuGroup>
	)
}

/** Context menu - same as default, with JSON in existing Export as submenu. */
export function CustomContextMenu(props: TLUiContextMenuProps) {
	const editor = useEditor()
	const showCollaborationUi = useShowCollaborationUi()
	const selectToolActive = useValue(
		'isSelectToolActive',
		() => editor.getCurrentToolId() === 'select',
		[editor]
	)
	const isSinglePageMode = useValue('isSinglePageMode', () => editor.options.maxPages <= 1, [
		editor,
	])

	if (!selectToolActive) return <DefaultContextMenu {...props} />

	return (
		<DefaultContextMenu {...props}>
			{showCollaborationUi && <CursorChatItem />}
			<TldrawUiMenuGroup id="modify">
				<EditMenuSubmenu />
				<ArrangeMenuSubmenu />
				<ReorderMenuSubmenu />
				{!isSinglePageMode && <MoveToPageMenu />}
			</TldrawUiMenuGroup>
			<ClipboardMenuGroup />
			<CustomConversionsMenuGroup />
			<TldrawUiMenuGroup id="select-all">
				<SelectAllMenuItem />
			</TldrawUiMenuGroup>
		</DefaultContextMenu>
	)
}