/**
 * Email sending via Resend (https://resend.com).
 *
 * Env vars:
 *   RESEND_API_KEY — required. Get at https://resend.com/api-keys
 *   EMAIL_FROM     — optional. Default 'HablaYa <onboarding@resend.dev>'.
 *                    For production with a custom domain, set this to
 *                    something like 'HablaYa <noreply@hablaya.app>' AFTER
 *                    verifying the domain in your Resend dashboard.
 *   APP_URL        — the base URL used in email links. e.g.
 *                    'https://hablaya-production.up.railway.app'.
 *                    Without this, password-reset links won't work in emails.
 */
const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'HablaYa <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || '';

function isConfigured() {
  return !!RESEND_API_KEY;
}

function getAppUrl() {
  return APP_URL;
}

/**
 * Low-level: send an HTML email via Resend.
 * @returns {Promise<{ok: boolean, status?: number, error?: string}>}
 */
function sendEmail({ to, subject, html, text }) {
  return new Promise((resolve) => {
    if (!RESEND_API_KEY) {
      console.warn('[email] RESEND_API_KEY not set — skipping send to', to);
      resolve({ ok: false, error: 'RESEND_API_KEY not configured on the server.' });
      return;
    }

    const body = JSON.stringify({
      from: EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(text ? { text } : {}),
    });

    const req = https.request(
      {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString();
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode });
          } else {
            console.error('[email] Resend API error:', res.statusCode, responseBody);
            resolve({ ok: false, status: res.statusCode, error: responseBody });
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('[email] Network error:', err.message);
      resolve({ ok: false, error: err.message });
    });

    req.write(body);
    req.end();
  });
}

/**
 * Send a password-reset email. The link includes the token and brings the
 * user to /reset-password?token=... in the app, where they enter a new
 * password.
 */
async function sendPasswordResetEmail({ to, name, resetToken }) {
  if (!APP_URL) {
    console.warn('[email] APP_URL not set — reset link will be broken');
  }
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const greeting = name ? `Hoi ${name},` : 'Hoi,';

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <h1 style="color:#1A7B72;font-size:24px;margin:0 0 24px;font-weight:700;">Reset je HablaYa wachtwoord</h1>
    <p style="color:#333;line-height:1.6;font-size:16px;margin:0 0 16px;">${greeting}</p>
    <p style="color:#333;line-height:1.6;font-size:16px;margin:0 0 24px;">
      Iemand (waarschijnlijk jij) heeft gevraagd om je wachtwoord te resetten. Klik op de knop hieronder om een nieuw wachtwoord in te stellen. Deze link verloopt over <strong>1 uur</strong>.
    </p>
    <p style="margin:32px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:#1A7B72;color:#ffffff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;">Reset wachtwoord</a>
    </p>
    <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 8px;">Of kopieer deze link in je browser:</p>
    <p style="color:#1A7B72;font-size:13px;word-break:break-all;margin:0 0 32px;">${resetUrl}</p>
    <hr style="border:none;border-top:1px solid #E5E5E5;margin:32px 0;">
    <p style="color:#999;font-size:13px;line-height:1.5;margin:0;">
      Heb je dit niet aangevraagd? Negeer deze email — er gebeurt niks. Je wachtwoord blijft hetzelfde.
    </p>
    <p style="color:#999;font-size:13px;line-height:1.5;margin:16px 0 0;">
      — HablaYa
    </p>
  </div>
</body>
</html>`;

  const text = `${greeting}

Iemand vroeg om je HablaYa wachtwoord te resetten. Ga naar:
${resetUrl}

Deze link verloopt over 1 uur.

Niet aangevraagd? Negeer deze email.

— HablaYa`;

  return sendEmail({
    to,
    subject: 'Reset je HablaYa wachtwoord',
    html,
    text,
  });
}

module.exports = {
  isConfigured,
  getAppUrl,
  sendEmail,
  sendPasswordResetEmail,
};
