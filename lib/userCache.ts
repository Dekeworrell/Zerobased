/**
 * Lightweight cache for the two most-repeated async calls:
 *   1. supabase.auth.getSession() → user ID  (synchronous from local JWT, but still async)
 *   2. get_household_user_ids RPC             (always a network round-trip)
 *
 * Both are cached for 60 seconds. Call invalidateUserCache() on logout or
 * household membership changes so the next load gets fresh data.
 */

import { supabase } from './supabase'

type Cell<T> = { v: T; at: number } | null

const TTL = 60_000 // 1 minute

let _userId: Cell<string> = null
let _householdIds: Cell<string[]> = null

function fresh<T>(c: Cell<T>): T | null {
  return c && Date.now() - c.at < TTL ? c.v : null
}

/**
 * Returns the current user's ID from the local session (no network call).
 * Uses getSession() — fast, reads from memory/AsyncStorage.
 * Safe for read operations; RLS enforces security server-side.
 */
export async function getCachedUserId(): Promise<string | null> {
  const hit = fresh(_userId)
  if (hit) return hit
  const { data: { session } } = await supabase.auth.getSession()
  const id = session?.user?.id ?? null
  if (id) _userId = { v: id, at: Date.now() }
  return id
}

/**
 * Returns the user IDs in the household (includes the user themselves).
 * Cached for 60s to avoid calling the RPC on every tab focus.
 */
export async function getCachedHouseholdIds(userId: string): Promise<string[]> {
  const hit = fresh(_householdIds)
  if (hit) return hit
  const { data } = await supabase.rpc('get_household_user_ids')
  const ids: string[] = data?.length ? data : [userId]
  _householdIds = { v: ids, at: Date.now() }
  return ids
}

/** Call on logout or when household membership changes. */
export function invalidateUserCache() {
  _userId = null
  _householdIds = null
}
