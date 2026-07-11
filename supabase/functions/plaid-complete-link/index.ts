const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Not logged in' }, 401)

    const { link_token } = await req.json()
    if (!link_token) return json({ error: 'Missing link_token' })

    // Ask Plaid what happened in the Hosted Link session
    const env = Deno.env.get('PLAID_ENV') ?? 'sandbox'
    const res = await fetch(`https://${env}.plaid.com/link/token/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: Deno.env.get('PLAID_CLIENT_ID'),
        secret: Deno.env.get('PLAID_SECRET'),
        link_token,
      }),
    })
    const info = await res.json()

    const addResult = info.link_sessions?.[0]?.results?.item_add_results?.[0]
    if (!addResult?.public_token) {
      return json({ status: 'incomplete' }) // user cancelled or didn't finish
    }

    // Reuse the existing exchange function — public_token never touches the app
    const exchangeRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/plaid-exchange-token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          apikey: Deno.env.get('SUPABASE_ANON_KEY')!,
        },
        body: JSON.stringify({
          public_token: addResult.public_token,
          institution_id: addResult.institution?.institution_id ?? null,
          institution_name: addResult.institution?.name ?? null,
        }),
      },
    )
    if (!exchangeRes.ok) {
      const detail = await exchangeRes.text()
      console.error('Exchange failed:', detail)
      return json({ error: 'Exchange failed — check function logs' })
    }

    return json({ status: 'linked' })
  } catch (err) {
    console.error(err)
    return json({ error: String((err as Error)?.message ?? err) })
  }
})