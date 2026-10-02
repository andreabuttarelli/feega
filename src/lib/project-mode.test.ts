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
    expect(modeOf('uncensored')).toBe(ProjectMode.Uncensored);
  });

  it.each([Capability.Share, Capability.Publish, Capability.Schedule, Capability.Promote, Capability.CatalogueWrite])(
    'an uncensored project refuses %s, a standard one allows it',
    (capability) => {
      expect(modeAllows(ProjectMode.Uncensored, capability)).toBe(false);
      expect(modeAllows(ProjectMode.Standard, capability)).toBe(true);
    }
  );

  it('wiro models live only in uncensored projects', () => {
    expect(modelAllowedIn(ProjectMode.Standard, 'wiro/some-model')).toBe(false);
    expect(modelAllowedIn(ProjectMode.Uncensored, 'wiro/some-model')).toBe(true);
    expect(modelAllowedIn(ProjectMode.Standard, 'google/gemini-image')).toBe(true);
    expect(modelAllowedIn(ProjectMode.Uncensored, 'google/gemini-image')).toBe(true);
    expect(modelAllowedIn(ProjectMode.Standard, null)).toBe(true);
  });

  it.each(['wiro/microsoft/trellis-2', 'wiro/tencent/hunyuan3d-2-1', 'wiro/tencentarc/pixal3d'])(
    'the reviewed 3D model %s runs in every project',
    (model) => {
      expect(modelAllowedIn(ProjectMode.Standard, model)).toBe(true);
      expect(modelAllowedIn(ProjectMode.Uncensored, model)).toBe(true);
    }
  );

  it('the menu of a standard project carries no wiro model', () => {
    const choices = [{ id: 'wiro/a' }, { id: 'openai/b' }];
    expect(offerableIn(ProjectMode.Standard, choices).map((c) => c.id)).toEqual(['openai/b']);
    expect(offerableIn(ProjectMode.Uncensored, choices).map((c) => c.id)).toEqual(['wiro/a', 'openai/b']);
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
    expect(catalogueIn(ProjectMode.Uncensored, catalogue)).toEqual(catalogue);
  });
});
