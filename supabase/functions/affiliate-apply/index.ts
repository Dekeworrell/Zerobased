import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = 'https://tkldjaqcovjdiwjpnphf.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
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

    const { name, referral_code, platform_url, audience_size } = await req.json()

    if (!name?.trim() || !referral_code?.trim()) {
      return new Response(JSON.stringify({ error: 'name and referral_code are required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Validate referral code format: 3-15 alphanumeric chars, uppercase
    const code = referral_code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (code.length < 3 || code.length > 15) {
      return new Response(JSON.stringify({ error: 'Referral code must be 3-15 letters/numbers' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Check if code is already taken
    const { data: existing } = await supabase
      .from('affiliates')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ error: 'That referral code is already taken. Try another.' }), {
        status: 409, headers: corsHeaders,
      })
    }

    // Check if this user already has an application
    const { data: existingApp } = await supabase
      .from('affiliates')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingApp) {
      return new Response(JSON.stringify({
        error: `You already have an application (status: ${existingApp.status})`,
      }), { status: 409, headers: corsHeaders })
    }

    // Determine commission tier by audience size
    const size = parseInt(audience_size) || 0
    let tier = 'standard'
    let commission_rate = 0.20
    if (size >= 50000) { tier = 'creator'; commission_rate = 0.25 }

    const { data: affiliate, error: insertError } = await supabase
      .from('affiliates')
      .insert({
        user_id: user.id,
        name: name.trim(),
        email: user.email,
        referral_code: code,
        tier,
        commission_rate,
        notes: platform_url ? `Platform: ${platform_url}. Audience: ${audience_size || 'not specified'}` : null,
      })
      .select('id, referral_code, status, tier, commission_rate')
      .single()

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500, headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ affiliate }), { status: 200, headers: corsHeaders })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders,
    })
  }
})
