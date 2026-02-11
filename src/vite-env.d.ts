/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_TLDRAW_LICENSE_KEY?: string
	readonly VITE_SUPABASE_URL?: string
	readonly VITE_SUPABASE_ANON_KEY?: string
	readonly VITE_SYNC_SERVER_URL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}

declare module 'virtual:pwa-register' {
	export interface RegisterSWOptions {
		immediate?: boolean
		onNeedRefresh?: () => void
		onOfflineReady?: () => void
		onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
		onRegisteredSW?: (swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void
		onRegisterError?: (error: unknown) => void
	}
	export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}
