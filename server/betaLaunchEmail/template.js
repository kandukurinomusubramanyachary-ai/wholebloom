const BETA_LAUNCH_SUBJECT = 'Bloom Beta Is Live — A Promise Kept 🌷';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

function sanitizeFirstName(value) {
  if (typeof value !== 'string') return '';

  return value
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validateBetaUrl(value, { requireHttps = true } = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('BLOOM_BETA_URL is required.');
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('BLOOM_BETA_URL must be a valid URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('BLOOM_BETA_URL must be an HTTP(S) URL without embedded credentials.');
  }
  if (requireHttps && parsed.protocol !== 'https:') {
    throw new Error('BLOOM_BETA_URL must use HTTPS when sending email.');
  }

  return parsed.toString();
}

function buildGreeting(firstName) {
  const cleanFirstName = sanitizeFirstName(firstName);
  return cleanFirstName ? `Hello ${cleanFirstName},` : 'Hello,';
}

function buildBetaLaunchText({ firstName, betaUrl }) {
  const greeting = buildGreeting(firstName);
  const safeBetaUrl = validateBetaUrl(betaUrl);

  return `${greeting}

You were among the first people to believe in the vision for Bloom.
Today, that vision becomes a reality.

We built Bloom because women with irregular cycles and PCOD/PCOS deserve support designed around their real experiences—not systems built only for predictable patterns. You should not have to navigate your health alone.

What’s inside the Beta

Smart Pattern Tracking
Designed to support irregular and complex cycle patterns.

Meg AI
Your emotional and health companion, named as a reminder of the strength of the women who inspired this journey.

Resource Library
Simple, supportive guidance for the days that feel difficult.

Your Bloom Beta access

Open Bloom Beta: ${safeBetaUrl}

Use the same email address you used to join the Bloom waitlist. After your access is confirmed, Bloom will send you a secure sign-in link.

This platform began with a promise. Today, we take our first step towards the bigger vision.

Use Bloom, speak with Meg, explore the features, and share your honest feedback. Every response will help us build something that understands women better.

With gratitude,

Subbu
Founder, Bloom & Tulips AI

Your body is not broken. Your story deserves to be understood.`;
}

function buildBetaLaunchHtml({ firstName, betaUrl }) {
  const greeting = escapeHtml(buildGreeting(firstName));
  const safeBetaUrl = escapeHtml(validateBetaUrl(betaUrl));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(BETA_LAUNCH_SUBJECT)}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .email-shell { width: 100% !important; }
        .email-card { padding: 30px 22px !important; }
        .feature-cell { display: block !important; width: auto !important; padding: 0 0 14px !important; }
        .cta { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#F7F2EC;color:#292526;font-family:Arial,'Helvetica Neue',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Bloom Beta is live. Your early access is ready.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F7F2EC;">
      <tr>
        <td align="center" style="padding:28px 14px;">
          <table role="presentation" class="email-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;">
            <tr>
              <td align="center" style="padding:0 0 18px;">
                <div style="color:#B52F50;font-size:31px;font-weight:700;letter-spacing:-1px;line-height:1;">bloom</div>
                <div style="padding-top:7px;color:#7C696D;font-size:11px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;">Private Beta</div>
              </td>
            </tr>
            <tr>
              <td class="email-card" style="background:#FFFCF8;border:1px solid #E9DDD5;border-radius:22px;padding:42px 44px;box-shadow:0 12px 32px rgba(74,52,47,0.08);">
                <div style="display:inline-block;background:#FBE5EA;border-radius:999px;color:#92243F;font-size:12px;font-weight:700;letter-spacing:1px;padding:8px 12px;text-transform:uppercase;">A promise kept</div>
                <h1 style="margin:20px 0 22px;color:#292526;font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:500;letter-spacing:-0.5px;line-height:1.18;">Bloom Beta is live.</h1>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">${greeting}</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">You were among the first people to believe in the vision for Bloom.<br>Today, that vision becomes a reality.</p>
                <p style="margin:0 0 28px;font-size:16px;line-height:1.7;">We built Bloom because women with irregular cycles and PCOD/PCOS deserve support designed around their real experiences—not systems built only for predictable patterns. You should not have to navigate your health alone.</p>

                <h2 style="margin:0 0 14px;color:#292526;font-size:18px;line-height:1.4;">What’s inside the Beta</h2>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;">
                  <tr>
                    <td class="feature-cell" width="33.33%" valign="top" style="padding:0 8px 0 0;">
                      <div style="height:100%;background:#F8EEE9;border-radius:14px;padding:16px;">
                        <div style="color:#92243F;font-size:15px;font-weight:700;line-height:1.35;">Smart Pattern Tracking</div>
                        <div style="padding-top:8px;color:#665E60;font-size:13px;line-height:1.5;">Designed to support irregular and complex cycle patterns.</div>
                      </div>
                    </td>
                    <td class="feature-cell" width="33.33%" valign="top" style="padding:0 4px;">
                      <div style="height:100%;background:#F8EEE9;border-radius:14px;padding:16px;">
                        <div style="color:#92243F;font-size:15px;font-weight:700;line-height:1.35;">Meg AI</div>
                        <div style="padding-top:8px;color:#665E60;font-size:13px;line-height:1.5;">Your emotional and health companion, inspired by the strength behind this journey.</div>
                      </div>
                    </td>
                    <td class="feature-cell" width="33.33%" valign="top" style="padding:0 0 0 8px;">
                      <div style="height:100%;background:#F8EEE9;border-radius:14px;padding:16px;">
                        <div style="color:#92243F;font-size:15px;font-weight:700;line-height:1.35;">Resource Library</div>
                        <div style="padding-top:8px;color:#665E60;font-size:13px;line-height:1.5;">Simple, supportive guidance for the days that feel difficult.</div>
                      </div>
                    </td>
                  </tr>
                </table>

                <div style="background:#FBE5EA;border-radius:16px;padding:24px;text-align:center;">
                  <h2 style="margin:0 0 8px;color:#292526;font-size:20px;line-height:1.4;">Your Bloom Beta access</h2>
                  <p style="margin:0 0 18px;color:#665E60;font-size:14px;line-height:1.6;">Use the same email address you used to join the Bloom waitlist.</p>
                  <a class="cta" href="${safeBetaUrl}" style="display:inline-block;background:#B52F50;border-radius:12px;color:#FFFFFF;font-size:16px;font-weight:700;line-height:1;padding:16px 24px;text-decoration:none;">Open Bloom Beta</a>
                </div>

                <p style="margin:24px 0 18px;font-size:16px;line-height:1.7;">After your access is confirmed, Bloom will send you a secure sign-in link.</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">This platform began with a promise. Today, we take our first step towards the bigger vision.</p>
                <p style="margin:0 0 26px;font-size:16px;line-height:1.7;">Use Bloom, speak with Meg, explore the features, and share your honest feedback. Every response will help us build something that understands women better.</p>
                <p style="margin:0;font-size:16px;line-height:1.7;">With gratitude,<br><br><strong>Subbu</strong><br>Founder, Bloom &amp; Tulips AI</p>
                <div style="margin-top:30px;border-top:1px solid #E9DDD5;padding-top:22px;color:#92243F;font-family:Georgia,'Times New Roman',serif;font-size:17px;font-style:italic;line-height:1.5;text-align:center;">Your body is not broken. Your story deserves to be understood.</div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 20px 0;color:#877B7D;font-size:12px;line-height:1.5;">
                You are receiving this launch note because you joined the Bloom waitlist and consented to hear from us.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildBetaLaunchEmail({ firstName, betaUrl }) {
  return {
    subject: BETA_LAUNCH_SUBJECT,
    html: buildBetaLaunchHtml({ firstName, betaUrl }),
    text: buildBetaLaunchText({ firstName, betaUrl }),
  };
}

module.exports = {
  BETA_LAUNCH_SUBJECT,
  sanitizeFirstName,
  escapeHtml,
  validateBetaUrl,
  buildGreeting,
  buildBetaLaunchText,
  buildBetaLaunchHtml,
  buildBetaLaunchEmail,
};
