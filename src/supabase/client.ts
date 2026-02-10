import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Supabase client for cloud storage. Returns null if env vars are missing. */
export function getSupabaseClient() {
	if (!url || !anonKey) return null
	return createClient(url, anonKey)
}

/** Whether Supabase is configured (env vars present). */
export function isSupabaseConfigured(): boolean {
	return Boolean(url && anonKey)
}
