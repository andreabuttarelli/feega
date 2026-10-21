import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import CoreTextEdit from './CoreTextEdit.svelte';

const LOOK = { fontPx: 54, family: "'DM Sans', sans-serif", weight: 600, italic: false, trackingEm: -0.02, leading: 1.2, color: '#f0eee9', upper: false, align: 'center' };

describe('the caret over core-drawn text', () => {
  it('sits at the clip box with the font the core draws', () => {
    const body = render(CoreTextEdit, { props: { rect: { left: 10, top: 20, width: 300, height: 60 }, look: LOOK, text: 'Hello', oncommit: () => {} } }).body;

    expect(body).toContain('data-testid="core-text-edit"');
    expect(body).toContain('left:10px;top:20px;width:300px;height:60px');
    expect(body).toContain("font:600 54px/1.2 'DM Sans', sans-serif");
    expect(body).toContain('letter-spacing:-0.02em');
    expect(body).toContain('text-align:center');
  });
});
