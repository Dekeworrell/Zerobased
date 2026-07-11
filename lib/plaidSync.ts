import { supabase } from './supabase'

// Sync at most once every 4 hours per app session
const SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000
let lastSyncAttempt = 0

/**
 * Quietly sync bank transactions in the background.
 * Safe to call often — it throttles itself and never throws.
 */
export function maybeSyncPlaid() {
  const now = Date.now()
  if (now - lastSyncAttempt < SYNC_INTERVAL_MS) return
  lastSyncAttempt = now

  supabase.functions.invoke('plaid-sync-transactions').catch(() => {
    /* silent — background sync should never interrupt the user */
  })
}