import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let clientInstance: SupabaseClient | null = null

/** Supabase client for cloud storage (singleton). Returns null if env vars are missing. */
export function getSupabaseClient(): SupabaseClient | null {
	if (!url || !anonKey) return null
	if (clientInstance === null) {
		clientInstance = createClient(url, anonKey)
	}
	return clientInstance
}

/** Whether Supabase is configured (env vars present). */
export function isSupabaseConfigured(): boolean {
	return Boolean(url && anonKey)
}
