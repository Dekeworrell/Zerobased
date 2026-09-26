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
// Map Plaid's DETAILED personal finance categories → Zerobased category NAMES.
// Names are matched against the household's active budget categories
// (capitals, spaces and underscores ignored). No match → uncategorized.
// Verified against Plaid's category list (pfc-taxonomy-all.csv), Sep 24, 2026.
// ----------------------------------------------------------------
const CATEGORY_MAP: Record<string, string> = {
  // Food & drink
  FOOD_AND_DRINK_GROCERIES: 'groceries',
  FOOD_AND_DRINK_RESTAURANT: 'dining out',
  FOOD_AND_DRINK_FAST_FOOD: 'dining out',
  FOOD_AND_DRINK_COFFEE: 'dining out',
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: 'entertainment',

  // Transportation
  TRANSPORTATION_GAS: 'fuel',
  TRANSPORTATION_PARKING: 'transport',
  TRANSPORTATION_PUBLIC_TRANSIT: 'transport',
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: 'transport',
  TRANSPORTATION_TOLLS: 'transport',
  TRAVEL_RENTAL_CARS: 'transport',
  GENERAL_SERVICES_AUTOMOTIVE: 'vehicle maintenance',

  // Loan payments → matching fixed expense
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: 'mortgage/rent',
  LOAN_PAYMENTS_CAR_PAYMENT: 'car loan',
  LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT: 'student loan',

  // Entertainment & travel
  ENTERTAINMENT_MUSIC_AND_AUDIO: 'entertainment',
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: 'entertainment',
  ENTERTAINMENT_TV_AND_MOVIES: 'entertainment',
  ENTERTAINMENT_VIDEO_GAMES: 'entertainment',
  ENTERTAINMENT_OTHER_ENTERTAINMENT: 'entertainment',
  TRAVEL_FLIGHTS: 'entertainment',
  TRAVEL_LODGING: 'entertainment',

  // Shopping
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: 'clothing',
  GENERAL_MERCHANDISE_SPORTING_GOODS: 'sports',
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: 'education',
  GENERAL_MERCHANDISE_PET_SUPPLIES: 'pets',
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: 'other',
  HOME_IMPROVEMENT_HARDWARE: 'other',
  HOME_IMPROVEMENT_FURNITURE: 'other',

  // Health & personal care
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: 'health',
  MEDICAL_DENTAL_CARE: 'health',
  MEDICAL_EYE_CARE: 'health',
  MEDICAL_PRIMARY_CARE: 'health',
  MEDICAL_OTHER_MEDICAL: 'health',
  MEDICAL_VETERINARY_SERVICES: 'pets',
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: 'fitness',
  PERSONAL_CARE_HAIR_AND_BEAUTY: 'other',

  // Services
  GENERAL_SERVICES_EDUCATION: 'education',
  GENERAL_SERVICES_CHILDCARE: 'childcare',

  // Bills & utilities
  RENT_AND_UTILITIES_RENT: 'mortgage/rent',
  RENT_AND_UTILITIES_TELEPHONE: 'phone',
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: 'internet',
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: 'utilities',
  RENT_AND_UTILITIES_OTHER_UTILITIES: 'utilities',
  RENT_AND_UTILITIES_WATER: 'water & sewer',
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: 'water & sewer',
}

// Money moving in or out that isn't spending: skipped entirely (same as before)
const SKIP_PRIMARY = ['TRANSFER_IN', 'TRANSFER_OUT', 'INCOME']

// Paying off a credit card isn't new spending (the card purchases were), so skip it
const SKIP_DETAILED = ['LOAN_PAYMENTS_CREDIT_CARD_PAYMENT']

function normalizeLabel(s: string): string {
  return s.toLowerCase().replace(/[_\s]+/g, ' ').trim()
}

function plaidCategoryToZerobased(
  primary: string | null | undefined,
  detailed: string | null | undefined
): string | null {
  if (primary && SKIP_PRIMARY.includes(primary)) return '__skip__'
  if (detailed && SKIP_DETAILED.includes(detailed)) return '__skip__'
  if (detailed && CATEGORY_MAP[detailed]) return CATEGORY_MAP[detailed]
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

    // Household members share one budget, so match against everyone's active categories
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .single()

    let memberIds: string[] = [user.id]
    if (myProfile?.household_id) {
      const { data: members } = await supabase
        .from('profiles')
        .select('id')
        .eq('household_id', myProfile.household_id)
      if (members && members.length > 0) memberIds = members.map((m: any) => m.id)
    }

    const { data: budgetCats } = await supabase
      .from('budget_categories')
      .select('id, label')
      .in('user_id', memberIds)
      .is('archived_at', null)
      .order('sort_order', { ascending: true })

    // Name → category id. If two categories share a name, the first in budget order wins.
    const catIdByLabel: Record<string, string> = {}
    for (const c of (budgetCats ?? [])) {
      const key = normalizeLabel(c.label)
      if (!catIdByLabel[key]) catIdByLabel[key] = c.id
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
      let syncFailed = false

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
          if (syncData?.error_code === 'ITEM_LOGIN_REQUIRED') {
            await supabase.from('plaid_items').update({ needs_reconnect: true }).eq('id', item.id)
          }
          syncFailed = true
          break
        }

        const added: any[] = syncData.added ?? []
        hasMore = syncData.has_more ?? false
        cursor = syncData.next_cursor

        console.log('Plaid sync page:', JSON.stringify({
          institution: item.institution_name,
          added: (syncData.added ?? []).length,
          modified: (syncData.modified ?? []).length,
          removed: (syncData.removed ?? []).length,
          has_more: syncData.has_more,
        }))

        // Insert new transactions (skip transfers and income)
        for (const txn of added) {
          const pfcPrimary = txn.personal_finance_category?.primary ?? null
          const pfcDetailed = txn.personal_finance_category?.detailed ?? null

          const zbCategory = plaidCategoryToZerobased(pfcPrimary, pfcDetailed)
          if (zbCategory === '__skip__') continue

          // Skip pending
          if (txn.pending) continue

          // Look up the budget category id from our mapping
          const categoryId = zbCategory ? catIdByLabel[normalizeLabel(zbCategory)] ?? null : null

          // Temporary check (Sep 2026): shows in the function logs what the bank sent and whether it matched
          console.log('Category match:', JSON.stringify({ primary: pfcPrimary, detailed: pfcDetailed, mappedTo: zbCategory, matched: !!categoryId }))

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

      // Save the new cursor and clear any reconnect flag — only if sync succeeded
      if (!syncFailed) {
        await supabase
          .from('plaid_items')
          .update({ cursor, last_synced_at: new Date().toISOString(), needs_reconnect: false })
          .eq('id', item.id)
      }
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
