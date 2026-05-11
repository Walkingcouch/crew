import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')    ?? '';
const NOTIFY_EMAIL   = Deno.env.get('NOTIFY_EMAIL')      ?? '';
const EMAIL_FROM     = Deno.env.get('EMAIL_FROM')        ?? 'hello@getcrew.com.au';
const APP_URL        = Deno.env.get('APP_URL')           ?? 'https://getcrew.au';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')      ?? '';
const SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? '';

const OUTCOME_META: Record<string, { emoji: string; label: string; color: string; urgent: boolean }> = {
  otp_sent:     { emoji: '📨', label: 'OTP code sent',          color: '#2d8055', urgent: false },
  blocked_beta: { emoji: '🚫', label: 'BLOCKED — not on list',  color: '#c0392b', urgent: true  },
  verified:     { emoji: '✅', label: 'Signed in successfully', color: '#1a4d33', urgent: false },
  failed_otp:   { emoji: '⚠️', label: 'Wrong OTP code entered', color: '#e67e22', urgent: true  },
  signout:      { emoji: '👋', label: 'Signed out',             color: '#7f8c8d', urgent: false },
};

function buildEmailHtml(data: {
  email: string;
  outcome: string;
  ip: string;
  userAgent: string;
  timestamp: string;
  appUrl: string;
}): string {
  const meta = OUTCOME_META[data.outcome] ?? { emoji: '❓', label: data.outcome, color: '#231f1a', urgent: false };
  const deviceInfo = parseUserAgent(data.userAgent);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Crew Login Alert</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f4f0;color:#231f1a}
  .wrap{max-width:520px;margin:0 auto;padding:28px 16px}
  .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);${meta.urgent ? 'border:2px solid ' + meta.color : ''}}
  .header{background:#1a4d33;padding:24px 32px}
  .logo{font-size:18px;font-weight:800;color:#fff;letter-spacing:-.03em}
  .logo span{color:#4db37c}
  .logo-sub{font-size:11px;color:rgba(255,255,255,.6);margin-top:2px}
  .alert-bar{background:${meta.color};padding:14px 32px;display:flex;align-items:center;gap:10px}
  .alert-bar .emoji{font-size:20px}
  .alert-bar .label{font-size:14px;font-weight:700;color:#fff}
  .body{padding:28px 32px}
  .row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f0ece8}
  .row:last-child{border-bottom:none}
  .rl{font-size:12px;color:#8a8480}
  .rv{font-size:12px;font-weight:600;color:#231f1a;text-align:right;max-width:280px;word-break:break-all}
  .footer{font-size:11px;color:#b0acaa;text-align:center;padding:20px 32px;border-top:1px solid #f0ece8;line-height:1.7}
  .footer a{color:#2d8055}
</style>
</head>
<body>
<div class="wrap"><div class="card">
  <div class="header">
    <div class="logo">CREW<span>.</span></div>
    <div class="logo-sub">Login activity alert</div>
  </div>
  <div class="alert-bar">
    <span class="emoji">${meta.emoji}</span>
    <span class="label">${meta.label}</span>
  </div>
  <div class="body">
    <div class="row"><span class="rl">Email</span><span class="rv">${data.email}</span></div>
    <div class="row"><span class="rl">Time</span><span class="rv">${data.timestamp}</span></div>
    <div class="row"><span class="rl">IP address</span><span class="rv">${data.ip || 'Unknown'}</span></div>
    <div class="row"><span class="rl">Device</span><span class="rv">${deviceInfo}</span></div>
    <div class="row"><span class="rl">Outcome</span><span class="rv" style="color:${meta.color}">${meta.emoji} ${meta.label}</span></div>
    ${meta.urgent ? `
    <div style="background:#fff5f5;border:1px solid ${meta.color}33;border-radius:10px;padding:14px;margin-top:16px">
      <div style="font-size:12px;font-weight:700;color:${meta.color};margin-bottom:4px">Action may be required</div>
      <div style="font-size:12px;color:#6b6460;line-height:1.6">
        ${data.outcome === 'blocked_beta'
          ? 'Someone tried to access your app but their email is not on the beta allowlist. If you know this person, add them via Supabase.'
          : 'Multiple failed OTP attempts may indicate someone is trying to access your account. If this was not you, your account is safe — the OTP expires quickly.'}
      </div>
    </div>` : ''}
  </div>
  <div class="footer">
    This alert was sent because you are the owner of <a href="${data.appUrl}">${data.appUrl.replace('https://', '')}</a><br>
    <a href="${data.appUrl}/auth.html">Sign in to Crew</a>
  </div>
</div></div>
</body></html>`;
}

function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown device';
  let browser = 'Unknown browser';
  let os = 'Unknown OS';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Mac OS')) os = 'Mac';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';
  return `${browser} on ${os}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  const { email = 'unknown', outcome = 'otp_sent', userAgent = req.headers.get('user-agent') ?? '', note = '' } = body;

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'Unknown';

  const timestamp = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  if (SUPABASE_URL && SERVICE_KEY) {
    try {
      const db = createClient(SUPABASE_URL, SERVICE_KEY);
      await db.from('login_attempts').insert({
        email: email.toLowerCase(),
        outcome,
        ip_address: ip,
        user_agent: userAgent,
        note,
      });
    } catch (e) {
      console.error('DB log failed:', e);
    }
  }

  if (!RESEND_API_KEY || !NOTIFY_EMAIL) {
    return new Response(JSON.stringify({ success: true, email_sent: false, reason: 'No keys set' }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (outcome === 'signout') {
    return new Response(JSON.stringify({ success: true, email_sent: false, reason: 'Signout — no alert' }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const meta = OUTCOME_META[outcome] ?? { emoji: '❓', label: outcome, urgent: false };
  const subject = `${meta.emoji} Crew login ${meta.urgent ? '⚠️ ALERT' : 'activity'} — ${email}`;

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: `Crew Security <${EMAIL_FROM}>`,
      to: [NOTIFY_EMAIL],
      subject,
      html: buildEmailHtml({ email, outcome, ip, userAgent, timestamp, appUrl: APP_URL }),
    }),
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    console.error('Resend error:', err);
    return new Response(JSON.stringify({ success: true, email_sent: false, error: err }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const result = await emailRes.json();
  return new Response(JSON.stringify({ success: true, email_sent: true, id: result.id }), {
    status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
});