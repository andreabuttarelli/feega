import { describe, expect, it } from 'vitest';
import { itemFor } from './names';

const items = [{ name: 'faq-scroll-accordion' }, { name: 'pricing-plans' }, { name: 'three-dwall-calendar' }, { name: 'button' }];

describe('the catalog item a component set belongs to', () => {
  it('is found by its slug however the export capitalises or separates it', () => {
    expect(['FAQScrollAccordion', 'Pricing_Plans', 'ThreeDWallCalendar', 'Button'].map((n) => itemFor(items, n)?.name)).toEqual(['faq-scroll-accordion', 'pricing-plans', 'three-dwall-calendar', 'button']);
  });

  it('is found through its demo when the demo and the component share one root', () => {
    expect(itemFor(items, 'PricingPlansDemo')?.name).toBe('pricing-plans');
  });

  it('is none for a set no item names', () => {
    expect(itemFor(items, 'FormGroup')).toBeNull();
  });
});
