import { restoreElements } from '@excalidraw/excalidraw'
import type {
	BinaryFileData,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types'

type ElementLike = Record<string, unknown> & { id: string }

function nextId(): string {
	return crypto.randomUUID()
}

/**
 * Returns a copy of pasted elements with new unique ids and remapped references
 * so pasted content does not collide with existing canvas elements.
 */
function remapPastedElementIds(elements: readonly ElementLike[]): ElementLike[] {
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

	return elements.map((el) =>
		mapSingleElement(el, idMap, mapId, mapGroupIds),
	)
}

type IdMappers = {
	mapId: (id: string) => string
	mapGroupIds: (ids: readonly string[] | undefined) => string[]
}

function mapSingleElement(
	el: ElementLike,
	idMap: Map<string, string>,
	mapId: IdMappers['mapId'],
	mapGroupIds: IdMappers['mapGroupIds'],
): ElementLike {
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
	return newEl
}

type SceneAPI = Pick<
	ExcalidrawImperativeAPI,
	'getSceneElements' | 'addFiles' | 'updateScene'
>

type ParsedScene = {
	elements?: unknown
	files?: Record<string, BinaryFileData>
}

/** Parses text as JSON and returns the object if it has an elements array; otherwise null. */
function parseSceneJson(text: string): ParsedScene | null {
	const trimmed = text?.trim()
	if (!trimmed) return null
	let parsed: unknown
	try {
		parsed = JSON.parse(trimmed)
	} catch {
		return null
	}
	if (parsed == null || typeof parsed !== 'object') return null
	const obj = parsed as Record<string, unknown>
	if (!Array.isArray(obj.elements)) return null
	return parsed as ParsedScene
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
		const restoredElements = restoreElements(
			Array.isArray(parsed.elements) ? parsed.elements : [],
			null,
		)
		const pastedWithNewIds = remapPastedElementIds(
			restoredElements as readonly ElementLike[],
		)
		const currentElements = api.getSceneElements()
		const newElements = [...currentElements, ...pastedWithNewIds]
		const files = parsed.files ?? {}
		const fileList = Object.values(files)
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
