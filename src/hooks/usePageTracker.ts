/**
 * Watches the store's current page and synchronizes machine events.
 *
 * Two responsibilities, cleanly separated:
 *   1. useLayoutEffect — on mount, read URL and send ENTER_SHARED.
 *   2. useEffect       — on page *change*, update URL and send events.
 *
 * The useEffect never re-reads the URL to override the store; it only
 * reacts to currentPageId changes.  This prevents the race where the
 * initial check() sees the localStorage page before the merge completes.
 */

import { useEffect, useLayoutEffect, useRef } from 'react'
import { TLINSTANCE_ID } from 'tldraw'
import type { TLStore } from 'tldraw'
import {
	getShareIdFromUrl,
	setShareIdInUrl,
	clearShareIdFromUrl,
	getShareIdForPage,
	getPageIdForShareId,
} from '../persistence'
import type { WhiteboardEvent } from '../machine'

type Send = (event: WhiteboardEvent) => void

export function usePageTracker(store: TLStore, send: Send): void {
	const sendRef = useRef(send)
	sendRef.current = send
	const prevShareId = useRef<string | null>(null)

	useLayoutEffect(() => {
		const shareIdFromUrl = getShareIdFromUrl()
		if (!shareIdFromUrl) return
		const pageId = getPageIdForShareId(shareIdFromUrl) ?? ''
		if (pageId) {
			try {
				store.update(TLINSTANCE_ID, (i) => ({ ...i, currentPageId: pageId as import('@tldraw/tlschema').TLPageId }))
			} catch {
				/* page may not exist in store yet */
			}
		}
		prevShareId.current = shareIdFromUrl
		sendRef.current({ type: 'ENTER_SHARED', shareId: shareIdFromUrl, pageId })
	}, [store])

	useEffect(() => {
		const inst = store.get(TLINSTANCE_ID) as { currentPageId?: string } | undefined
		const prevPageIdRef = { current: inst?.currentPageId ?? '' }

		const onPageChange = (): void => {
			const cur = store.get(TLINSTANCE_ID) as { currentPageId?: string } | undefined
			if (!cur?.currentPageId) return
			const pageId = cur.currentPageId
			if (prevPageIdRef.current === pageId) return
			prevPageIdRef.current = pageId

			const shareId = getShareIdForPage(pageId)
			if (shareId) {
				setShareIdInUrl(shareId)
				if (prevShareId.current !== shareId) {
					prevShareId.current = shareId
					sendRef.current({ type: 'ENTER_SHARED', shareId, pageId })
				}
			} else {
				if (prevShareId.current) {
					prevShareId.current = null
					sendRef.current({ type: 'LEAVE_SHARED' })
					// Keep URL with shareId so we can detect stale local state and enforce read-only
				} else {
					clearShareIdFromUrl()
				}
			}
		}

		if (!prevShareId.current) onPageChange()

		return store.listen(onPageChange)
	}, [store])
}
