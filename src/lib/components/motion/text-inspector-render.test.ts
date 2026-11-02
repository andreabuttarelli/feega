import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import MotionInspector from './MotionInspector.svelte';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function inspect(props: Record<string, unknown>) {
  const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, props }, 'c1'));
  const clip = findClip(doc, 'c1')!.clip;
  return render(MotionInspector, { props: { doc, clip, tokens: FEEGA_TOKENS, assets: [], frame: 0, onchange: () => {} } }).body;
}

const cell = (html: string, key: string) => html.split(`data-prop="${key}"`)[1]?.split('</div>')[0] ?? '';

describe('the text inspector', () => {
  it('shows line height and letter spacing in percent', () => {
    const html = inspect({ leading: 1.3, tracking: -0.02 });

    expect(cell(html, 'leading')).toMatch(/value="130(\.0+)?"/);
    expect(cell(html, 'tracking')).toMatch(/value="-2(\.0+)?"/);
  });

  it('puts the aspect lock at the end of the W/H row, not beside X/Y', () => {
    const html = inspect({});
    const xy = html.split('class="row xy')[1]?.split('</div>')[0] ?? '';
    const size = html.split('data-testid="size-row"')[1] ?? '';

    expect(xy).not.toContain('ratio-lock');
    expect(size.indexOf('data-prop="height"')).toBeGreaterThan(-1);
    expect(size.indexOf('data-prop="height"')).toBeLessThan(size.indexOf('data-testid="ratio-lock"'));
  });
});
