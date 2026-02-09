import {
	restoreAppState,
	restoreElements,
	serializeAsJSON,
} from '@excalidraw/excalidraw'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import type { OnChangeParams } from '../types'

type SceneData = {
	elements?: unknown
	appState?: Parameters<typeof restoreAppState>[0]
	files?: BinaryFiles
}

function restoreScene(data: SceneData): {
	elements: ReturnType<typeof restoreElements>
	appState: ReturnType<typeof restoreAppState>
	files: BinaryFiles
} {
	const rawElements = Array.isArray(data.elements) ? data.elements : []
	const elements = restoreElements(
		rawElements as Parameters<typeof restoreElements>[0],
		null,
	)
	const appState = restoreAppState(data.appState ?? null, null)
	const files = data.files ?? {}
	return { elements, appState, files }
}

const SCENE_STORAGE_KEY = 'whiteboard-scene'
export const SAVE_DEBOUNCE_MS = 400

/** View state keys that serializeAsJSON("local") omits; we persist them so pan/zoom restore. */
const VIEW_STATE_KEYS = ['scrollX', 'scrollY', 'zoom'] as const

function serializeToData(
	elements: OnChangeParams[0],
	appState: OnChangeParams[1],
	files: OnChangeParams[2],
): string {
	const json = serializeAsJSON(elements, appState, files, 'local')
	const data = JSON.parse(json) as {
		appState?: Record<string, unknown>
		[key: string]: unknown
	}
	if (data.appState && typeof data.appState === 'object') {
		const state = appState as unknown as Record<string, unknown>
		const out = data.appState
		for (const key of VIEW_STATE_KEYS) {
			if (key in appState) out[key] = state[key]
		}
	}
	return JSON.stringify(data)
}

export function loadStoredScene(): ReturnType<typeof restoreScene> | null {
	if (typeof window === 'undefined') return null
	try {
		const raw = localStorage.getItem(SCENE_STORAGE_KEY)
		if (!raw) return null
		const data = JSON.parse(raw) as SceneData
		if (data == null || typeof data !== 'object') return null
		return restoreScene(data)
	} catch {
		return null
	}
}

export function getSceneAsJSON(
	elements: OnChangeParams[0],
	appState: OnChangeParams[1],
	files: OnChangeParams[2],
): string {
	return serializeToData(elements, appState, files)
}

export function saveSceneToStorage(
	elements: OnChangeParams[0],
	appState: OnChangeParams[1],
	files: OnChangeParams[2],
): void {
	try {
		localStorage.setItem(SCENE_STORAGE_KEY, serializeToData(elements, appState, files))
	} catch {
		// Ignore storage errors (e.g. private mode, quota)
	}
}
