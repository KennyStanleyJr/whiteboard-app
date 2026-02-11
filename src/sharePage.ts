/**
 * Share page: Supabase save/load, URL handling, page↔share mapping, content snapshot.
 */

import type { Editor } from '@tldraw/editor'
import { loadPersistedSnapshot, savePersistedSnapshot } from './persistStore'
import type { TLPageId } from '@tldraw/tlschema'
import type { TLShapeId } from '@tldraw/tlschema'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SHARE_TABLE = 'shared_pages'
const MAP_KEY = 'whiteboard-share-map'
const URL_CHANGED_EVENT = 'whiteboard-url-changed'

export interface ShareSnapshot {
	document: { store: Record<string, unknown>; schema: unknown }
	session?: unknown
}

/** Stable hash for doc comparison. Order-independent so JSON key order does not affect result. */
function stableHash(val: unknown): string {
	if (val === null || typeof val !== 'object') return JSON.stringify(val)
	if (Array.isArray(val)) return '[' + val.map(stableHash).join(',') + ']'
	const obj = val as Record<string, unknown>
	const keys = Object.keys(obj).sort()
	return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableHash(obj[k])).join(',') + '}'
}

/** Hash of a ShareSnapshot's document store for echo detection. */
export function docStoreHash(snapshot: ShareSnapshot): string {
	const store = snapshot.document?.store ?? {}
	return stableHash(store)
}

/** Compare store content of two ShareSnapshots. Used to skip applying sync when content is unchanged. */
export function docContentEqual(a: ShareSnapshot, b: ShareSnapshot): boolean {
	return docStoreHash(a) === docStoreHash(b)
}

let supabaseClient: SupabaseClient | null | undefined = undefined
const pageToShareId = new Map<string, string>()

function getSupabaseClient(): SupabaseClient | null {
	if (supabaseClient !== undefined) return supabaseClient
	const url = import.meta.env.VITE_SUPABASE_URL ?? ''
	const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
	if (url === '' || key === '') {
		console.log('[whiteboard] Supabase not configured (missing URL or key)')
		supabaseClient = null
		return null
	}
	supabaseClient = createClient(url, key)
	console.log('[whiteboard] Supabase client initialized')
	return supabaseClient
}

function loadMap(): Record<string, string> {
	try {
		const raw = localStorage.getItem(MAP_KEY)
		if (!raw) return {}
		const p = JSON.parse(raw) as unknown
		if (!p || typeof p !== 'object') return {}
		const out: Record<string, string> = {}
		for (const [k, v] of Object.entries(p)) {
			if (typeof k === 'string' && typeof v === 'string') out[k] = v
		}
		return out
	} catch {
		return {}
	}
}

function saveMap(data: Record<string, string>): void {
	try {
		localStorage.setItem(MAP_KEY, JSON.stringify(data))
	} catch {
		// ignore
	}
}

for (const [pageId, shareId] of Object.entries(loadMap())) {
	pageToShareId.set(pageId, shareId)
}

export function getShareIdForPage(pageId: string): string | undefined {
	return pageToShareId.get(pageId)
}

export function getPageIdForShareId(shareId: string): string | undefined {
	for (const [pageId, sid] of pageToShareId) {
		if (sid === shareId) return pageId
	}
	return undefined
}

export function setShareIdForPage(pageId: string, shareId: string): void {
	pageToShareId.set(pageId, shareId)
	saveMap(Object.fromEntries(pageToShareId))
}

function generateShareId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(6))
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function buildShareUrl(id: string): string {
	if (typeof window === 'undefined') return `?p=${encodeURIComponent(id)}`
	return `${window.location.origin}${window.location.pathname || '/'}?p=${encodeURIComponent(id)}`
}

export function getShareIdFromUrl(): string | null {
	if (typeof window === 'undefined') return null
	const id = new URLSearchParams(window.location.search).get('p')
	return id?.trim() || null
}

export function setShareIdInUrl(id: string): void {
	if (typeof window === 'undefined') return
	const url = new URL(window.location.href)
	url.searchParams.set('p', id)
	window.history.replaceState({}, '', url.toString())
	window.dispatchEvent(new CustomEvent(URL_CHANGED_EVENT))
}

export function clearShareIdFromUrl(): void {
	if (typeof window === 'undefined') return
	const url = new URL(window.location.href)
	url.searchParams.delete('p')
	window.history.replaceState({}, '', url.toString())
}

export async function savePageToSupabase(snapshot: ShareSnapshot): Promise<{ id: string; url: string } | null> {
	const supabase = getSupabaseClient()
	if (!supabase) {
		console.log('[whiteboard] savePageToSupabase: skipped (no client)')
		return null
	}
	const id = generateShareId()
	console.log('[whiteboard] savePageToSupabase: inserting', id)
	const { error } = await supabase.from(SHARE_TABLE).insert({
		id,
		snapshot,
		created_at: new Date().toISOString(),
	})
	if (error) {
		console.error('[whiteboard] savePageToSupabase: failed', error)
		throw new Error(error.message)
	}
	console.log('[whiteboard] savePageToSupabase: success', id)
	return { id, url: buildShareUrl(id) }
}

