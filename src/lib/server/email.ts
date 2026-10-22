import { env } from '$env/dynamic/private';
import { tEmail } from './email-i18n';
import { senderEmailDomain } from './support-config';
import type { Locale } from '$lib/i18n/locale';
import { siteUrl } from '$lib/seo';

// Sender address. The domain must be verified in Resend, otherwise Resend rejects delivery to
// anyone but the account owner. Override EMAIL_FROM entirely, or just EMAIL_DOMAIN to change only
// the domain while keeping the default local-part and display name.
const EMAIL_DOMAIN = env.EMAIL_DOMAIN || senderEmailDomain();
const FROM = env.EMAIL_FROM || `feega <noreply@${EMAIL_DOMAIN}>`;

// Always send a plain-text part alongside the HTML: a missing text/plain alternative is a strong
// spam signal, so this materially improves inbox placement (and degrades gracefully everywhere).
export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string; headers?: Record<string, string> }): Promise<void> {
  // La posta è l'unica cosa che arriva a una PERSONA. La suite gira col `.env` di chi la lancia,
  // quindi da qui partivano davvero: ops ha ricevuto incidenti con dentro thread e run finti. Si
  // ferma qui e non nei mock dei singoli file, perché basta un file che se ne dimentica.
  if (process.env.VITEST) return;

  const key = env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');

  // Bounded on purpose: several callers send mail on a teardown path that is already close to the
  // function wall, so an unbounded Resend call can eat the seconds the caller still needs. Resend
  // answers in well under a second normally — anything past this is a failure, not slow delivery.
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html, text: opts.text, ...(opts.headers ? { headers: opts.headers } : {}) }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

// Escape user/brand-generated text before interpolating into the email HTML.
function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Header: the real feega mark (hosted PNG, reliable across clients) + the wordmark in the
// current brand accent. If the image is blocked, the wordmark still reads as the brand.
function header(origin?: string): string {
  const logo = `${siteUrl(origin)}/icon-192.png`;
  return `<div style="font-size:20px;font-weight:600;line-height:24px;margin-bottom:6px;"><img src="${logo}" width="22" height="22" alt="" style="vertical-align:-5px;border-radius:6px;margin-right:8px;" />feega</div>`;
}

function shell(origin: string | undefined, inner: string): string {
  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1d1d1f;padding:8px;">${header(origin)}${inner}</div>`;
}

function cta(approveUrl: string, label: string): string {
  return `<a href="${approveUrl}" style="display:inline-block;background:#1d1d1f;color:#fff;padding:13px 26px;border-radius:980px;text-decoration:none;font-weight:600;margin-top:6px;">${label}</a>`;
}

// ── Password reset ─────────────────────────────────────────────────────────────────────────────
// Sent when a user requests a password reset from /login. The link points at /auth/confirm, which
// verifies the recovery token (verifyOtp) and forwards to /auth/reset-password to set a new password.
// We mint and send this ourselves via Resend — Supabase's built-in mailer is never used.
export function passwordResetEmailSubject(locale: Locale): string {
  return tEmail(locale, 'auth.reset.subject');
}

export function passwordResetEmailHtml(locale: Locale, resetUrl: string, origin?: string): string {
  return shell(
    origin,
    `
    <h2 style="font-size:22px;letter-spacing:-0.02em;margin:14px 0 6px;">${tEmail(locale, 'auth.reset.heading')}</h2>
    <p style="color:#6e6e73;line-height:1.5;margin:0 0 18px;">${tEmail(locale, 'auth.reset.intro')}</p>
    ${cta(resetUrl, tEmail(locale, 'auth.reset.cta'))}
    <p style="color:#86868b;font-size:12px;margin-top:22px;">${tEmail(locale, 'auth.reset.footer')}</p>`
  );
}

export function passwordResetEmailText(locale: Locale, resetUrl: string): string {
  return [
    tEmail(locale, 'auth.reset.heading'),
    '',
    tEmail(locale, 'auth.reset.intro'),
    '',
    `${tEmail(locale, 'auth.reset.cta')} ${resetUrl}`,
    '',
    tEmail(locale, 'auth.reset.footer')
  ].join('\n');
}

// ── Brand invite email ──────────────────────────────────────────────────────
// Sent when an owner shares a brand from Settings → Team. The link lands on the
// invitee's /app?view=invites section, where the accept happens behind their login
// (the invite is matched to their account email, so the email itself carries no secret).

export function brandInviteEmailSubject(locale: Locale, brandName: string, inviter: string): string {
  return tEmail(locale, 'invite.subject', { brand: brandName, inviter });
}

export function brandInviteEmailHtml(locale: Locale, brandName: string, inviter: string, toEmail: string, acceptUrl: string, origin?: string): string {
  return shell(
    origin,
    `
    <h2 style="font-size:22px;letter-spacing:-0.02em;margin:14px 0 6px;">${tEmail(locale, 'invite.heading', { brand: esc(brandName) })}</h2>
    <p style="color:#6e6e73;line-height:1.5;margin:0 0 18px;">${tEmail(locale, 'invite.intro', { brand: esc(brandName), inviter: esc(inviter) })}</p>
    ${cta(acceptUrl, tEmail(locale, 'invite.cta'))}
    <p style="color:#86868b;font-size:12px;margin-top:22px;">${tEmail(locale, 'invite.footer', { email: esc(toEmail) })}</p>`
  );
}

export function brandInviteEmailText(locale: Locale, brandName: string, inviter: string, toEmail: string, acceptUrl: string): string {
  return [
    tEmail(locale, 'invite.heading', { brand: brandName }),
    '',
    tEmail(locale, 'invite.intro', { brand: brandName, inviter }),
    '',
    `${tEmail(locale, 'invite.cta')} ${acceptUrl}`,
    '',
    tEmail(locale, 'invite.footer', { email: toEmail })
  ].join('\n');
}
