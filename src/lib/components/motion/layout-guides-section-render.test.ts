import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import LayoutGuidesSection from './LayoutGuidesSection.svelte';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { GuideKind, newGuide } from '$lib/motion/layout-guides/guides';

const shown = (body: string) => body.replace(/<!--[^>]*-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the layout grid fields', () => {
  it('name every number they hold, so 12 and 20 read as count and gutter', () => {
    const doc = { ...newMotionDoc(MotionFormat.Portrait), layoutGuides: [newGuide(GuideKind.Columns)] };
    const text = shown(render(LayoutGuidesSection, { props: { doc, onchange: () => {} } }).body);

    for (const label of ['Type', 'Count', 'Gutter', 'Align', 'Margin', 'Colour', 'Opacity', 'Show']) {
      expect(text).toContain(` ${label} `);
    }
  });
});
