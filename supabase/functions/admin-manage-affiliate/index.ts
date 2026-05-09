import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = 'https://tkldjaqcovjdiwjpnphf.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? 'Dekeworrell@shaw.ca'
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }

    // Decode JWT to get email without a network round-trip
    const token = authHeader.replace('Bearer ', '')
    let userEmail = ''
    try {
      const [, b64] = token.split('.')
      const payload = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')))
      userEmail = (payload.email ?? '').toLowerCase()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid token format' }), {
        status: 401, headers: corsHeaders,
      })
    }
    if (!userEmail) {
      return new Response(JSON.stringify({ error: 'No email in token' }), {
        status: 401, headers: corsHeaders,
      })
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (userEmail !== ADMIN_EMAIL.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: corsHeaders,
      })
    }

    const { action, affiliate_id, ...payload } = await req.json()

    if (!affiliate_id) {
      return new Response(JSON.stringify({ error: 'affiliate_id required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // ── approve ──────────────────────────────────────────────────────────────
    if (action === 'approve') {
      const updates: any = {
        status: 'approved',
        approved_at: new Date().toISOString(),
      }
      if (payload.commission_rate) updates.commission_rate = payload.commission_rate
      if (payload.tier) updates.tier = payload.tier

      const { data, error } = await supabase
        .from('affiliates')
        .update(updates)
        .eq('id', affiliate_id)
        .select('id, name, email, referral_code, tier, commission_rate, status')
        .single()

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
      return new Response(JSON.stringify({ affiliate: data }), { status: 200, headers: corsHeaders })
    }

    // ── reject ───────────────────────────────────────────────────────────────
    if (action === 'reject') {
      const { data, error } = await supabase
        .from('affiliates')
        .update({ status: 'rejected', notes: payload.reason ?? null })
        .eq('id', affiliate_id)
        .select('id, status')
        .single()

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
      return new Response(JSON.stringify({ affiliate: data }), { status: 200, headers: corsHeaders })
    }

    // ── update_commission ─────────────────────────────────────────────────────
    if (action === 'update_commission') {
      const rate = parseFloat(payload.commission_rate)
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return new Response(JSON.stringify({ error: 'commission_rate must be 0–1 (e.g. 0.25 for 25%)' }), {
          status: 400, headers: corsHeaders,
        })
      }
      const { data, error } = await supabase
        .from('affiliates')
        .update({ commission_rate: rate, tier: payload.tier ?? undefined })
        .eq('id', affiliate_id)
        .select('id, commission_rate, tier')
        .single()

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
      return new Response(JSON.stringify({ affiliate: data }), { status: 200, headers: corsHeaders })
    }

    // ── payout ────────────────────────────────────────────────────────────────
    // Creates a payout record and (if Stripe key present) triggers a Connect transfer
    if (action === 'payout') {
      const amount = parseFloat(payload.amount)
      if (isNaN(amount) || amount <= 0) {
        return new Response(JSON.stringify({ error: 'amount must be a positive number (CAD)' }), {
          status: 400, headers: corsHeaders,
        })
      }

      const { data: aff } = await supabase
        .from('affiliates')
        .select('stripe_account_id')
        .eq('id', affiliate_id)
        .single()

      let stripeTransferId: string | null = null

      if (STRIPE_SECRET_KEY && aff?.stripe_account_id) {
        // Trigger Stripe Connect transfer (amount in cents)
        const stripeRes = await fetch('https://api.stripe.com/v1/transfers', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            amount: Math.round(amount * 100).toString(),
            currency: 'cad',
            destination: aff.stripe_account_id,
            description: `Zerobased affiliate payout`,
          }).toString(),
        })
        const stripeData = await stripeRes.json()
        if (stripeRes.ok) stripeTransferId = stripeData.id
      }

      // Mark pending conversions as paid
      const { data: pendingConversions } = await supabase
        .from('affiliate_conversions')
        .select('id')
        .eq('affiliate_id', affiliate_id)
        .eq('status', 'pending')

      const { data: payout, error: payoutError } = await supabase
        .from('affiliate_payouts')
        .insert({
          affiliate_id,
          amount,
          status: stripeTransferId ? 'paid' : 'pending',
          stripe_transfer_id: stripeTransferId,
          paid_at: stripeTransferId ? new Date().toISOString() : null,
        })
        .select('id')
        .single()

      if (payoutError) return new Response(JSON.stringify({ error: payoutError.message }), { status: 500, headers: corsHeaders })

      // Link conversions to this payout
      if (pendingConversions && pendingConversions.length > 0) {
        await supabase
          .from('affiliate_conversions')
          .update({ status: 'paid', payout_id: payout.id })
          .in('id', pendingConversions.map((c: any) => c.id))
      }

      return new Response(JSON.stringify({
        payout_id: payout.id,
        stripe_transfer_id: stripeTransferId,
        conversions_paid: pendingConversions?.length ?? 0,
      }), { status: 200, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: corsHeaders,
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders,
    })
  }
})
