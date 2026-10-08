import { describe, expect, it } from 'vitest';
import { settingsGroupsFor } from './platforms';
import { SocialPublishing } from '$lib/social-publishing';

const sections = (publishing: SocialPublishing) => settingsGroupsFor(publishing).flatMap((g) => g.items.map((i) => i.section));

describe('settings groups under the social publishing flag', () => {
  it('con il flag spento non mostra gli account social', () => {
    expect(sections(SocialPublishing.Off)).not.toContain('connected-accounts');
    expect(sections(SocialPublishing.Off)).toContain('project');
  });

  it('con il flag acceso li mostra come prima', () => {
    expect(sections(SocialPublishing.On)).toContain('connected-accounts');
  });
});
