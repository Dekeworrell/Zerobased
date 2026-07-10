import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = 'https://tkldjaqcovjdiwjpnphf.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Zerobased <onboarding@resend.dev>'

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

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: corsHeaders,
      })
    }

    const { invited_email, inviter_name } = await req.json()
    if (!invited_email) {
      return new Response(JSON.stringify({ error: 'invited_email is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const senderName = inviter_name || user.email || 'Someone'

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f2f4f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f2;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e3e8e3;overflow:hidden;">
          <tr>
            <td style="background:#3db870;padding:32px;text-align:center;">
              <div style="font-size:40px;margin-bottom:8px;">💰</div>
              <div style="font-size:22px;font-weight:700;color:#ffffff;">Zerobased</div>
              <div style="font-size:14px;color:#d9f2e3;margin-top:4px;">Zero-based budgeting, together</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">You've been invited! 🎉</h2>
              <p style="margin:0 0 24px;font-size:15px;color:#4a4a4a;line-height:1.6;">
                <strong>${senderName}</strong> has invited you to share their Zerobased budget.
                Once you accept, you'll both see the same dashboard, transactions, and spending — in real time.
              </p>
              <div style="text-align:center;margin-bottom:24px;">
                <a href="https://apps.apple.com/app/id6761318306" style="display:inline-block;background:#3db870;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;">
                  Get Zerobased
                </a>
              </div>
              <div style="background:#f2f4f2;border:1px solid #e3e8e3;border-radius:12px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:13px;color:#6b6b6b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">How to accept</p>
                <ol style="margin:0;padding-left:20px;font-size:14px;color:#4a4a4a;line-height:1.8;">
                  <li>Tap <strong>Get Zerobased</strong> above to download the app</li>
                  <li>Sign up or log in with this email address</li>
                  <li>Open <strong>Settings → Household</strong></li>
                  <li>Tap <strong>Accept Invite</strong></li>
                </ol>
              </div>
              <p style="margin:0;font-size:13px;color:#9a9a9a;line-height:1.5;">
                If you weren't expecting this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e3e8e3;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9a9a9a;">Zerobased — zero-based budgeting made simple</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [invited_email],
        subject: `${senderName} invited you to share their budget on Zerobased`,
        html: emailHtml,
      }),
    })

    const resData = await res.json()

    if (!res.ok) {
      return new Response(JSON.stringify({ error: resData }), {
        status: 500, headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ sent: true, id: resData.id }), {
      status: 200, headers: corsHeaders,
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders,
    })
  }
})
