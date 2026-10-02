import { describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';
import { parsePeopleVerdict, PEOPLE_REFUSAL, PeopleVerdict, ReferenceMedium, screenReferences, type Reference } from './people';

const photo = (name: string): Reference => ({ medium: ReferenceMedium.Image, url: `https://x/${name}.png` });

function detectorSaying(verdicts: Record<string, PeopleVerdict>) {
  return vi.fn(async (reference: Reference) => verdicts[reference.url.split('/').pop()!.replace('.png', '')] ?? PeopleVerdict.Unknown);
}

describe('references with people in uncensored projects', () => {
  it.each([
    { refs: ['landscape'], verdicts: { landscape: PeopleVerdict.Absent }, ok: true },
    { refs: ['product', 'landscape'], verdicts: { product: PeopleVerdict.Absent, landscape: PeopleVerdict.Absent }, ok: true },
    { refs: ['person'], verdicts: { person: PeopleVerdict.Present }, ok: false },
    { refs: ['product', 'crowd'], verdicts: { product: PeopleVerdict.Absent, crowd: PeopleVerdict.Present }, ok: false },
    { refs: ['blurry'], verdicts: { blurry: PeopleVerdict.Unknown }, ok: false }
  ])('uncensored $refs → ok $ok', async ({ refs, verdicts, ok }) => {
    const out = await screenReferences(detectorSaying(verdicts), ProjectMode.Uncensored, refs.map(photo));
    expect(out.ok).toBe(ok);
  });

  it('names the rule in the refusal', async () => {
    const out = await screenReferences(detectorSaying({ person: PeopleVerdict.Present }), ProjectMode.Uncensored, [photo('person')]);
    expect(out).toEqual({ ok: false, error: PEOPLE_REFUSAL });
  });

  it('fails closed when the detector is down', async () => {
    const out = await screenReferences(vi.fn(async () => Promise.reject(new Error('down'))), ProjectMode.Uncensored, [photo('landscape')]);
    expect(out).toMatchObject({ ok: false, unavailable: true });
  });

  it('never asks the detector in a standard project', async () => {
    const detect = vi.fn();
    expect(await screenReferences(detect, ProjectMode.Standard, [photo('person')])).toEqual({ ok: true });
    expect(detect).not.toHaveBeenCalled();
  });

  it('never asks the detector when there is nothing attached', async () => {
    const detect = vi.fn();
    expect(await screenReferences(detect, ProjectMode.Uncensored, [])).toEqual({ ok: true });
    expect(detect).not.toHaveBeenCalled();
  });
});

describe('reading the people detector answer', () => {
  it.each([
    ['{"people": false}', PeopleVerdict.Absent],
    ['```json\n{"people": true, "why": "a face"}\n```', PeopleVerdict.Present],
    ['{"people": "maybe"}', PeopleVerdict.Unknown],
    ['no idea', PeopleVerdict.Unknown]
  ])('%s → %s', (raw, verdict) => {
    expect(parsePeopleVerdict(raw)).toBe(verdict);
  });
});
