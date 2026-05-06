import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = 'https://tkldjaqcovjdiwjpnphf.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Identify the invitee from their JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    // Get the invitee's household_id
    const { data: inviteeProfile } = await supabaseAdmin
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .single()

    if (!inviteeProfile?.household_id) {
      return new Response(JSON.stringify({ error: 'No household found' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Find the other household member's push token (the inviter)
    const { data: otherMembers } = await supabaseAdmin
      .from('profiles')
      .select('push_token, name')
      .eq('household_id', inviteeProfile.household_id)
      .neq('id', user.id)
      .not('push_token', 'is', null)

    if (!otherMembers || otherMembers.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: 'No push token found for inviter' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    const inviteeName = user.email ?? 'Your partner'

    const messages = otherMembers
      .filter((m: any) => m.push_token)
      .map((m: any) => ({
        to: m.push_token,
        title: '🎉 Invite accepted!',
        body: `${inviteeName} has joined your household budget.`,
        sound: 'default',
      }))

    if (messages.length === 0) {
      return new Response(JSON.stringify({ sent: false }), { status: 200, headers: corsHeaders })
    }

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    })

    const expoData = await expoRes.json()

    return new Response(JSON.stringify({ sent: true, expo: expoData }), {
      status: 200,
      headers: corsHeaders,
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
