import * as bcrypt from 'bcryptjs'
import { getSupabaseClient } from './client'

const BCRYPT_ROUNDS = 10
const TABLE = 'whiteboards'
const NAME_MAX_LENGTH = 200
const PASSWORD_MAX_LENGTH = 72
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUuid(id: string): boolean { return UUID_REGEX.test(id) }

export type WhiteboardRow = { id: string; name: string; password_hash: string | null; data: unknown; created_at: string; updated_at: string }
type WhiteboardInsert = Omit<WhiteboardRow, 'id' | 'created_at'> & { updated_at: string }
type WhiteboardSelect = Pick<WhiteboardRow, 'id' | 'name' | 'password_hash' | 'created_at' | 'updated_at'>

export type SaveWhiteboardParams = { name: string; password?: string; data: unknown }
export type SaveWhiteboardResult = { ok: true; id: string } | { ok: false; error: string }
export type LoadWhiteboardResult = { ok: true; data: unknown } | { ok: false; error: string }
export type ListWhiteboardItem = { id: string; name: string; hasPassword: boolean; created_at: string; updated_at: string }
export type ListWhiteboardsResult = { ok: true; items: ListWhiteboardItem[] } | { ok: false; error: string }
export type DeleteWhiteboardResult = { ok: true } | { ok: false; error: string }

function hashPassword(password: string): string { return bcrypt.hashSync(password, BCRYPT_ROUNDS) }
function verifyPassword(password: string, hash: string): boolean { return bcrypt.compareSync(password, hash) }

export async function saveWhiteboard(params: SaveWhiteboardParams): Promise<SaveWhiteboardResult> {
	const supabase = getSupabaseClient()
	if (!supabase) return { ok: false, error: 'Supabase is not configured.' }
	const name = params.name.trim()
	if (!name) return { ok: false, error: 'Name is required.' }
	if (name.length > NAME_MAX_LENGTH) return { ok: false, error: `Name must be ${NAME_MAX_LENGTH} characters or less.` }
	const rawPassword = params.password?.trim() ?? ''
	if (rawPassword.length > PASSWORD_MAX_LENGTH) return { ok: false, error: `Password must be ${PASSWORD_MAX_LENGTH} characters or less.` }
	const passwordHash = rawPassword.length > 0 ? hashPassword(rawPassword) : null
	const row: WhiteboardInsert = { name, password_hash: passwordHash, data: params.data, updated_at: new Date().toISOString() }
	const { data: existing } = await supabase.from(TABLE).select('id').eq('name', name).maybeSingle() as { data: { id: string } | null }
	if (existing) {
		const { error } = await supabase.from(TABLE).update(row).eq('id', existing.id)
		if (error) return { ok: false, error: error.message }
		return { ok: true, id: existing.id }
	}
	const { data: inserted, error } = await supabase.from(TABLE).insert(row).select('id').single() as { data: { id: string } | null; error: Error | null }
	if (error) return { ok: false, error: error.message }
	if (!inserted) return { ok: false, error: 'Insert failed.' }
	return { ok: true, id: inserted.id }
}

export async function loadWhiteboard(id: string, password?: string): Promise<LoadWhiteboardResult> {
	const supabase = getSupabaseClient()
	if (!supabase) return { ok: false, error: 'Supabase is not configured.' }
	if (!isValidUuid(id)) return { ok: false, error: 'Whiteboard not found.' }
	const { data, error } = await supabase.from(TABLE).select('password_hash, data').eq('id', id).maybeSingle()
	if (error) return { ok: false, error: error.message }
	if (!data) return { ok: false, error: 'Whiteboard not found.' }
	const row = data as { password_hash: string | null; data: unknown }
	if (row.password_hash && !verifyPassword(password ?? '', row.password_hash)) return { ok: false, error: 'Incorrect password.' }
	return { ok: true, data: row.data }
}

export async function listWhiteboards(): Promise<ListWhiteboardsResult> {
	const supabase = getSupabaseClient()
	if (!supabase) return { ok: false, error: 'Supabase is not configured.' }
	const { data, error } = await supabase.from(TABLE).select('id, name, password_hash, created_at, updated_at').order('updated_at', { ascending: false })
	if (error) return { ok: false, error: error.message }
	const rows = (data ?? []) as WhiteboardSelect[]
	const items: ListWhiteboardItem[] = rows.map((r) => ({ id: r.id, name: r.name, hasPassword: Boolean(r.password_hash), created_at: r.created_at, updated_at: r.updated_at }))
	return { ok: true, items }
}

export async function deleteWhiteboard(id: string, password?: string): Promise<DeleteWhiteboardResult> {
	const supabase = getSupabaseClient()
	if (!supabase) return { ok: false, error: 'Supabase is not configured.' }
	if (!isValidUuid(id)) return { ok: false, error: 'Whiteboard not found.' }
	const { data, error: fetchError } = await supabase.from(TABLE).select('password_hash').eq('id', id).maybeSingle()
	if (fetchError) return { ok: false, error: fetchError.message }
	if (!data) return { ok: false, error: 'Whiteboard not found.' }
	const row = data as { password_hash: string | null }
	if (row.password_hash && !verifyPassword(password ?? '', row.password_hash)) return { ok: false, error: 'Incorrect password.' }
	const { error: deleteError } = await supabase.from(TABLE).delete().eq('id', id)
	if (deleteError) return { ok: false, error: deleteError.message }
	return { ok: true }
}
