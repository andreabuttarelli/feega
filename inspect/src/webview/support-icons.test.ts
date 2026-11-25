import { describe, expect, it } from 'vitest';
import { SLIDES } from './onboarding-slides';
import { SUPPORT_ICONS } from './support-icons';
import { SUPPORT_ITEMS } from '../support';

describe('icone dell\'onboarding', () => {
  it('ogni slide ha la sua icona', () => {
    expect(new Set(SLIDES.map((slide) => slide.icon)).size).toBe(SLIDES.length);
  });

  it('ogni voce di supporto ha la sua icona', () => {
    for (const item of SUPPORT_ITEMS) {
      expect(SUPPORT_ICONS[item.id]).toBeDefined();
    }
  });
});
