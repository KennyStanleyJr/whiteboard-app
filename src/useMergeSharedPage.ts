/**
 * Hook to load local storage, merge shared page if new, and save.
 * Used by Editor when viewing a shared page (?p=ID).
 * Aborts when unmounting so a stale save does not overwrite localStorage on refresh.
 * Times out after 15s to avoid indefinite loading (e.g. sync server cold start).
 * Calls onMergeComplete when merge succeeds so the Editor can reload from localStorage.
 * Skips merge when page is already in store (e.g. we just shared it ourselves).
 */

import type { TLPageId } from '@tldraw/tlschema'
import type { TLStore } from 'tldraw'
import { useEffect, useRef, useState } from 'react'
import { dispatchSharedPageMerged, getPageIdForShareId, loadAndMergeSharedPage } from './sharePage'

const LOAD_TIMEOUT_MS = 15_000

export type MergeState =
	| { status: 'loading' }
	| { status: 'ready'; targetPageId: string; pageCount: number }
	| { status: 'error'; error: string }

export type UseMergeSharedPageOptions = {
	onMergeComplete?: (shareId: string) => void
	/** Increment to retry the merge (e.g. after error). */
	retryKey?: number
	/** When provided, skip merge if this page is already in the store (e.g. we just shared it). */
	store?: TLStore
}

function getPageCountFromStore(store: TLStore): number {
	const snap = store.getStoreSnapshot('document') as { store?: Record<string, unknown> }
	const all = snap?.store ?? {}
	return Object.values(all).filter(
		(r): r is { typeName: string } =>
			typeof r === 'object' && r !== null && 'typeName' in r && (r as { typeName: string }).typeName === 'page'
	).length
}

export function useMergeSharedPage(shareId: string, options?: UseMergeSharedPageOptions): MergeState {
	const needsMerge = Boolean(shareId && shareId.trim() !== '')
	const store = options?.store
	const [state, setState] = useState<MergeState>(() => {
		if (!needsMerge) return { status: 'ready', targetPageId: '', pageCount: 0 }
		const pageId = getPageIdForShareId(shareId)
		if (store && pageId && store.get(pageId as TLPageId)) {
			return {
				status: 'ready',
				targetPageId: pageId,
				pageCount: getPageCountFromStore(store),
			}
		}
		return { status: 'loading' }
	})
	const timedOutRef = useRef(false)
	const onMergeCompleteRef = useRef(options?.onMergeComplete)
	onMergeCompleteRef.current = options?.onMergeComplete
	const retryKey = options?.retryKey ?? 0
	useEffect(() => {
		if (!needsMerge) {
			setState({ status: 'ready', targetPageId: '', pageCount: 0 })
			return
		}
		const pageId = getPageIdForShareId(shareId)
		if (store && pageId && store.get(pageId as TLPageId)) {
			setState({
				status: 'ready',
				targetPageId: pageId,
				pageCount: getPageCountFromStore(store),
			})
			return
		}
		timedOutRef.current = false
		const controller = new AbortController()
		const timeoutId = setTimeout(() => {
			timedOutRef.current = true
			controller.abort()
			setState({
				status: 'error',
				error: 'Connection timed out. The server may be starting up. Try again.',
			})
		}, LOAD_TIMEOUT_MS)
		void loadAndMergeSharedPage(shareId, controller.signal).then((result) => {
			clearTimeout(timeoutId)
			if (timedOutRef.current || controller.signal.aborted) return
			if ('aborted' in result && result.aborted) return
			if ('error' in result) setState({ status: 'error', error: result.error })
			else if ('targetPageId' in result && 'pageCount' in result) {
				setState({ status: 'ready', targetPageId: result.targetPageId, pageCount: result.pageCount })
				dispatchSharedPageMerged(shareId)
				onMergeCompleteRef.current?.(shareId)
			}
		}).catch((err) => {
			clearTimeout(timeoutId)
			if (!timedOutRef.current && !controller.signal.aborted) {
				setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
			}
		})
		return () => {
			clearTimeout(timeoutId)
			controller.abort()
		}
	}, [shareId, retryKey, store, needsMerge])
	return state
}