/** Update existing shared page in Supabase. Used when saving changes to a shared page (no sync). */
export async function updateSharedPageInSupabase(shareId: string, snapshot: ShareSnapshot): Promise<void> {
	if (!shareId || shareId.trim() === '') return
	const supabase = getSupabaseClient()
	if (!supabase) return
	const { error } = await supabase
		.from(SHARE_TABLE)
		.update({ snapshot })
		.eq('id', shareId)
	if (error) {
		console.error('[whiteboard] updateSharedPageInSupabase: failed', error)
		throw new Error(error.message)
	}
}

export function isShareAvailable(): boolean {
	return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

/** Max iterations for descendant traversal. Bounds the loop per NASA guidelines. */
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

/** Get record ids for a page and its descendants from a store snapshot. */
export function getPageRecordIds(
	storeSnapshot: { store: Record<string, unknown> },
	pageId: string
): string[] {
	const doc = getPageDocumentFromStore(storeSnapshot, pageId)
	if (!doc) return []
	return Object.keys(doc.document.store)
}

/** Get the first (and typically only) page id in a store snapshot. */
export function getFirstPageIdFromStore(storeSnapshot: { store: Record<string, unknown> }): string | null {
	const all = storeSnapshot.store ?? {}
	for (const [id, rec] of Object.entries(all)) {
		const r = rec as { typeName?: string }
		if (r?.typeName === 'page') return id
	}
	return null
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

/** Load shared page content from Supabase. Returns null if not found or Supabase not configured. */
export async function loadSharedPageFromSupabase(shareId: string): Promise<ShareSnapshot | null> {
	if (!shareId || shareId.trim() === '') return null
	const supabase = getSupabaseClient()
	if (!supabase) return null
	const { data, error } = await supabase
		.from(SHARE_TABLE)
		.select('snapshot')
		.eq('id', shareId)
		.single()
	if (error || !data?.snapshot) return null
	const s = data.snapshot as ShareSnapshot
	const doc = s?.document ?? s
	if (!doc?.store || !doc?.schema) return null
	return { document: { store: doc.store, schema: doc.schema } }
}

/** True when sync server URL is configured. */
export function isSyncAvailable(): boolean {
	const url = import.meta.env.VITE_SYNC_SERVER_URL ?? ''
	return url.length > 0
}

/** Build WebSocket URI for sync server. Returns empty string if not configured. */
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

type ParsedSnapshot = {
	document?: { store?: Record<string, unknown>; schema?: unknown }
	session?: { currentPageId?: string; pageStates?: unknown[] }
}

function parseOrCreateSnapshot(raw: string | null): ParsedSnapshot {
	const parsed: ParsedSnapshot = raw ? (JSON.parse(raw) as ParsedSnapshot) : { document: { store: {}, schema: undefined }, session: {} }
	if (!parsed.document) parsed.document = { store: {}, schema: undefined }
	if (!parsed.document.store) parsed.document.store = {}
	return parsed
}

/** Recursively replace fromId with toId in JSON-serializable values (ids, parentId, etc.). */
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

/** Load local storage, merge shared page from DB (always fresh; never use stale local cache), save. Returns targetPageId or error.
 * Pass signal to abort; when aborted, skips save and returns { aborted: true } so the consumer can silently exit without treating as success.
 * When we already have a page mapped to this share (existingPageId), remaps shared content to that id to avoid duplicates. */
export async function loadAndMergeSharedPage(
	shareId: string,
	signal?: AbortSignal
): Promise<{ targetPageId: string; pageCount: number } | { error: string } | { aborted: true }> {
	if (!isShareAvailable()) {
		const existingPageId = getPageIdForShareId(shareId)
		if (!existingPageId) {
			return { error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable shared pages.' }
		}
	}
	const raw = loadPersistedSnapshot()
	const parsed = parseOrCreateSnapshot(raw)
	const existingPageId = getPageIdForShareId(shareId)
	let targetPageId = existingPageId ?? ''
	if (isShareAvailable()) {
		const shared = await loadSharedPageFromSupabase(shareId)
		if (shared?.document?.store) {
			const store = shared.document.store
			const doc = parsed.document!
			const pageRecord = Object.values(store).find(
				(r): r is { typeName: string; id: string; name?: string } =>
					typeof r === 'object' && r !== null && 'typeName' in r && (r as { typeName: string }).typeName === 'page'
			)
			const sharedPageId = pageRecord?.id
			const needRemap = Boolean(existingPageId && sharedPageId && existingPageId !== sharedPageId)
			const toId = needRemap ? existingPageId : sharedPageId

			for (const [id, rec] of Object.entries(store)) {
				if (needRemap && sharedPageId && id === sharedPageId && toId) {
					const remapped = remapIdInValue(rec, sharedPageId, toId) as Record<string, unknown>
					doc.store![toId] = { ...remapped, id: toId }
				} else if (!needRemap || id !== sharedPageId) {
					doc.store![id] = needRemap && sharedPageId && toId ? (remapIdInValue(rec, sharedPageId, toId) as Record<string, unknown>) : rec
				}
			}
			if (needRemap && sharedPageId) delete doc.store![sharedPageId]
			if (shared.document.schema && !doc.schema) doc.schema = shared.document.schema

			const finalPageId = toId ?? sharedPageId
			if (finalPageId) {
				setShareIdForPage(finalPageId, shareId)
				targetPageId = finalPageId
				if (!parsed.session) parsed.session = {}
				parsed.session.currentPageId = finalPageId
			}
		}
	} else if (existingPageId) {
		if (!parsed.session) parsed.session = {}
		parsed.session.currentPageId = existingPageId
	}
	if (signal?.aborted) return { aborted: true }
	if (isShareAvailable() && targetPageId === '') {
		return { error: 'Shared page not found or empty.' }
	}
	const pageCount = Object.values(parsed.document?.store ?? {}).filter(
		(r): r is { typeName: string } =>
			typeof r === 'object' && r !== null && 'typeName' in r && (r as { typeName: string }).typeName === 'page'
	).length
	savePersistedSnapshot(JSON.stringify(parsed))
	return { targetPageId, pageCount }
}

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

/** Get content snapshot for a specific page (switches page temporarily). */
export async function getContentAsJsonDocForPage(
	editor: Editor,
	pageId: TLPageId
): Promise<ShareSnapshot | null> {
	const prevPageId = editor.getCurrentPageId()
	if (prevPageId === pageId) {
		const shapeIds = editor.getPageShapeIds(pageId)
		return getContentAsJsonDoc(editor, shapeIds)
	}
	editor.setCurrentPage(pageId)
	try {
		const shapeIds = editor.getPageShapeIds(pageId)
		return await getContentAsJsonDoc(editor, shapeIds)
	} finally {
		editor.setCurrentPage(prevPageId)
	}
}

/** Toasts API for createShareLinkForPage. */
interface CreateShareLinkToasts {
	addToast(opts: {
		title: string
		description?: string
		severity?: 'info' | 'success' | 'error'
		keepOpen?: boolean
	}): string
	removeToast(id: string): void
}

/** Fired when shared page merge completes; Editor reloads from localStorage. */
export const SHARED_PAGE_MERGED_EVENT = 'whiteboard-shared-page-merged'

export function dispatchSharedPageMerged(shareId: string): void {
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent(SHARED_PAGE_MERGED_EVENT, { detail: { shareId } }))
	}
}

/** Update URL without reload; dispatches event so App re-renders. */
export function navigateToShareUrl(url: string): void {
	if (typeof window === 'undefined') return
	window.history.pushState({}, '', url)
	window.dispatchEvent(new CustomEvent(URL_CHANGED_EVENT))
}

export function addUrlChangeListener(listener: () => void): () => void {
	window.addEventListener(URL_CHANGED_EVENT, listener)
	return () => window.removeEventListener(URL_CHANGED_EVENT, listener)
}

/** Dispatch URL change event so App re-checks shareId and can switch to SharedPage/sync. */
export function triggerUrlChangeCheck(): void {
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent(URL_CHANGED_EVENT))
	}
}

