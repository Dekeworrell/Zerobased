import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

serve(async (req) => {
  const payload = await req.json();
  
  // Handle both direct record and nested record formats
  const record = payload.record ?? payload;

  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get("SMTP_HOST")!,
      port: 465,
      tls: true,
      auth: {
        username: Deno.env.get("SMTP_USER")!,
        password: Deno.env.get("SMTP_PASS")!,
      },
    },
  });

  await client.send({
    from: "Zerobased App <support@zerobased.ca>",
    to: "support@zerobased.ca",
    subject: "📬 New Zerobased Feedback",
    content: `
New feedback submitted in Zerobased:

Type: ${record.type}
Message: ${record.message}
User ID: ${record.user_id}
Submitted: ${record.created_at}
    `.trim(),
  });

  await client.close();

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});