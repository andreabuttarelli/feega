import { describe, expect, it, vi } from 'vitest';
import { screenGeneration, type ScreenPorts } from './screen';

const safe = { choice: 'safe', probabilities: { safe: 0.999 } };
const doubtful = { choice: 'safe', probabilities: { safe: 0.9, hate: 0.05 } };

function ports(overrides: Partial<ScreenPorts> = {}): ScreenPorts {
  return {
    decide: vi.fn(async () => safe),
    judge: vi.fn(async () => ({ allowed: true, category: 'safe', reason: 'ok' })),
    record: vi.fn(),
    ...overrides
  };
}

const request = (text: string, uncensored = false) => ({ text, references: [], uncensored });

describe('screening a generation before it reaches the provider', () => {
  it('clears a confident safe prompt with one Jev call and no escalation', async () => {
    const p = ports();
    expect(await screenGeneration(p, request('a mountain lake at dawn'))).toEqual({ ok: true });
    expect(p.judge).not.toHaveBeenCalled();
    expect(p.record).toHaveBeenCalledWith(expect.objectContaining({ stage: 'jev', verdict: 'clear' }));
  });

  it('escalates a doubtful safe decision to the LLM judge and clears only when it agrees', async () => {
    const p = ports({ decide: vi.fn(async () => doubtful) });
    expect(await screenGeneration(p, request('a boxing match'))).toEqual({ ok: true });
    expect(p.judge).toHaveBeenCalledOnce();
    expect(p.record).toHaveBeenCalledWith(expect.objectContaining({ stage: 'llm', verdict: 'clear' }));
  });

  it('refuses when the LLM judge does not clear the escalation', async () => {
    const p = ports({
      decide: vi.fn(async () => doubtful),
      judge: vi.fn(async () => ({ allowed: false, category: 'hate', reason: 'slur in the prompt' }))
    });
    const out = await screenGeneration(p, request('something'));
    expect(out).toMatchObject({ ok: false });
    expect(!out.ok && out.error).toContain('slur in the prompt');
  });

  it('refuses when the judge itself fails', async () => {
    const p = ports({ decide: vi.fn(async () => doubtful), judge: vi.fn(async () => Promise.reject(new Error('down'))) });
    expect(await screenGeneration(p, request('x'))).toMatchObject({ ok: false });
  });

  it('fails closed when Jev is unavailable', async () => {
    const p = ports({ decide: vi.fn(async () => Promise.reject(new Error('jev_not_configured'))) });
    const out = await screenGeneration(p, request('a mountain lake'));
    expect(out).toMatchObject({ ok: false });
    expect(!out.ok && out.error).toMatch(/^moderation_unavailable/);
  });

  it('refuses minors on an uncensored model from the keyword rule without calling Jev', async () => {
    const p = ports();
    const out = await screenGeneration(p, request('nude schoolgirl', true));
    expect(out).toMatchObject({ ok: false });
    expect(p.decide).not.toHaveBeenCalled();
    expect(p.record).toHaveBeenCalledWith(expect.objectContaining({ stage: 'rules', verdict: 'refuse', category: 'minors' }));
  });

  it('refuses minors from Jev without escalating even when safe is the top choice', async () => {
    const p = ports({ decide: vi.fn(async () => ({ choice: 'safe', probabilities: { safe: 0.97, minors: 0.03 } })) });
    expect(await screenGeneration(p, request('portrait'))).toMatchObject({ ok: false });
    expect(p.judge).not.toHaveBeenCalled();
  });

  it('sends reference descriptions to Jev together with the prompt', async () => {
    const p = ports();
    await screenGeneration(p, { text: 'make it sexy', references: ['uploaded photo'], uncensored: true });
    expect(p.decide).toHaveBeenCalledWith(expect.stringContaining('uploaded photo'));
  });
});
