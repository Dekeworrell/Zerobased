import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const SUPABASE_URL = 'https://tkldjaqcovjdiwjpnphf.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID') ?? ''
const PLAID_SECRET = Deno.env.get('PLAID_SECRET') ?? ''
const PLAID_ENV = Deno.env.get('PLAID_ENV') ?? 'sandbox'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No authorization header' }, 401)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Invalid token' }, 401)

    const { bank_id } = await req.json() // plaid_items.id shown in the app
    if (!bank_id) return json({ error: 'bank_id required' })

    // Ownership check — user can only disconnect their own bank
    const { data: item } = await supabase
      .from('plaid_items')
      .select('id, access_token')
      .eq('id', bank_id)
      .eq('user_id', user.id)
      .single()

    if (!item) return json({ error: 'Bank connection not found' }, 404)

    // Tell Plaid to revoke access + stop billing for this item
    const removeRes = await fetch(`https://${PLAID_ENV}.plaid.com/item/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: item.access_token,
      }),
    })
    if (!removeRes.ok) {
      const detail = await removeRes.json()
      console.error('Plaid /item/remove failed:', JSON.stringify(detail))
      // Continue anyway — better to remove our records than leave the user stuck.
      // The orphaned item can be cleaned up in the Plaid dashboard.
    }

    // Delete our records: plaid_accounts cascades away,
    // accounts.plaid_account_id becomes null (app accounts + transactions survive)
    const { error: delError } = await supabase
      .from('plaid_items')
      .delete()
      .eq('id', item.id)

    if (delError) return json({ error: delError.message })

    return json({ status: 'disconnected' })
  } catch (err) {
    console.error(err)
    return json({ error: String((err as Error)?.message ?? err) })
  }
})