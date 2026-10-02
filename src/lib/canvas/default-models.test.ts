import { describe, it, expect } from 'vitest';
import { DEFAULT_MODEL, effectiveModel, pickModel, type GenerativeMedium } from './default-models';

const choices = [{ id: 'first' }, { id: DEFAULT_MODEL.image }, { id: 'other' }];

describe('il modello di un nodo', () => {
  it('un nodo senza modello usa il default del suo medium, non il primo della lista', () => {
    expect(effectiveModel('image', null, choices)).toBe(DEFAULT_MODEL.image);
  });

  it('un nodo senza modello usa il balanced raccomandato dal catalogo', () => {
    const tagged = [...choices, { id: 'current', tiers: ['balanced' as const] }];
    expect(effectiveModel('image', null, tagged)).toBe('current');
  });

  it('un modello scelto vince sempre sul default', () => {
    expect(effectiveModel('image', 'other', choices)).toBe('other');
  });

  it('se il default non è offerto, ripiega sul primo del catalogo', () => {
    expect(effectiveModel('image', null, [{ id: 'first' }])).toBe('first');
  });

  it('senza catalogo non inventa un modello', () => {
    expect(effectiveModel('video', null, [])).toBeNull();
  });

  it('ogni medium generativo ha un default', () => {
    expect(Object.keys(DEFAULT_MODEL).sort()).toEqual(['audio', 'image', 'model3d', 'text', 'video']);
  });
});

const offered = (medium: GenerativeMedium) => ({
  choices: [{ id: `${medium}-a` }, { id: `${medium}-b` }, { id: `${medium}-c` }],
  recommended: [
    { tier: 'best' as const, id: `${medium}-a` },
    { tier: 'balanced' as const, id: `${medium}-b` },
    { tier: 'cheapest-good' as const, id: `${medium}-c` }
  ]
});

describe('pickModel: one resolution for every generation entry', () => {
  it('an explicit model on the node wins over the recommendation', () => {
    expect(pickModel('image', 'image-c', offered('image'))).toEqual({ ok: true, model: 'image-c' });
  });

  it.each(['text', 'image', 'video'] as const)('a %s node without a model gets the balanced one', (medium) => {
    expect(pickModel(medium, null, offered(medium))).toEqual({ ok: true, model: `${medium}-b` });
  });

  it('an unknown model is refused, naming the recommended alternatives', () => {
    const out = pickModel('video', 'made-up', offered('video'));

    expect(out.ok).toBe(false);
    expect(!out.ok && out.error).toMatch(/made-up/);
    expect(!out.ok && out.error).toMatch(/video-b \(balanced\).*video-a \(best\).*video-c \(cheapest-good\)/);
  });

  it.each([
    ['image', 'an image'],
    ['video', 'a video'],
    ['text', 'a text']
  ] as const)('the refusal names the %s medium with the right article', (medium, phrase) => {
    const out = pickModel(medium, 'made-up', offered(medium));

    expect(!out.ok && out.error).toContain(`is not ${phrase} model`);
  });

  it('an empty catalogue cannot judge, so an explicit model passes', () => {
    expect(pickModel('text', 'x', { choices: [], recommended: [] })).toEqual({ ok: true, model: 'x' });
  });

  it('no model and nothing offered is refused as model_required', () => {
    expect(pickModel('text', null, { choices: [], recommended: [] })).toEqual({ ok: false, error: 'model_required' });
  });
});
