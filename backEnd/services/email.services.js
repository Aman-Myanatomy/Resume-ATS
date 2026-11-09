import nodemailer from 'nodemailer';

/**
 * Email delivery.
 * With SMTP_HOST set, mail goes out through SMTP (Gmail, Brevo, SES…).
 * Without it, every email is printed to the server console so flows can be tested locally.
 * sendEmail never throws: a failed email must never fail the action that triggered it.
 */
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return transporter;
}

export function emailMode() {
  return process.env.SMTP_HOST ? 'smtp' : 'console';
}

export function appUrl(path = '') {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}${path}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Wraps content in a simple branded layout.
 * `lines` are plain-text paragraphs (escaped). `details` is a list of [label, value] rows.
 */
export function renderEmail({ heading, lines = [], details = [], cta, footer }) {
  const rows = details
    .filter(([, value]) => value)
    .map(([label, value]) => `<tr><td style="padding:6px 12px 6px 0;color:#6b756f;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;color:#17211d">${escapeHtml(value)}</td></tr>`)
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f2;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe5dc;border-radius:10px">
<tr><td style="padding:22px 26px 0;font-size:18px;font-weight:bold;color:#17211d"><span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:#c8e66b;border-radius:6px;margin-right:8px">R</span>resumely</td></tr>
<tr><td style="padding:18px 26px 4px"><h1 style="margin:0 0 12px;font-size:20px;color:#17211d">${escapeHtml(heading)}</h1>
${lines.map(line => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#2b3631">${escapeHtml(line)}</p>`).join('')}
${rows ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;font-size:14px">${rows}</table>` : ''}
${cta ? `<p style="margin:18px 0 22px"><a href="${escapeHtml(cta.url)}" style="background:#17211d;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:7px;font-weight:bold;font-size:14px;display:inline-block">${escapeHtml(cta.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:14px 26px 22px;border-top:1px solid #dfe5dc;font-size:12px;color:#6b756f">${escapeHtml(footer || 'You are receiving this because of activity on your Resumely account.')}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    heading,
    '',
    ...lines,
    ...(details.filter(([, v]) => v).length ? ['', ...details.filter(([, v]) => v).map(([l, v]) => `${l}: ${v}`)] : []),
    ...(cta ? ['', `${cta.label}: ${cta.url}`] : [])
  ].join('\n');
  return { html, text };
}

/** Sends one email. Returns true when handed off (or printed), false on failure. Never throws. */
export async function sendEmail({ to, subject, html, text, icalEvent }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return false;
  const from = process.env.EMAIL_FROM || 'Resumely <no-reply@resumely.local>';

  const smtp = getTransporter();
  if (!smtp) {
    console.log(`\n✉️  [email:console] to=${recipients.join(', ')} | ${subject}\n${text}${icalEvent ? '\n(+ calendar invite attached)' : ''}\n`);
    return true;
  }
  try {
    await smtp.sendMail({ from, to: recipients.join(', '), subject, html, text, icalEvent });
    return true;
  } catch (error) {
    console.error(`Email to ${recipients.join(', ')} failed (${subject}):`, error.message);
    return false;
  }
}

/** Fire-and-forget wrapper for use inside request handlers. */
export function queueEmail(message) {
  sendEmail(message).catch(() => {});
}
