import { restore } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

export type ElementLike = Record<string, unknown> & { id: string }

function nextId(): string {
	return crypto.randomUUID()
}

/**
 * Returns a copy of pasted elements with new unique ids and remapped references
 * so pasted content does not collide with existing canvas elements.
 */
function remapPastedElementIds(
	elements: readonly ElementLike[],
): ElementLike[] {
	const idMap = new Map<string, string>()
	const groupIdMap = new Map<string, string>()
	for (const el of elements) {
		if (!idMap.has(el.id)) idMap.set(el.id, nextId())
		const groupIds = el.groupIds as readonly string[] | undefined
		if (Array.isArray(groupIds)) {
			for (const gid of groupIds) {
				if (typeof gid === 'string' && !groupIdMap.has(gid)) {
					groupIdMap.set(gid, nextId())
				}
			}
		}
	}
	function mapId(id: string): string {
		return idMap.get(id) ?? id
	}
	function mapGroupIds(ids: readonly string[] | undefined): string[] {
		if (!Array.isArray(ids)) return []
		return ids.map((g) =>
			typeof g === 'string' ? groupIdMap.get(g) ?? g : '',
		)
	}

	const result: ElementLike[] = []
	for (const el of elements) {
		const newEl: ElementLike = {
			...el,
			id: mapId(el.id),
			groupIds: mapGroupIds(el.groupIds as readonly string[] | undefined),
		}
		const frameId = el.frameId
		if (typeof frameId === 'string' && frameId !== '') {
			newEl.frameId = idMap.has(frameId) ? mapId(frameId) : null
		}
		const boundElements = el.boundElements
		if (Array.isArray(boundElements)) {
			newEl.boundElements = boundElements
				.filter((b: unknown) => {
					if (typeof b !== 'object' || b == null || !('id' in b)) return false
					const id = (b as { id: string }).id
					return typeof id === 'string' && idMap.has(id)
				})
				.map((b: unknown) => {
					const bound = b as { id: string; type?: string }
					return { ...bound, id: mapId(bound.id) }
				})
		}
		const containerId = el.containerId
		if (typeof containerId === 'string') {
			newEl.containerId = idMap.has(containerId) ? mapId(containerId) : null
		}
		const startBinding = el.startBinding as { elementId: string } | undefined
		if (startBinding?.elementId != null) {
			newEl.startBinding = idMap.has(startBinding.elementId)
				? { ...startBinding, elementId: mapId(startBinding.elementId) }
				: null
		}
		const endBinding = el.endBinding as { elementId: string } | undefined
		if (endBinding?.elementId != null) {
			newEl.endBinding = idMap.has(endBinding.elementId)
				? { ...endBinding, elementId: mapId(endBinding.elementId) }
				: null
		}
		result.push(newEl)
	}
	return result
}

type SceneAPI = Pick<
	ExcalidrawImperativeAPI,
	'getSceneElements' | 'addFiles' | 'updateScene'
>

/** Parses text as JSON and returns the object if it has an elements array; otherwise null. */
function parseSceneJson(text: string): Parameters<typeof restore>[0] | null {
	const trimmed = text?.trim()
	if (trimmed == null || trimmed === '') return null
	let parsed: unknown
	try {
		parsed = JSON.parse(trimmed)
	} catch {
		return null
	}
	if (parsed == null || typeof parsed !== 'object') return null
	const obj = parsed as Record<string, unknown>
	if (!Array.isArray(obj.elements)) return null
	return parsed as Parameters<typeof restore>[0]
}

/**
 * If the given text is valid scene JSON (object with an elements array), restores
 * it, remaps ids, merges into the canvas, and returns true. Otherwise returns false.
 */
export function applySceneJsonToCanvas(
	text: string,
	api: SceneAPI | null,
): boolean {
	const parsed = parseSceneJson(text)
	if (parsed == null || api == null) return false

	try {
		const restored = restore(parsed, null, null)
		const pastedWithNewIds = remapPastedElementIds(
			restored.elements as readonly ElementLike[],
		)
		const currentElements = api.getSceneElements()
		const newElements = [...currentElements, ...pastedWithNewIds]
		const fileList = Object.values(restored.files)
		if (fileList.length > 0) {
			api.addFiles(fileList)
		}
		api.updateScene({
			elements: newElements as Parameters<
				ExcalidrawImperativeAPI['updateScene']
			>[0]['elements'],
		})
		return true
	} catch {
		return false
	}
}
