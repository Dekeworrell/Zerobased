import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = 'https://tkldjaqcovjdiwjpnphf.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID') ?? ''
const PLAID_SECRET = Deno.env.get('PLAID_SECRET') ?? ''
const PLAID_ENV = Deno.env.get('PLAID_ENV') ?? 'sandbox'

const PLAID_BASE_URL: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
}

// ----------------------------------------------------------------
// Map Plaid personal finance categories → Zerobased category IDs
// Plaid category reference: https://plaid.com/docs/transactions/categories/
// ----------------------------------------------------------------
const CATEGORY_MAP: Record<string, string> = {
  // Food & Drink
  'FOOD_AND_DRINK_GROCERIES': 'groceries',
  'FOOD_AND_DRINK_RESTAURANTS': 'dining',
  'FOOD_AND_DRINK_FAST_FOOD': 'dining',
  'FOOD_AND_DRINK_COFFEE': 'dining',
  'FOOD_AND_DRINK_ALCOHOL_AND_BAR': 'entertainment',

  // Transportation
  'TRANSPORTATION_GAS': 'fuel',
  'TRANSPORTATION_FUEL': 'fuel',
  'TRANSPORTATION_PARKING': 'transport',
  'TRANSPORTATION_PUBLIC_TRANSIT': 'transport',
  'TRANSPORTATION_TAXIS_AND_RIDE_SHARING': 'transport',
  'TRANSPORTATION_CAR_SERVICE': 'transport',
  'TRANSPORTATION_AUTOMOTIVE': 'vehicle_maintenance',

  // Entertainment
  'ENTERTAINMENT_MUSIC_AND_AUDIO': 'entertainment',
  'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS': 'entertainment',
  'ENTERTAINMENT_TV_AND_MOVIES': 'entertainment',
  'ENTERTAINMENT_VIDEO_GAMES': 'entertainment',

  // General merchandise / shopping
  'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES': 'clothing',
  'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES': 'other',
  'GENERAL_MERCHANDISE_SPORTING_GOODS': 'sports',
  'GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS': 'education',
  'GENERAL_MERCHANDISE_PET_SUPPLIES': 'pets',

  // Home improvement
  'HOME_IMPROVEMENT_HARDWARE': 'other',
  'HOME_IMPROVEMENT_FURNITURE': 'other',

  // Medical
  'MEDICAL_PHARMACIES_AND_SUPPLEMENTS': 'health',
  'MEDICAL_DENTAL_CARE': 'health',
  'MEDICAL_VISION_CARE': 'health',
  'MEDICAL_PRIMARY_CARE': 'health',

  // Personal care / fitness
  'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS': 'fitness',
  'PERSONAL_CARE_HAIR_AND_BEAUTY': 'other',

  // Travel
  'TRAVEL_FLIGHTS': 'entertainment',
  'TRAVEL_LODGING': 'entertainment',
  'TRAVEL_RENTAL_CARS': 'transport',

  // Utilities / phone
  'HOME_SERVICES_TELEPHONE': 'phone',
  'HOME_SERVICES_UTILITIES': 'utilities',
  'HOME_SERVICES_INTERNET_AND_CABLE': 'internet',

  // Transfer / income (skip)
  'TRANSFER_IN': '__skip__',
  'TRANSFER_OUT': '__skip__',
  'INCOME': '__skip__',
  'INCOME_WAGES': '__skip__',
}

function plaidCategoryToZerobased(
  personalFinanceCategory: string | null | undefined,
  plaidCategories: string[] | null | undefined
): string | null {
  // Try new personal_finance_category first (Plaid's detailed taxonomy)
  if (personalFinanceCategory) {
    const mapped = CATEGORY_MAP[personalFinanceCategory]
    if (mapped === '__skip__') return '__skip__'
    if (mapped) return mapped
  }

  // Fallback to legacy category array
  if (plaidCategories && plaidCategories.length > 0) {
    const joined = plaidCategories.join('_').toUpperCase()
    for (const [key, val] of Object.entries(CATEGORY_MAP)) {
      if (joined.includes(key) || key.includes(joined)) return val === '__skip__' ? null : val
    }
  }

  return null // uncategorized
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: corsHeaders,
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: corsHeaders,
      })
    }

    // Load user's budget categories so we can resolve label → id
    const { data: budgetCats } = await supabase
      .from('budget_categories')
      .select('id, label')
      .eq('user_id', user.id)

    const catIdByLabel: Record<string, string> = {}
    for (const c of (budgetCats ?? [])) {
      catIdByLabel[c.label.toLowerCase()] = c.id
    }

    // Map Plaid's account ids → the user's app account ids
    const { data: acctLinks } = await supabase
      .from('accounts')
      .select('id, plaid_account_id, plaid_accounts!inner(plaid_account_id)')
      .eq('user_id', user.id)
      .not('plaid_account_id', 'is', null)

    const appAcctByPlaidId: Record<string, string> = {}
    for (const a of (acctLinks ?? [])) {
      const pid = (a as any).plaid_accounts?.plaid_account_id
      if (pid) appAcctByPlaidId[pid] = a.id
    }

    // Fetch all plaid items for this user
    const { data: items } = await supabase
      .from('plaid_items')
      .select('id, item_id, access_token, cursor, institution_name')
      .eq('user_id', user.id)

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: 'No connected banks' }), {
        status: 200, headers: corsHeaders,
      })
    }

    let totalSynced = 0

    for (const item of items) {
      let cursor = item.cursor ?? null
      let hasMore = true

      while (hasMore) {
        const body: any = {
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          access_token: item.access_token,
          options: { include_personal_finance_category: true },
        }
        if (cursor) body.cursor = cursor

        const syncRes = await fetch(`${PLAID_BASE_URL[PLAID_ENV]}/transactions/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const syncData = await syncRes.json()
        if (!syncRes.ok) {
          console.error('Plaid sync error:', JSON.stringify(syncData))
          break
        }

        const added: any[] = syncData.added ?? []
        hasMore = syncData.has_more ?? false
        cursor = syncData.next_cursor

        // Insert new transactions (skip transfers and income)
        for (const txn of added) {
          const pfc = txn.personal_finance_category?.primary
            ? `${txn.personal_finance_category.primary}`
            : null

          const zbCategory = plaidCategoryToZerobased(pfc, txn.category)
          if (zbCategory === '__skip__') continue

          // Skip pending
          if (txn.pending) continue

          // Look up the budget category id from our mapping
          const categoryId = zbCategory ? catIdByLabel[zbCategory] ?? null : null

          const amount = Math.abs(txn.amount) // Plaid: positive = debit (expense)
          const isCredit = txn.amount < 0 // negative = credit (income or refund)

          await supabase.from('transactions').upsert({
            user_id: user.id,
            label: txn.merchant_name ?? txn.name ?? 'Bank transaction',
            amount,
            date: txn.date,
            type: isCredit ? 'income' : 'expense',
            category_id: isCredit ? null : categoryId,
            source: 'plaid',
            account_id: appAcctByPlaidId[txn.account_id] ?? null,
            plaid_transaction_id: txn.transaction_id,
            merchant_name: txn.merchant_name ?? null,
            pending: false,
          }, { onConflict: 'plaid_transaction_id', ignoreDuplicates: true })

          totalSynced++
        }
      }

      // Save the new cursor
      await supabase
        .from('plaid_items')
        .update({ cursor, last_synced_at: new Date().toISOString() })
        .eq('id', item.id)
    }

    return new Response(JSON.stringify({ synced: totalSynced }), {
      status: 200, headers: corsHeaders,
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders,
    })
  }
})
