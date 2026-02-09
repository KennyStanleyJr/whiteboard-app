/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_ENABLE_PWA?: string
}

declare module 'virtual:pwa-register' {
	export function registerSW(options?: {
		immediate?: boolean
		onNeedRefresh?: () => void
		onOfflineReady?: () => void
	}): (reloadPage?: boolean) => Promise<void>
}
