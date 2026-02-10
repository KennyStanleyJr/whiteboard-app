const SETTINGS_STORAGE_KEY = 'whiteboard-settings'

/** Preference keys we persist from Excalidraw appState. */
const PREFERENCE_KEYS = [
	'gridModeEnabled',
	'zenModeEnabled',
	'viewModeEnabled',
	'objectsSnapModeEnabled',
	'exportBackground',
] as const
const ELEMENT_LOCK_KEY = 'elementLockEnabled' as const

type StoredPreferences = Partial<{
	gridModeEnabled: boolean
	zenModeEnabled: boolean
	viewModeEnabled: boolean
	objectsSnapModeEnabled: boolean
	elementLockEnabled: boolean
	exportBackground: boolean
}>

type StoredSettings = {
	theme: 'light' | 'dark'
	preferences: StoredPreferences
}

function getDefaults(): StoredSettings {
	return {
		theme: 'dark',
		preferences: {},
	}
}

export function loadStoredSettings(): StoredSettings {
	if (typeof window === 'undefined') return getDefaults()
	try {
		const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
		if (!raw) return getDefaults()
		const parsed = JSON.parse(raw) as Partial<StoredSettings>
		if (parsed == null || typeof parsed !== 'object') return getDefaults()
		const theme =
			parsed.theme === 'dark' || parsed.theme === 'light' ? parsed.theme : 'dark'
		const prefs: StoredPreferences = {}
		const src = parsed.preferences ?? {}
		for (const key of [...PREFERENCE_KEYS, ELEMENT_LOCK_KEY] as const) {
			const v = src[key]
			if (typeof v === 'boolean') prefs[key] = v
		}
		return { theme, preferences: prefs }
	} catch {
		return getDefaults()
	}
}

export function saveStoredSettings(settings: StoredSettings): void {
	try {
		localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
	} catch {
		// Ignore storage errors (e.g. private mode, quota)
	}
}

export function extractPreferences(appState: Record<string, unknown>): StoredPreferences {
	const prefs: StoredPreferences = {}
	for (const key of PREFERENCE_KEYS) {
		const v = appState[key]
		if (typeof v === 'boolean') prefs[key] = v
	}
	const activeTool = appState.activeTool as { locked?: boolean } | undefined
	if (
		activeTool != null &&
		typeof activeTool === 'object' &&
		typeof activeTool.locked === 'boolean'
	) {
		prefs[ELEMENT_LOCK_KEY] = activeTool.locked
	}
	return prefs
}

/** Merges stored preferences into appState. Mutates appState. */
export function applyPreferencesToAppState(
	appState: Record<string, unknown>,
	preferences: StoredPreferences,
): void {
	for (const key of PREFERENCE_KEYS) {
		let v = preferences[key]
		// Default for existing users upgrading before we persisted this.
		if (key === 'exportBackground' && v === undefined) v = false
		if (typeof v === 'boolean') appState[key] = v
	}
	const locked = preferences[ELEMENT_LOCK_KEY]
	if (typeof locked === 'boolean') {
		const activeTool = appState.activeTool as Record<string, unknown> | undefined
		if (activeTool != null && typeof activeTool === 'object') {
			activeTool.locked = locked
		}
	}
}
