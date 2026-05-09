import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = 'https://tkldjaqcovjdiwjpnphf.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { referral_code } = await req.json()
    if (!referral_code) {
      return new Response(JSON.stringify({ error: 'referral_code required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Only track clicks for approved affiliates
    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('id')
      .eq('referral_code', referral_code.trim().toUpperCase())
      .eq('status', 'approved')
      .maybeSingle()

    if (!affiliate) {
      return new Response(JSON.stringify({ tracked: false }), { status: 200, headers: corsHeaders })
    }

    // Hash IP + date so we get daily unique visitors without storing raw IPs
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const today = new Date().toISOString().slice(0, 10)
    const ipHash = await sha256(`${ip}:${today}`)

    const { data: click } = await supabase
      .from('affiliate_clicks')
      .insert({
        affiliate_id: affiliate.id,
        ip_hash: ipHash,
        user_agent: req.headers.get('user-agent') ?? null,
      })
      .select('id')
      .single()

    return new Response(JSON.stringify({ tracked: true, click_id: click?.id ?? null }), {
      status: 200, headers: corsHeaders,
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders,
    })
  }
})
