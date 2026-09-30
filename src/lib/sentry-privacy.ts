export const SENTRY_PRIVACY = { sendDefaultPii: false } as const;

export const REPLAY_PRIVACY = { maskAllText: true, maskAllInputs: true, blockAllMedia: true } as const;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const EMAIL_MASK = '[email]';

type ScrubbableEvent = {
  message?: string;
  request?: { url?: string; data?: unknown; cookies?: unknown; headers?: unknown; query_string?: unknown };
  user?: { id?: string | number };
  exception?: { values?: { value?: string }[] };
};

function maskEmails(text: string | undefined): string | undefined {
  return text?.replace(EMAIL, EMAIL_MASK);
}

function withoutQuery(url: string | undefined): string | undefined {
  return url?.split('?')[0];
}

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    event.request = { url: withoutQuery(event.request.url) };
  }
  if (event.user) {
    event.user = event.user.id === undefined ? {} : { id: event.user.id };
  }
  if (event.message !== undefined) {
    event.message = maskEmails(event.message);
  }
  for (const value of event.exception?.values ?? []) {
    value.value = maskEmails(value.value);
  }
  return event;
}

export function privateEvent<T extends ScrubbableEvent>(event: T, keep: (e: T) => T | null): T | null {
  const kept = keep(event);
  return kept && scrubEvent(kept);
}
