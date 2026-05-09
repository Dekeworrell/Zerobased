import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = 'https://tkldjaqcovjdiwjpnphf.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// CAD prices — keep in sync with upgrade.tsx
const PLAN_PRICES: Record<string, number> = {
  monthly: 12.99,
  annual: 89.99,
}

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

    const { plan } = await req.json()  // 'monthly' | 'annual'
    if (!plan || !PLAN_PRICES[plan]) {
      return new Response(JSON.stringify({ error: 'plan must be monthly or annual' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Look up who referred this user
    const { data: profile } = await supabase
      .from('profiles')
      .select('referred_by')
      .eq('id', user.id)
      .single()

    if (!profile?.referred_by) {
      // No referral — nothing to track
      return new Response(JSON.stringify({ tracked: false, reason: 'no_referral' }), {
        status: 200, headers: corsHeaders,
      })
    }

    // Look up the affiliate
    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('id, commission_rate, status')
      .eq('referral_code', profile.referred_by)
      .maybeSingle()

    if (!affiliate || affiliate.status !== 'approved') {
      return new Response(JSON.stringify({ tracked: false, reason: 'affiliate_not_approved' }), {
        status: 200, headers: corsHeaders,
      })
    }

    // Check this user hasn't already generated a conversion for this affiliate
    const { data: existingConversion } = await supabase
      .from('affiliate_conversions')
      .select('id')
      .eq('affiliate_id', affiliate.id)
      .eq('subscriber_user_id', user.id)
      .maybeSingle()

    if (existingConversion) {
      return new Response(JSON.stringify({ tracked: false, reason: 'already_converted' }), {
        status: 200, headers: corsHeaders,
      })
    }

    const revenueAmount = PLAN_PRICES[plan]
    const commissionAmount = Math.round(revenueAmount * affiliate.commission_rate * 100) / 100

    const { data: conversion, error: convError } = await supabase
      .from('affiliate_conversions')
      .insert({
        affiliate_id: affiliate.id,
        subscriber_user_id: user.id,
        plan,
        revenue_amount: revenueAmount,
        commission_rate: affiliate.commission_rate,
        commission_amount: commissionAmount,
        status: 'pending',
      })
      .select('id, commission_amount')
      .single()

    if (convError) {
      return new Response(JSON.stringify({ error: convError.message }), {
        status: 500, headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({
      tracked: true,
      conversion_id: conversion.id,
      commission_amount: conversion.commission_amount,
    }), { status: 200, headers: corsHeaders })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders,
    })
  }
})
