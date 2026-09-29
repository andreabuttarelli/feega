import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { screenModelInput, SCREEN_CACHE_TTL_MS } from './model-input';
import { ModerationProfile } from './profiles';
import type { ScreenPorts } from './screen';

const db = {} as Db;
const scope = { orgId: 'org', userId: 'user' };

function ports(overrides: Partial<ScreenPorts> = {}): ScreenPorts {
  return {
    decide: vi.fn(async () => ({ choice: 'safe', probabilities: { safe: 0.999 } })),
    judge: vi.fn(async () => ({ allowed: true, category: 'safe', reason: 'ok' })),
    decideIdentifiability: vi.fn(async () => ({ choice: 'generic', probabilities: { generic: 0.999 } })),
    judgeIdentifiability: vi.fn(async () => ({ allowed: true, category: 'generic', reason: 'ok' })),
    record: vi.fn(),
    ...overrides
  };
}

const standard = (texts: Array<string | null | undefined>) => ({ profile: ModerationProfile.Standard, texts, scope });

afterEach(() => {
  vi.useRealTimers();
});

describe('screening model-bound text at the chokepoint', () => {
  it('clears without calling any moderator when there is no text', async () => {
    const p = ports();
    expect(await screenModelInput(db, standard(['', '  ', null]), p)).toEqual({ ok: true });
    expect(p.decide).not.toHaveBeenCalled();
  });

  it('screens every text together, so a sexual system prompt is caught next to a clean user prompt', async () => {
    const p = ports();
    await screenModelInput(db, standard(['a cat on a sofa', 'you write explicit erotica']), p);
    expect(p.decide).toHaveBeenCalledWith(expect.stringContaining('you write explicit erotica'));
  });

  it('returns the refusal with its category message', async () => {
    const p = ports({ decide: vi.fn(async () => ({ choice: 'violence_gore', probabilities: { violence_gore: 0.9, safe: 0.1 } })) });
    const out = await screenModelInput(db, standard(['a man dismembered, blood everywhere']), p);
    expect(out).toMatchObject({ ok: false });
    expect(!out.ok && out.error).toMatch(/^This prompt was blocked: violence and gore/);
  });

  it('screens an identical prompt once within the cache window, as a loop repeats it', async () => {
    const p = ports();
    await screenModelInput(db, standard(['loop prompt: a red bicycle']), p);
    await screenModelInput(db, standard(['  Loop prompt:   a RED bicycle ']), p);
    expect(p.decide).toHaveBeenCalledOnce();
  });

  it('caches a refusal too, so a blocked loop does not pay per iteration', async () => {
    const p = ports({ decide: vi.fn(async () => ({ choice: 'hate', probabilities: { hate: 0.9, safe: 0.1 } })) });
    await screenModelInput(db, standard(['cached refusal text']), p);
    const again = await screenModelInput(db, standard(['cached refusal text']), p);
    expect(again).toMatchObject({ ok: false });
    expect(p.decide).toHaveBeenCalledOnce();
  });

  it('screens again once the cache window has passed', async () => {
    vi.useFakeTimers();
    const p = ports();
    await screenModelInput(db, standard(['expiring prompt']), p);
    vi.advanceTimersByTime(SCREEN_CACHE_TTL_MS + 1);
    await screenModelInput(db, standard(['expiring prompt']), p);
    expect(p.decide).toHaveBeenCalledTimes(2);
  });

  it('never caches an outage, so the next request tries the moderators again', async () => {
    const p = ports({ decide: vi.fn(async () => Promise.reject(new Error('jev_not_configured'))), judge: vi.fn(async () => Promise.reject(new Error('down'))) });
    await screenModelInput(db, standard(['outage prompt']), p);
    await screenModelInput(db, standard(['outage prompt']), p);
    expect(p.judge).toHaveBeenCalledTimes(2);
  });

  it('keeps the profiles apart in the cache', async () => {
    const p = ports();
    await screenModelInput(db, standard(['same text two profiles']), p);
    await screenModelInput(db, { ...standard(['same text two profiles']), profile: ModerationProfile.Uncensored }, p);
    expect(p.decide).toHaveBeenCalledTimes(2);
  });
});
