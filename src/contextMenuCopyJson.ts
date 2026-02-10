import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { RefObject } from 'react'

/** Config for context menu "Copy as JSON" injection. */
const CONTEXT_MENU_COPY_JSON = {
	MENU_SELECTOR: '.context-menu',
	MENU_CONTAINER: 'excalidraw-contextMenuContainer',
	INJECTED_MARKER: 'data-copy-as-json-injected',
	COPY_LABEL_IDS: ['copyAsPng', 'copyAsSvg', 'copyText'] as const,
	MAX_MUTATIONS: 50,
	MAX_ADDED_NODES_PER_MUTATION: 50,
} as const

function stripToClipboardFromLabels(
	list: Element,
	copyLabelIds: readonly string[],
): void {
	for (const id of copyLabelIds) {
		const item = list.querySelector(`[data-testid="${id}"]`)?.closest('li')
		const label = item?.querySelector('.context-menu-item__label')
		if (label?.textContent) {
			label.textContent = label.textContent
				.replace(/\s*to\s+clipboard\s*/gi, ' ')
				.trim()
		}
	}
}

function createContextMenuInject(
	copySceneToClipboard: (selectionOnly: boolean) => void,
	excalidrawAPIRef: RefObject<ExcalidrawImperativeAPI | null>,
): (list: Element) => boolean {
	const { INJECTED_MARKER } = CONTEXT_MENU_COPY_JSON
	return function inject(list: Element): boolean {
		stripToClipboardFromLabels(list, CONTEXT_MENU_COPY_JSON.COPY_LABEL_IDS)
		if (list.querySelector(`[${INJECTED_MARKER}]`) != null) return true
		const after = list.querySelector('[data-testid="copyAsSvg"]')?.closest('li')
		if (after == null) return false
		const li = document.createElement('li')
		li.setAttribute(INJECTED_MARKER, 'true')
		li.setAttribute('data-testid', 'copyAsJson')
		li.innerHTML = `<button type="button" class="context-menu-item"><div class="context-menu-item__label">Copy as JSON</div><kbd class="context-menu-item__shortcut"></kbd></button>`
		li.addEventListener('click', () => {
			copySceneToClipboard(true)
			excalidrawAPIRef.current?.updateScene({ appState: { contextMenu: null } })
		})
		after.after(li)
		return true
	}
}

function setupContextMenuCopyJsonObserver(
	inject: (list: Element) => boolean,
): { observer: MutationObserver; cleanup: () => void } {
	const { MENU_SELECTOR, MENU_CONTAINER, MAX_MUTATIONS, MAX_ADDED_NODES_PER_MUTATION } =
		CONTEXT_MENU_COPY_JSON
	const pendingTimeouts: number[] = []

	function tryInject(): void {
		const list = document.querySelector(MENU_SELECTOR)
		if (list != null) inject(list)
	}

	function findMenuList(node: Element): Element | null {
		return node.matches(MENU_SELECTOR) ? node : node.querySelector(MENU_SELECTOR)
	}

	function handleMutations(mutations: MutationRecord[]): void {
		for (const m of mutations.slice(0, MAX_MUTATIONS)) {
			const nodes = Array.from(m.addedNodes).slice(0, MAX_ADDED_NODES_PER_MUTATION)
			for (const node of nodes) {
				if (!(node instanceof Element)) continue
				const list = findMenuList(node)
				if (list != null) {
					queueMicrotask(() => inject(list))
					return
				}
				if (node.parentElement?.classList?.contains(MENU_CONTAINER)) {
					pendingTimeouts.push(
						window.setTimeout(tryInject, 0),
						window.setTimeout(tryInject, 40),
					)
				}
			}
		}
	}

	const observer = new MutationObserver((mutations) => handleMutations(mutations))
	observer.observe(document.body, { childList: true, subtree: true })

	function cleanup(): void {
		observer.disconnect()
		for (const id of pendingTimeouts) window.clearTimeout(id)
	}
	return { observer, cleanup }
}

/** Sets up context menu injection and returns cleanup. */
export function setupContextMenuCopyJsonInjection(
	copySceneToClipboard: (selectionOnly: boolean) => void,
	excalidrawAPIRef: RefObject<ExcalidrawImperativeAPI | null>,
): () => void {
	const inject = createContextMenuInject(copySceneToClipboard, excalidrawAPIRef)
	const { cleanup } = setupContextMenuCopyJsonObserver(inject)
	return cleanup
}
