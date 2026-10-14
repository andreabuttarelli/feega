import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import CompositionSettings from './CompositionSettings.svelte';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';

describe('composition settings', () => {
  it('offers to fit the length to the content', () => {
    const body = render(CompositionSettings, { props: { doc: newMotionDoc(MotionFormat.Landscape), onchange: () => {} } }).body;

    expect(body).toContain('data-testid="fit-duration"');
  });
});

describe('composition settings for a still', () => {
  it('a video offers to become a still and lists the poster format', () => {
    const body = render(CompositionSettings, { props: { doc: newMotionDoc(MotionFormat.Portrait), onchange: () => {} } }).body;

    expect(body).toContain('data-testid="still"');
    expect(body).not.toContain('data-testid="still-at"');
    expect(body).toContain('A poster · 1080×1527');
  });

  it('a still shows the moment it keeps', () => {
    const doc = { ...newMotionDoc(MotionFormat.Portrait), still: { frame: 45 } };
    const body = render(CompositionSettings, { props: { doc, onchange: () => {} } }).body;

    expect(body).toContain('data-testid="still-at"');
    expect(body).toMatch(/value="1\.5/);
  });
});
