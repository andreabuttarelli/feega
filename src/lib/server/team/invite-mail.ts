import { sendEmail, brandInviteEmailSubject, brandInviteEmailHtml, brandInviteEmailText } from '$lib/server/email';
import { emailLocale } from '$lib/server/email-i18n';
import type { InviteMail } from '$lib/server/team/team';

export function inviteMailer(input: { inviterEmail: string | undefined; origin: string; locale?: string | null }) {
  const locale = emailLocale(input.locale);
  const inviter = input.inviterEmail ?? 'A teammate';

  return async (mail: InviteMail): Promise<boolean> => {
    await sendEmail({
      to: mail.to,
      subject: brandInviteEmailSubject(locale, mail.orgName, inviter),
      html: brandInviteEmailHtml(locale, mail.orgName, inviter, mail.to, mail.acceptUrl, input.origin),
      text: brandInviteEmailText(locale, mail.orgName, inviter, mail.to, mail.acceptUrl)
    });
    return true;
  };
}
