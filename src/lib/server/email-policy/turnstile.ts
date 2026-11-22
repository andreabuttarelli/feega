export enum TurnstileOutcome {
  Skipped = 'skipped',
  Passed = 'passed',
  Failed = 'failed'
}

export type TurnstileConfig = { secret: string };

export const TURNSTILE_FIELD = 'cf-turnstile-response';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type Send = (url: string, init: RequestInit) => Promise<Response>;

export function turnstileConfig(env: Record<string, string | undefined>): TurnstileConfig | null {
  const secret = env.TURNSTILE_SECRET_KEY;
  return secret ? { secret } : null;
}

export async function verifyTurnstile(token: string, config: TurnstileConfig | null, send: Send = fetch): Promise<TurnstileOutcome> {
  if (!config) {
    return TurnstileOutcome.Skipped;
  }

  if (!token) {
    return TurnstileOutcome.Failed;
  }

  try {
    const response = await send(SITEVERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret: config.secret, response: token })
    });
    if (!response.ok) {
      return TurnstileOutcome.Failed;
    }

    const { success } = (await response.json()) as { success?: boolean };
    return success ? TurnstileOutcome.Passed : TurnstileOutcome.Failed;
  } catch {
    return TurnstileOutcome.Failed;
  }
}
