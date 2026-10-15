import { swallow } from '$lib/server/swallow';
import { createAdminClient } from '$lib/server/supabase-admin';
import { sendEmail, passwordResetEmailSubject, passwordResetEmailHtml, passwordResetEmailText } from '$lib/server/email';
import { emailLocale } from '$lib/server/email-i18n';
import { INVITE_PARAM } from '$lib/server/tenancy/landing';

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const MIN_PASSWORD = 6;

export type AccountRefusal = { errorCode: 'invalidEmail' | 'weakPassword' | 'emailExists' } | { error: string };

export async function createConfirmedAccount(email: string, password: string): Promise<AccountRefusal | null> {
  if (!EMAIL_RE.test(email)) return { errorCode: 'invalidEmail' };
  if (password.length < MIN_PASSWORD) return { errorCode: 'weakPassword' };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (!error) return null;
  if (/already|registered|exists|duplicate/i.test(error.message)) return { errorCode: 'emailExists' };
  return { error: error.message };
}

function resetPasswordPath(inviteToken: string | null): string {
  return inviteToken ? `/auth/reset-password?${INVITE_PARAM}=${encodeURIComponent(inviteToken)}` : '/auth/reset-password';
}

export async function sendPasswordReset(input: { email: string; locale: string; base: string; inviteToken: string | null }): Promise<void> {
  const locale = emailLocale(input.locale);
  try {
    const admin = createAdminClient();
    const { data: link, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: input.email });
    const hashed = link?.properties?.hashed_token;
    if (error || !hashed) {
      return;
    }
    const confirmUrl = `${input.base}/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=recovery&next=${encodeURIComponent(resetPasswordPath(input.inviteToken))}`;
    await sendEmail({
      to: input.email,
      subject: passwordResetEmailSubject(locale),
      html: passwordResetEmailHtml(locale, confirmUrl, input.base),
      text: passwordResetEmailText(locale, confirmUrl)
    });
  } catch (error) {
    swallow('deliver password reset', error);
  }
}