/** Create share link for a page: save to Supabase, copy URL, optionally navigate. */
export async function createShareLinkForPage(
	editor: Editor,
	pageId: TLPageId,
	toasts: CreateShareLinkToasts
): Promise<boolean> {
	const loadingId = toasts.addToast({
		title: 'Creating link…',
		severity: 'info',
		keepOpen: true,
	})
	try {
		const doc =
			pageId === editor.getCurrentPageId()
				? await getContentAsJsonDoc(editor, editor.getPageShapeIds(pageId))
				: await getContentAsJsonDocForPage(editor, pageId)
		if (!doc) {
			toasts.removeToast(loadingId)
			toasts.addToast({
				title: 'Share page unavailable',
				description: 'No content on page.',
				severity: 'error',
			})
			return false
		}
		const result = await savePageToSupabase(doc)
		toasts.removeToast(loadingId)
		if (!result) {
			toasts.addToast({
				title: 'Share page unavailable',
				description: 'Supabase is not configured.',
				severity: 'error',
			})
			return false
		}
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(result.url)
		}
		setShareIdForPage(pageId, result.id)
		toasts.addToast({ title: 'Link created', severity: 'success' })
		setShareIdInUrl(result.id)
		return true
	} catch (err) {
		toasts.removeToast(loadingId)
		toasts.addToast({
			title: 'Share page failed',
			description: err instanceof Error ? err.message : 'Could not save to database.',
			severity: 'error',
		})
		return false
	}
}
