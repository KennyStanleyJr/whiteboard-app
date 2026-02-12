/**
 * Pure document utilities for shared pages.
 * No state, no side effects — just data extraction, comparison, and remapping.
 */

import type { Editor } from '@tldraw/editor'
import type { TLPageId, TLShapeId } from '@tldraw/tlschema'

export interface ShareSnapshot {
	document: { store: Record<string, unknown>; schema: unknown }
	session?: unknown
}

// ── Hashing / comparison ───────────────────────────────────────────────────────

function stableHash(val: unknown): string {
	if (val === null || typeof val !== 'object') return JSON.stringify(val)
	if (Array.isArray(val)) return '[' + val.map(stableHash).join(',') + ']'
	const obj = val as Record<string, unknown>
	const keys = Object.keys(obj).sort()
	return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableHash(obj[k])).join(',') + '}'
}

export function docStoreHash(snapshot: ShareSnapshot): string {
	return stableHash(snapshot.document?.store ?? {})
}

export function docContentEqual(a: ShareSnapshot, b: ShareSnapshot): boolean {
	return docStoreHash(a) === docStoreHash(b)
}

// ── Document extraction ────────────────────────────────────────────────────────

const MAX_DESCENDANT_ITERATIONS = 10_000

/** Extract a page's document (page + all descendants) from a store snapshot. */
export function getPageDocumentFromStore(
	storeSnapshot: { store: Record<string, unknown>; schema?: unknown },
	pageId: string
): ShareSnapshot | null {
	const all = storeSnapshot.store ?? {}
	const pageRec = all[pageId] as { typeName?: string } | undefined
	if (!pageRec || pageRec.typeName !== 'page') return null
	const ids = new Set<string>([pageId])
	const maxIter = Math.min(Object.keys(all).length, MAX_DESCENDANT_ITERATIONS)
	for (let iter = 0; iter < maxIter; iter++) {
		let changed = false
		for (const [id, rec] of Object.entries(all)) {
			const r = rec as { parentId?: string }
			if (r?.parentId && ids.has(r.parentId) && !ids.has(id)) {
				ids.add(id)
				changed = true
			}
		}
		if (!changed) break
	}
	const filtered: Record<string, unknown> = {}
	for (const id of ids) {
		const rec = all[id]
		if (rec) filtered[id] = rec
	}
	return { document: { store: filtered, schema: storeSnapshot.schema } }
}

/** Get record ids for a page and its descendants. */
export function getPageRecordIds(
	storeSnapshot: { store: Record<string, unknown> },
	pageId: string
): string[] {
	const doc = getPageDocumentFromStore(storeSnapshot, pageId)
	return doc ? Object.keys(doc.document.store) : []
}

/** Get the first page id in a store snapshot. */
export function getFirstPageIdFromStore(
	storeSnapshot: { store: Record<string, unknown> }
): string | null {
	for (const [id, rec] of Object.entries(storeSnapshot.store ?? {})) {
		if ((rec as { typeName?: string })?.typeName === 'page') return id
	}
	return null
}

// ── ID remapping ───────────────────────────────────────────────────────────────

export function remapIdInValue(val: unknown, fromId: string, toId: string): unknown {
	if (val === fromId) return toId
	if (typeof val === 'string') return val
	if (val === null || typeof val !== 'object') return val
	if (Array.isArray(val)) return val.map((v) => remapIdInValue(v, fromId, toId))
	const obj = val as Record<string, unknown>
	const out: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(obj)) {
		out[k] = remapIdInValue(v, fromId, toId)
	}
	return out
}

/** Remap a document's page id from fromId to toId. Returns new ShareSnapshot. */
export function remapDocumentPageId(
	doc: ShareSnapshot,
	fromId: string,
	toId: string
): ShareSnapshot {
	const store = doc.document?.store ?? {}
	const out: Record<string, unknown> = {}
	for (const [id, rec] of Object.entries(store)) {
		const remapped = remapIdInValue(rec, fromId, toId) as Record<string, unknown>
		const newId = id === fromId ? toId : id
		out[newId] = { ...remapped, id: newId }
	}
	return { document: { store: out, schema: doc.document.schema } }
}

// ── Content export ─────────────────────────────────────────────────────────────

type PageRecord = { typeName: string; id: string; name: string; index: string; meta: unknown }

export async function getContentAsJsonDoc(
	editor: Editor,
	shapeIds: Iterable<TLShapeId>
): Promise<ShareSnapshot | null> {
	const ids = Array.from(shapeIds)
	const content = editor.getContentFromCurrentPage(ids)
	if (!content) return null
	const resolved = await editor.resolveAssetsInContent(content)
	if (!resolved) return null
	const pageId = editor.getCurrentPageId()
	const page = editor.store.get(pageId) as PageRecord | undefined
	const store: Record<string, unknown> = {}
	for (const s of resolved.shapes) store[s.id] = s
	for (const b of resolved.bindings ?? []) store[b.id] = b
	for (const a of resolved.assets ?? []) store[a.id] = a
	store[pageId] = page ?? { typeName: 'page', id: pageId, name: 'Page', index: 'a0', meta: {} }
	return { document: { store, schema: resolved.schema } }
}

export async function getContentAsJsonDocForPage(
	editor: Editor,
	pageId: TLPageId
): Promise<ShareSnapshot | null> {
	const prevPageId = editor.getCurrentPageId()
	if (prevPageId === pageId) {
		return getContentAsJsonDoc(editor, editor.getPageShapeIds(pageId))
	}
	editor.setCurrentPage(pageId)
	try {
		return await getContentAsJsonDoc(editor, editor.getPageShapeIds(pageId))
	} finally {
		editor.setCurrentPage(prevPageId)
	}
}

// ── Sync server URI ────────────────────────────────────────────────────────────

export function isSyncServerConfigured(): boolean {
	return Boolean(import.meta.env.VITE_SYNC_SERVER_URL)
}

export function buildSyncUri(shareId: string): string {
	const base = import.meta.env.VITE_SYNC_SERVER_URL ?? ''
	if (!base) return ''
	if (base.startsWith('ws://') || base.startsWith('wss://')) {
		return `${base.replace(/\/$/, '')}/connect/${encodeURIComponent(shareId)}`
	}
	const url = base.startsWith('http') ? base : `https://${base}`
	const ws = url.replace(/^http/, 'ws')
	return `${ws}/connect/${encodeURIComponent(shareId)}`
}
