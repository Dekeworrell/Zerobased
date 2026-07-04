import { createClient } from 'jsr:@supabase/supabase-js@2'

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
    // Identify the logged-in user from the request's JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Not logged in' }, 401)

    const env = Deno.env.get('PLAID_ENV') ?? 'sandbox'
    const res = await fetch(`https://${env}.plaid.com/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: Deno.env.get('PLAID_CLIENT_ID'),
        secret: Deno.env.get('PLAID_SECRET'),
        client_name: 'Zerobased',
        user: { client_user_id: user.id },
        products: ['transactions'],
        country_codes: ['CA'],
        language: 'en',
        redirect_uri: 'https://zerobased.ca/connect-bank',
        hosted_link: {
          completion_redirect_uri: 'zerobased://plaid-done',
          is_mobile_app: true,
          url_lifetime_seconds: 900,
        },
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Plaid link/token/create error:', JSON.stringify(data))
      return json({ error: data.error_message ?? 'Plaid /link/token/create failed' })
    }

    return json({ link_token: data.link_token, hosted_link_url: data.hosted_link_url })
  } catch (err) {
    console.error(err)
    return json({ error: String((err as Error)?.message ?? err) })
  }
})