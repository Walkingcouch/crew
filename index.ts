/**
 * Supabase Edge Function: send-report-email
 *
 * Triggered when a community report is inserted into the `community_reports` table.
 * Sends the lead-gen email to the relevant council/organisation.
 *
 * Deploy:
 *   supabase functions deploy send-report-email --no-verify-jwt
 *
 * Set secrets:
 *   supabase secrets set RESEND_API_KEY=re_xxxx
 *   supabase secrets set EMAIL_FROM=hello@getcrew.com.au
 *   supabase secrets set APP_URL=https://yourcustomdomain.com.au
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM     = Deno.env.get('EMAIL_FROM')     ?? 'hello@getcrew.com.au';
const APP_URL        = Deno.env.get('APP_URL')        ?? 'https://getcrew.com.au';

/* ── Report email template ─────────────────────────────────────── */
function buildHtml(report: {
  ref: string;
  issue_type: string;
  location: string;
  severity: string;
  timestamp: string;
  org_name: string;
  org_slug: string;
}): string {
  const trialLink = `${APP_URL}/auth.html?trial=7day&ref=${encodeURIComponent(report.ref)}&org=${encodeURIComponent(report.org_slug)}&utm_source=report_lead_gen`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CrewBase Local Report Available — Start Your Free Trial</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f4f0;color:#231f1a}
  .wrap{max-width:600px;margin:0 auto;padding:32px 16px}
  .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)}
  .header{background:#1a4d33;padding:36px 40px}
  .logo{font-size:22px;font-weight:800;color:#fff;letter-spacing:-.03em;margin-bottom:4px}
  .logo span{color:#4db37c}
  .logo-sub{font-size:13px;color:rgba(255,255,255,.65)}
  .body{padding:36px 40px}
  h1{font-size:22px;font-weight:700;color:#1a4d33;letter-spacing:-.02em;margin-bottom:8px;line-height:1.3}
  .lead{font-size:14px;color:#6b6460;line-height:1.7;margin-bottom:24px}
  .report-card{background:#f7faf8;border:1px solid #c8e6d4;border-radius:12px;padding:16px 20px;margin-bottom:24px}
  .report-card-title{font-size:11px;font-weight:700;color:#2d8055;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px}
  .report-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e4ede8}
  .report-row:last-child{border-bottom:none}
  .report-label{font-size:12px;color:#8a8480}
  .report-value{font-size:12px;font-weight:600;color:#231f1a}
  .cta-box{background:#1a4d33;border-radius:12px;padding:28px 32px;text-align:center;margin-bottom:28px}
  .cta-box h2{font-size:18px;font-weight:700;color:#fff;margin-bottom:6px}
  .cta-box p{font-size:13px;color:rgba(255,255,255,.7);margin-bottom:20px;line-height:1.6}
  .cta-btn{display:inline-block;background:#4db37c;color:#fff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:50px;text-decoration:none}
  .footer-note{font-size:11px;color:#b0acaa;text-align:center;line-height:1.7}
  .footer-note a{color:#2d8055}
  .divider{height:1px;background:#f0ece8;margin:24px 0}
</style>
</head>
<body>
<div class="wrap"><div class="card">
  <div class="header">
    <div class="logo">CREW<span>BASE</span></div>
    <div class="logo-sub">Community operations platform</div>
  </div>
  <div class="body">
    <h1>A Crew App user has reported an issue in your area</h1>
    <p class="lead">A member of the public used the Crew App to report an issue that falls within your organisation's jurisdiction. Start a free 7-day CrewBase trial to receive, manage, and resolve this report — and every one that follows.</p>
    <div class="report-card">
      <div class="report-card-title">📍 Community report summary</div>
      <div class="report-row"><span class="report-label">Reference</span><span class="report-value">${report.ref}</span></div>
      <div class="report-row"><span class="report-label">Issue type</span><span class="report-value">${report.issue_type}</span></div>
      <div class="report-row"><span class="report-label">Location</span><span class="report-value">${report.location}</span></div>
      <div class="report-row"><span class="report-label">Severity</span><span class="report-value">${report.severity}</span></div>
      <div class="report-row"><span class="report-label">Submitted</span><span class="report-value">${report.timestamp}</span></div>
      <div class="report-row"><span class="report-label">Photo attached</span><span class="report-value">Yes · GPS pinned</span></div>
      <div class="report-row"><span class="report-label">Status</span><span class="report-value" style="color:#2d8055">⏳ Awaiting solver</span></div>
    </div>
    <div class="cta-box">
      <h2>Start your free 7-day trial</h2>
      <p>Claim this report and unlock full CrewBase access. No credit card. No obligation.</p>
      <a href="${trialLink}" class="cta-btn">Start Free Trial →</a>
    </div>
    <div class="divider"></div>
    <p class="footer-note">
      This report was submitted by a Crew App user and stored securely by Crew Pty Ltd.<br>
      Questions? <a href="mailto:${EMAIL_FROM}">${EMAIL_FROM}</a> · <a href="${APP_URL}">${APP_URL.replace('https://', '')}</a>
    </p>
  </div>
</div></div>
</body></html>`;
}

/* ── Handler ────────────────────────────────────────────────────── */
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Supabase webhook payload: { type: 'INSERT', table: 'community_reports', record: {...} }
  const record = body.record || body;

  const report = {
    ref:        record.ref         || record.id              || 'CR-UNKNOWN',
    issue_type: record.issue_type  || record.type            || 'General issue',
    location:   record.location    || record.address         || 'Unknown location',
    severity:   record.severity    || 'Medium',
    timestamp:  record.created_at  ? new Date(record.created_at).toLocaleString('en-AU') : new Date().toLocaleString('en-AU'),
    org_name:   record.org_name    || 'Your Organisation',
    org_slug:   record.org_slug    || 'org',
  };

  // Get the org's contact email from the record, or fall back to a default
  const toEmail = record.org_email || record.contact_email;
  if (!toEmail) {
    return new Response(JSON.stringify({ error: 'No org email in record' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Send via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    `Crew Community Reports <${EMAIL_FROM}>`,
      to:      [toEmail],
      subject: `[${report.severity}] Community report in your area — ${report.issue_type}`,
      html:    buildHtml(report),
    }),
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    console.error('Resend error:', err);
    return new Response(JSON.stringify({ error: err }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  const result = await emailRes.json();
  return new Response(JSON.stringify({ success: true, id: result.id }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
});
