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
