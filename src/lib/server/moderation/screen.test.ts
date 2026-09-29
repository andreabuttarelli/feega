import { describe, expect, it, vi } from 'vitest';
import { screenGeneration, type ScreenPorts } from './screen';

const safe = { choice: 'safe', probabilities: { safe: 0.999 } };
const doubtful = { choice: 'safe', probabilities: { safe: 0.9, hate: 0.05 } };
const generic = { choice: 'generic', probabilities: { generic: 0.999 } };

function ports(overrides: Partial<ScreenPorts> = {}): ScreenPorts {
  return {
    decide: vi.fn(async () => safe),
    judge: vi.fn(async () => ({ allowed: true, category: 'safe', reason: 'ok' })),
    decideIdentifiability: vi.fn(async () => generic),
    judgeIdentifiability: vi.fn(async () => ({ allowed: true, category: 'generic', reason: 'ok' })),
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

describe('the identifiability check on uncensored generations', () => {
  it('does not run identifiability on a censored generation', async () => {
    const p = ports();
    expect(await screenGeneration(p, request('a mountain lake', false))).toEqual({ ok: true });
    expect(p.decideIdentifiability).not.toHaveBeenCalled();
  });

  it('runs the content and identifiability checks concurrently, not one after the other', async () => {
    const started: string[] = [];
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const p = ports({
      decide: vi.fn(async () => {
        started.push('content');
        await wait(10);
        return safe;
      }),
      decideIdentifiability: vi.fn(async () => {
        started.push('identifiability');
        await wait(10);
        return generic;
      })
    });
    const startedAt = Date.now();
    expect(await screenGeneration(p, request('a portrait', true))).toEqual({ ok: true });
    expect(Date.now() - startedAt).toBeLessThan(20);
    expect(started.sort()).toEqual(['content', 'identifiability']);
  });

  it('clears when both checks clear', async () => {
    const p = ports();
    expect(await screenGeneration(p, request('a portrait', true))).toEqual({ ok: true });
    expect(p.record).toHaveBeenCalledWith(expect.objectContaining({ stage: 'identifiability', verdict: 'clear' }));
  });

  it('refuses when identifiability is not generic, even if the content check clears', async () => {
    const p = ports({
      decideIdentifiability: vi.fn(async () => ({ choice: 'distinctive_marks', probabilities: { generic: 0.1, distinctive_marks: 0.9 } }))
    });
    const out = await screenGeneration(p, request('a person with a rose tattoo on their left wrist that says "mom"', true));
    expect(out).toMatchObject({ ok: false });
    expect(!out.ok && out.error).toContain('too specific');
    expect(p.record).toHaveBeenCalledWith(expect.objectContaining({ stage: 'identifiability', verdict: 'refuse', category: 'distinctive_marks' }));
  });

  it('escalates identifiability doubt to the identifiability judge and refuses unless it clears', async () => {
    const p = ports({
      decideIdentifiability: vi.fn(async () => ({ choice: 'generic', probabilities: { generic: 0.9, specific_face: 0.06 } })),
      judgeIdentifiability: vi.fn(async () => ({ allowed: false, category: 'specific_face', reason: 'named look-alike' }))
    });
    const out = await screenGeneration(p, request('looks exactly like a specific actress', true));
    expect(out).toMatchObject({ ok: false });
    expect(!out.ok && out.error).toContain('named look-alike');
    expect(p.judgeIdentifiability).toHaveBeenCalledOnce();
  });

  it('clears identifiability doubt when the identifiability judge agrees it is generic', async () => {
    const p = ports({
      decideIdentifiability: vi.fn(async () => ({ choice: 'generic', probabilities: { generic: 0.9, specific_face: 0.06 } })),
      judgeIdentifiability: vi.fn(async () => ({ allowed: true, category: 'generic', reason: 'no identifying detail' }))
    });
    expect(await screenGeneration(p, request('a woman with brown hair', true))).toEqual({ ok: true });
  });

  it('refuses when the content check refuses even if identifiability clears', async () => {
    const p = ports({ decide: vi.fn(async () => ({ choice: 'hate', probabilities: { hate: 0.9, safe: 0.1 } })) });
    const out = await screenGeneration(p, request('something hateful', true));
    expect(out).toMatchObject({ ok: false });
  });

  it('fails closed when the identifiability Jev call is unavailable', async () => {
    const p = ports({ decideIdentifiability: vi.fn(async () => Promise.reject(new Error('down'))) });
    const out = await screenGeneration(p, request('a portrait', true));
    expect(out).toMatchObject({ ok: false });
    expect(!out.ok && out.error).toMatch(/^moderation_unavailable/);
  });

  it('records the identifiability stage separately from the content stage', async () => {
    const p = ports();
    await screenGeneration(p, request('a portrait', true));
    const stages = (p.record as ReturnType<typeof vi.fn>).mock.calls.map((call) => (call[0] as { stage: string }).stage);
    expect(stages).toContain('jev');
    expect(stages).toContain('identifiability');
  });
});
