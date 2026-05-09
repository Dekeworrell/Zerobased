import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = 'https://tkldjaqcovjdiwjpnphf.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? 'Dekeworrell@shaw.ca'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }

    // Decode JWT payload to get email — no network call needed
    const token = authHeader.replace('Bearer ', '')
    let userEmail = ''
    let jwtDebug = ''
    try {
      const parts = token.split('.')
      if (parts.length !== 3) throw new Error(`JWT has ${parts.length} parts, expected 3`)
      // Add padding so atob doesn't throw
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const padded = b64 + '='.repeat((4 - b64.length % 4) % 4)
      const payload = JSON.parse(atob(padded))
      userEmail = (payload.email ?? payload.sub ?? '').toLowerCase()
      jwtDebug = `email=${payload.email} sub=${payload.sub}`
    } catch (e: any) {
      return new Response(JSON.stringify({ error: `JWT decode failed: ${e.message}` }), {
        status: 401, headers: corsHeaders,
      })
    }
    if (!userEmail) {
      return new Response(JSON.stringify({ error: `No email in token. jwt=${jwtDebug}` }), {
        status: 401, headers: corsHeaders,
      })
    }

    // Admin gate
    if (userEmail !== ADMIN_EMAIL.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: corsHeaders,
      })
    }

    // DB client — uses the admin's JWT so RLS runs as the admin user.
    // The admin_select_affiliates policy (and siblings) grant full read access.
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Run all stats queries in parallel
    const [
      profilesRes,
      affiliatesRes,
      conversionsRes,
      payoutsRes,
      recentConversionsRes,
    ] = await Promise.all([
      // Subscriber tier breakdown — select ALL profiles (free tier may have null subscription_tier)
      supabase.from('profiles')
        .select('subscription_tier, subscription_source'),

      // All affiliates — raw fetch to PostgREST, bypassing supabase-js client layer
      fetch(`${SUPABASE_URL}/rest/v1/affiliates?select=id,name,email,referral_code,status,tier,commission_rate,applied_at,approved_at,stripe_account_id&order=applied_at.desc`, {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }).then(r => r.json()).then(data => ({ data: Array.isArray(data) ? data : [], error: Array.isArray(data) ? null : data })),

      // Aggregate conversion stats per affiliate
      supabase.from('affiliate_conversions')
        .select('affiliate_id, commission_amount, revenue_amount, status, plan, converted_at'),

      // Aggregate payout stats
      supabase.from('affiliate_payouts')
        .select('affiliate_id, amount, status'),

      // Recent 20 conversions with affiliate name
      supabase.from('affiliate_conversions')
        .select('id, affiliate_id, plan, revenue_amount, commission_amount, status, converted_at, affiliates(name, referral_code)')
        .order('converted_at', { ascending: false })
        .limit(20),
    ])

    // Subscriber counts
    const profiles = profilesRes.data ?? []
    const freeCount = profiles.filter(p => !p.subscription_tier || p.subscription_tier === 'free').length
    const proCount = profiles.filter(p => p.subscription_tier === 'pro').length
    const proRevenueCatCount = profiles.filter(p => p.subscription_tier === 'pro' && p.subscription_source === 'revenuecat').length

    // MRR estimate (rough — monthly + annual/12)
    // We don't have plan details per user here, so estimate from conversion data
    const conversions = conversionsRes.data ?? []
    const activeMonthly = conversions.filter(c => c.plan === 'monthly' && c.status !== 'refunded').length
    const activeAnnual = conversions.filter(c => c.plan === 'annual' && c.status !== 'refunded').length
    const estimatedMRR = (activeMonthly * 12.99) + (activeAnnual * 89.99 / 12)

    // Affiliate stats roll-up
    const payouts = payoutsRes.data ?? []
    const affiliates = (affiliatesRes.data ?? []).map(aff => {
      const affConversions = conversions.filter(c => c.affiliate_id === aff.id)
      const affPayouts = payouts.filter(p => p.affiliate_id === aff.id)
      const clicks = 0 // would need a count query — omitted for speed; show in detail view
      const totalEarned = affConversions.reduce((s, c) => s + Number(c.commission_amount), 0)
      const totalPaid = affPayouts.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
      const pendingPayout = totalEarned - totalPaid

      return {
        ...aff,
        total_conversions: affConversions.length,
        total_earned: Math.round(totalEarned * 100) / 100,
        total_paid: Math.round(totalPaid * 100) / 100,
        pending_payout: Math.round(pendingPayout * 100) / 100,
      }
    })

    return new Response(JSON.stringify({
      subscribers: { free: freeCount, pro: proCount, pro_revenuecat: proRevenueCatCount, total: profiles.length },
      mrr: Math.round(estimatedMRR * 100) / 100,
      affiliates,
      recent_conversions: recentConversionsRes.data ?? [],
      total_commissions_pending: affiliates.reduce((s, a) => s + a.pending_payout, 0),
      // Debug: surface any query errors so the admin UI can display them
      _debug: {
        affiliates_error: affiliatesRes.error?.message ?? null,
        affiliates_count: affiliatesRes.data?.length ?? -1,
        profiles_error: profilesRes.error?.message ?? null,
        conversions_error: conversionsRes.error?.message ?? null,
        payouts_error: payoutsRes.error?.message ?? null,
        recent_conv_error: recentConversionsRes.error?.message ?? null,
        srk_len: SERVICE_ROLE_KEY.length,
      },
    }), { status: 200, headers: corsHeaders })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders,
    })
  }
})
