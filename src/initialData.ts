import {
	applyPreferencesToAppState,
	loadStoredScene,
	loadStoredSettings,
} from './storage'

export function getInitialData() {
	const settings = loadStoredSettings()
	const scene = loadStoredScene()
	if (scene == null) return null
	const appState = scene.appState as unknown as Record<string, unknown>
	applyPreferencesToAppState(appState, settings.preferences)
	return scene
}
