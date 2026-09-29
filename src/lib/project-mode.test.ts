import { describe, expect, it } from 'vitest';
import {
  Capability,
  catalogueIn,
  ProjectMode,
  modeAllows,
  modeOf,
  modelAllowedIn,
  offerableIn
} from './project-mode';

describe('project mode', () => {
  it('a missing or unknown mode is standard', () => {
    expect(modeOf(undefined)).toBe(ProjectMode.Standard);
    expect(modeOf('weird')).toBe(ProjectMode.Standard);
    expect(modeOf('nsfw')).toBe(ProjectMode.Nsfw);
  });

  it.each([Capability.Share, Capability.Publish, Capability.Schedule, Capability.Promote, Capability.CatalogueWrite])(
    'an nsfw project refuses %s, a standard one allows it',
    (capability) => {
      expect(modeAllows(ProjectMode.Nsfw, capability)).toBe(false);
      expect(modeAllows(ProjectMode.Standard, capability)).toBe(true);
    }
  );

  it('wiro models live only in nsfw projects', () => {
    expect(modelAllowedIn(ProjectMode.Standard, 'wiro/some-model')).toBe(false);
    expect(modelAllowedIn(ProjectMode.Nsfw, 'wiro/some-model')).toBe(true);
    expect(modelAllowedIn(ProjectMode.Standard, 'google/gemini-image')).toBe(true);
    expect(modelAllowedIn(ProjectMode.Nsfw, 'google/gemini-image')).toBe(true);
    expect(modelAllowedIn(ProjectMode.Standard, null)).toBe(true);
  });

  it('the menu of a standard project carries no wiro model', () => {
    const choices = [{ id: 'wiro/a' }, { id: 'openai/b' }];
    expect(offerableIn(ProjectMode.Standard, choices).map((c) => c.id)).toEqual(['openai/b']);
    expect(offerableIn(ProjectMode.Nsfw, choices).map((c) => c.id)).toEqual(['wiro/a', 'openai/b']);
  });

});

describe('catalogueIn', () => {
  it('drops wiro choices and recommendations from every medium of a standard project', () => {
    const catalogue = {
      image: { choices: [{ id: 'wiro/a' }, { id: 'openai/b' }], recommended: [{ id: 'wiro/a' }, { id: 'openai/b' }], candidates: [{ id: 'wiro/a' }] },
      video: { choices: [{ id: 'wiro/v' }], recommended: [] }
    };
    const standard = catalogueIn(ProjectMode.Standard, catalogue);
    expect(standard.image.choices.map((c) => c.id)).toEqual(['openai/b']);
    expect(standard.image.recommended.map((c) => c.id)).toEqual(['openai/b']);
    expect((standard.image as { candidates?: unknown[] }).candidates).toEqual([]);
    expect(standard.video.choices).toEqual([]);
    expect(catalogueIn(ProjectMode.Nsfw, catalogue)).toEqual(catalogue);
  });
});
