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

      await supabase
        .from('plaid_accounts')
        .upsert(rows, { onConflict: 'plaid_account_id' })
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
