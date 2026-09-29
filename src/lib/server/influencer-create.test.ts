import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const { generateImagesWithoutBrand, screenModelInput, createInfluencer } = vi.hoisted(() => ({
  generateImagesWithoutBrand: vi.fn(),
  screenModelInput: vi.fn(),
  createInfluencer: vi.fn()
}));
vi.mock('$lib/server/media-generate', () => ({ generateImagesWithoutBrand }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput }));
vi.mock('$lib/server/repos/influencers', () => ({ createInfluencer, insertInfluencerViews: vi.fn() }));

import { generateInfluencer } from './influencer-create';

const input = {
  orgId: 'org-1',
  userId: 'user-1',
  name: 'Ava',
  slug: 'ava',
  gender: null,
  age: 30,
  ethnicity: null,
  bodyType: null,
  heightBand: null,
  summary: null,
  facePrompt: 'a nude woman, explicit',
  builder: null
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the influencer builder screens its prompt before any render', () => {
  it('refuses a sexual face prompt without generating or creating anything', async () => {
    const blocked = "This prompt was blocked: sexual content isn't allowed in feega's standard mode.";
    screenModelInput.mockResolvedValue({ ok: false, error: blocked });

    expect(await generateInfluencer({} as SupabaseClient, input)).toEqual({ ok: false, error: blocked });
    expect(generateImagesWithoutBrand).not.toHaveBeenCalled();
    expect(createInfluencer).not.toHaveBeenCalled();
    expect(screenModelInput.mock.calls[0][1]).toMatchObject({ profile: 'standard', texts: ['a nude woman, explicit'], scope: { orgId: 'org-1', userId: 'user-1' } });
  });
});
