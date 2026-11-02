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

  it('puts the resizing control above W/H in Layout, not in advanced type', () => {
    const html = inspect({ sizing: 'auto-height' });
    const resize = html.indexOf('data-testid="text-resizing"');

    expect(resize).toBeGreaterThan(-1);
    expect(resize).toBeLessThan(html.indexOf('data-testid="size-row"'));
    expect(html.indexOf('data-testid="text-resizing"')).toBeLessThan(html.indexOf('data-testid="text-aligns"'));
  });

  it.each([
    ['auto', 'Hug', 'Hug'],
    ['auto-height', 'Fixed', 'Hug'],
    ['fixed', 'Fixed', 'Fixed']
  ])('labels W/H per resizing %s', (sizing, width, height) => {
    const html = inspect({ sizing });

    expect(html.split('data-prop="width"')[1]?.split('data-prop="height"')[0]).toContain(`data-mode="${width}"`);
    expect(html.split('data-prop="height"')[1]?.split('data-testid="ratio-lock"')[0]).toContain(`data-mode="${height}"`);
  });

  it('offers font size presets beside the size field', () => {
    const presets = inspect({}).split('data-testid="size-presets"')[1]?.split('</select>')[0] ?? '';

    expect([...presets.matchAll(/<option value="(\d+)"/g)].map((m) => Number(m[1]))).toEqual([12, 14, 16, 20, 24, 32, 48, 64, 96]);
  });
});
