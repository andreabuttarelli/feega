import { describe, expect, it, vi } from 'vitest';
import { TurnstileOutcome, verifyTurnstile, type TurnstileConfig } from './turnstile';

const config: TurnstileConfig = { secret: 'secret' };

function siteverify(body: object, status = 200) {
  return vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body), { status }));
}

describe('verifyTurnstile', () => {
  it('salta il controllo quando non ci sono chiavi', async () => {
    const send = siteverify({ success: false });

    await expect(verifyTurnstile('', null, send)).resolves.toBe(TurnstileOutcome.Skipped);
    expect(send).not.toHaveBeenCalled();
  });

  it('rifiuta senza token quando le chiavi ci sono', async () => {
    const send = siteverify({ success: true });

    await expect(verifyTurnstile('', config, send)).resolves.toBe(TurnstileOutcome.Failed);
    expect(send).not.toHaveBeenCalled();
  });

  it('accetta un token che Cloudflare conferma', async () => {
    const send = siteverify({ success: true });

    await expect(verifyTurnstile('tok', config, send)).resolves.toBe(TurnstileOutcome.Passed);

    const [url, init] = send.mock.calls[0];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(String(init.body)).toContain('secret=secret');
    expect(String(init.body)).toContain('response=tok');
  });

  it('rifiuta un token che Cloudflare respinge', async () => {
    await expect(verifyTurnstile('tok', config, siteverify({ success: false }))).resolves.toBe(TurnstileOutcome.Failed);
  });

  it('rifiuta quando Cloudflare non risponde', async () => {
    const down = vi.fn(async () => {
      throw new Error('network');
    });

    await expect(verifyTurnstile('tok', config, down)).resolves.toBe(TurnstileOutcome.Failed);
  });

  it('rifiuta una risposta non ok', async () => {
    await expect(verifyTurnstile('tok', config, siteverify({ success: true }, 500))).resolves.toBe(TurnstileOutcome.Failed);
  });
});
