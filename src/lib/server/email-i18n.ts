import { IntlMessageFormat } from 'intl-messageformat';
import { DEFAULT_LOCALE, isLocale, type Locale } from '$lib/i18n/locale';

// Server-side email copy. We deliberately do NOT use the svelte-i18n store here: it's a
// client/component-oriented singleton, unsafe under concurrent server requests. A plain
// dictionary rendered with intl-messageformat gives us correct ICU plurals per recipient.
// Note: ICU uses ' as an escape char, so we use typographic apostrophes (’) in copy.

type Dict = Record<string, string>;

const EMAIL: Record<Locale, Dict> = {
  en: {
    'auth.reset.subject': 'Reset your feega password',
    'auth.reset.heading': 'Reset your password',
    'auth.reset.intro':
      'We got a request to reset the password for your feega account. Tap the button below to choose a new one. The link expires in 1 hour.',
    'auth.reset.cta': 'Set a new password →',
    'auth.reset.footer': 'If you didn’t request this, you can safely ignore this email — your password won’t change.',
    'invite.subject': '{inviter} invited you to {brand} on feega',
    'invite.heading': 'Join {brand} on feega',
    'invite.intro':
      '{inviter} invited you to collaborate on {brand}. Accept the invite to plan, review and manage its content together.',
    'invite.cta': 'Accept invite \u2192',
    'invite.footer':
      'The invite expires in 7 days. If you don\u2019t have an feega account yet, sign up with this email address ({email}) to see it.'
  }
};

export function emailLocale(v: string | null | undefined): Locale {
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export function tEmail(locale: Locale, key: string, vars?: Record<string, unknown>): string {
  const dict = EMAIL[locale] ?? EMAIL[DEFAULT_LOCALE];
  const msg = dict[key] ?? EMAIL[DEFAULT_LOCALE][key] ?? key;
  return new IntlMessageFormat(msg, locale).format(vars) as string;
}
