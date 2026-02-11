/**
 * Paste JSON: when clipboard contains our whiteboard snapshot format,
 * add its shapes/assets to the current page (merge, don't replace).
 */

import type { Editor, TLContent } from '@tldraw/editor'
import type { TLAsset, TLBinding, TLShape } from '@tldraw/tlschema'

import type { SerializedSchema } from '@tldraw/store'
import type { TLUiOverrides } from 'tldraw'

interface DocSnapshot {
	store: Record<string, { typeName: string; id: string; parentId?: string }>
	schema: SerializedSchema
}

function isWhiteboardSnapshot(parsed: unknown): parsed is { document: DocSnapshot } {
	const p = parsed as { document?: DocSnapshot }
	if (!p?.document?.store || typeof p.document.store !== 'object') return false
	if (!p.document.schema) return false
	return true
}

function documentToContent(doc: DocSnapshot): TLContent | null {
	const records = Object.values(doc.store)
	const shapes = records.filter((r): r is TLShape => r.typeName === 'shape')
	const bindings = records.filter((r): r is TLBinding => r.typeName === 'binding')
	const assets = records.filter((r): r is TLAsset => r.typeName === 'asset')
	const pageIds = new Set(
		records.filter((r) => r.typeName === 'page').map((p) => p.id)
	)
	const rootShapeIds = shapes
		.filter((s) => s.parentId && pageIds.has(s.parentId))
		.map((s) => s.id)

	if (rootShapeIds.length === 0 && shapes.length === 0) return null

	return {
		schema: doc.schema,
		shapes,
		bindings: bindings.length > 0 ? bindings : undefined,
		rootShapeIds,
		assets,
	}
}

/** Import JSON from text; merges content onto current page. Returns true if successful. */
export function importJsonFromText(editor: Editor, text: string): boolean {
	try {
		const parsed = JSON.parse(text) as unknown
		if (!isWhiteboardSnapshot(parsed)) return false
		const content = documentToContent(parsed.document)
		if (!content) return false
		editor.run(() => {
			editor.markHistoryStoppingPoint('paste')
			editor.putContentOntoCurrentPage(content, { select: true })
		})
		return true
	} catch {
		return false
	}
}

export function setupPasteJson(editor: Editor): () => void {
	const onPaste = (e: ClipboardEvent) => {
		if (editor.getEditingShapeId() !== null) return
		const text = e.clipboardData?.getData('text/plain')
		if (!text || typeof text !== 'string') return
		if (importJsonFromText(editor, text)) {
			e.preventDefault()
			e.stopPropagation()
		}
	}
	document.addEventListener('paste', onPaste, { capture: true })
	return () => document.removeEventListener('paste', onPaste, { capture: true })
}

/** Try to paste from clipboard; returns true if our JSON was pasted. For use by paste action override. */
export async function tryPasteJsonFromClipboard(editor: Editor): Promise<boolean> {
	if (!navigator.clipboard?.readText) return false
	const text = await navigator.clipboard.readText()
	return importJsonFromText(editor, text)
}

/** Override paste action to try our JSON first, then fall back to default paste. */
export function createPasteActionOverride(): TLUiOverrides {
	return {
		actions: (editor, actions, helpers) => {
			const pasteAction = actions['paste']
			if (!pasteAction?.onSelect) return actions
			const newPasteAction = {
				...pasteAction,
				onSelect: (source: Parameters<typeof pasteAction.onSelect>[0]) => {
					void (async () => {
						try {
							const handled = await tryPasteJsonFromClipboard(editor)
							if (handled) return
							if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') return
							const clipboardItems = await navigator.clipboard.read()
							await helpers.paste(
								clipboardItems,
								source,
								source === 'context-menu' ? editor.inputs.currentPagePoint : undefined
							)
						} catch {
							helpers.addToast({
								title: helpers.msg('action.paste-error-title'),
								description: helpers.msg('action.paste-error-description'),
								severity: 'error',
							})
						}
					})()
				},
			}
			return { ...actions, paste: newPasteAction }
		},
	}
}
