import { describe, expect, it } from 'vitest';
import { sectionEditable } from '$lib/components/settings/platforms';

describe('le impostazioni di un viewer', () => {
  it('il proprio profilo resta suo', () => {
    expect(sectionEditable('/p/p1/settings/profile', 'viewer')).toBe(true);
    expect(sectionEditable('/p/p1/settings/appearance', 'viewer')).toBe(true);
  });

  it('progetto, brand e workspace sono in sola lettura', () => {
    expect(sectionEditable('/p/p1/settings/project', 'viewer')).toBe(false);
    expect(sectionEditable('/p/p1/settings/brand', 'viewer')).toBe(false);
    expect(sectionEditable('/p/p1/settings/api-keys', 'viewer')).toBe(false);
  });

  it('un member modifica tutto', () => {
    expect(sectionEditable('/p/p1/settings/project', 'member')).toBe(true);
  });
});
