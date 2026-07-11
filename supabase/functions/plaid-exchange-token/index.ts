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

    const { public_token, institution_id, institution_name } = await req.json()
    if (!public_token) {
      return new Response(JSON.stringify({ error: 'public_token required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Exchange public token for access token (server-side only — never expose to client)
    const exchangeRes = await fetch(`${PLAID_BASE_URL[PLAID_ENV]}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    })

    const exchangeData = await exchangeRes.json()
    if (!exchangeRes.ok) {
      return new Response(JSON.stringify({ error: exchangeData.error_message ?? 'Token exchange failed' }), {
        status: 500, headers: corsHeaders,
      })
    }

    const { access_token, item_id } = exchangeData

    // Reconnecting the same bank replaces the old connection instead of
    // stacking a new one. Plaid issues brand-new IDs on every fresh
    // connection, so without this you get duplicate accounts.
    if (institution_id) {
      const { data: oldItems } = await supabase
        .from('plaid_items')
        .select('id, access_token')
        .eq('user_id', user.id)
        .eq('institution_id', institution_id)
        .neq('item_id', item_id)

      for (const old of oldItems ?? []) {
        // Tell Plaid to retire the stale connection (stops billing too)
        await fetch(`${PLAID_BASE_URL[PLAID_ENV]}/item/remove`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            access_token: old.access_token,
          }),
        })

        // Unhook app accounts so they can re-match to the new connection below
        const { data: oldAccounts } = await supabase
          .from('plaid_accounts')
          .select('id')
          .eq('item_id', old.id)

        const oldIds = (oldAccounts ?? []).map((a: any) => a.id)
        if (oldIds.length > 0) {
          await supabase
            .from('accounts')
            .update({ plaid_account_id: null })
            .in('plaid_account_id', oldIds)
        }

        await supabase.from('plaid_accounts').delete().eq('item_id', old.id)
        await supabase.from('plaid_items').delete().eq('id', old.id)
      }
    }

    // Upsert plaid_items row (access_token never leaves this function)
    const { data: itemRow, error: itemError } = await supabase
      .from('plaid_items')
      .upsert({
        user_id: user.id,
        item_id,
        access_token,
        institution_id: institution_id ?? null,
        institution_name: institution_name ?? null,
      }, { onConflict: 'item_id' })
      .select('id')
      .single()

    if (itemError) {
      return new Response(JSON.stringify({ error: itemError.message }), {
        status: 500, headers: corsHeaders,
      })
    }

    // Connecting a bank switches the user's tracking method automatically
    await supabase
      .from('profiles')
      .update({ tracking_method: 'bank' })
      .eq('id', user.id)

    // Fetch accounts for this item
    const accountsRes = await fetch(`${PLAID_BASE_URL[PLAID_ENV]}/accounts/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token,
      }),
    })

    const accountsData = await accountsRes.json()
    if (accountsRes.ok && accountsData.accounts) {
      const rows = accountsData.accounts.map((a: any) => ({
        user_id: user.id,
        item_id: itemRow.id,
        plaid_account_id: a.account_id,
        name: a.name,
        official_name: a.official_name ?? null,
        type: a.type,
        subtype: a.subtype ?? null,
        balance_current: a.balances?.current ?? null,
        balance_available: a.balances?.available ?? null,
        currency_code: a.balances?.iso_currency_code ?? 'CAD',
        mask: a.mask ?? null,
      }))

      const { data: savedAccounts } = await supabase
        .from('plaid_accounts')
        .upsert(rows, { onConflict: 'plaid_account_id' })
        .select('id, name, mask, type, subtype, balance_current')

      // Mirror budget-relevant bank accounts into the app's accounts table.
      // Mortgages/investments stay out of the selector — they're not spending accounts.
      const budgetable = (savedAccounts ?? []).filter(
        (a: any) => a.type === 'depository' || a.type === 'credit'
      )

      if (budgetable.length > 0) {
        // Match against the user's existing app accounts by label, so a
        // reconnect reuses the same account (keeping its transaction
        // history) instead of creating a duplicate.
        const { data: existingAccounts } = await supabase
          .from('accounts')
          .select('id, label')
          .eq('user_id', user.id)

        const now = Date.now()
        let i = 0
        for (const a of budgetable as any[]) {
          const label = a.mask ? `${a.name} ····${a.mask}` : a.name
          const match = (existingAccounts ?? []).find((e: any) => e.label === label)

          if (match) {
            await supabase
              .from('accounts')
              .update({ plaid_account_id: a.id, balance: a.balance_current ?? 0 })
              .eq('id', match.id)
          } else {
            const prefix =
              a.type === 'credit' ? 'credit_card'
              : a.subtype === 'savings' ? 'savings'
              : 'chequing'
            await supabase.from('accounts').insert({
              user_id: user.id,
              plaid_account_id: a.id,
              label,
              type: `${prefix}_${now + i}`,   // matches your app's category_timestamp pattern
              balance: a.balance_current ?? 0,
            })
          }
          i++
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      institution_name: institution_name ?? null,
      account_count: accountsData.accounts?.length ?? 0,
    }), { status: 200, headers: corsHeaders })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders,
    })
  }
})
