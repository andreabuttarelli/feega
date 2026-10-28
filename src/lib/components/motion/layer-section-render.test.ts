import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import type { ComponentId } from '@feega/motion-core/motion/components';
import MotionInspector from './MotionInspector.svelte';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function inspect(component: ComponentId, props: Record<string, unknown> = {}, doc?: MotionDoc) {
  const shown = doc ?? must(addClip(newMotionDoc(MotionFormat.Landscape), { component, from: 0, props }, 'c1'));
  const clip = findClip(shown, 'c1')!.clip;
  return render(MotionInspector, { props: { doc: shown, clip, tokens: FEEGA_TOKENS, assets: [], frame: 0, onchange: () => {} } }).body;
}

const layer = (html: string) => html.slice(html.indexOf('data-section="layer"'), html.indexOf('</section>', html.indexOf('data-section="layer"')));

describe('the Layer section', () => {
  it('gives blend its own labelled row and opacity one control, never a slider plus a duplicate field', () => {
    const html = layer(inspect('Title'));
    const look = html.split('data-testid="layer-look"')[1]?.split('</div>')[0] ?? '';
    expect(look).toContain('>Blend</label>');
    expect(look).toContain('data-testid="blend-select"');
    expect(html).toContain('data-testid="opacity-field"');
    expect(html).not.toContain('data-testid="opacity-slider"');
    expect(html).not.toMatch(/type="range"/);
  });

  it('flips a layer horizontally and vertically', () => {
    const html = inspect('Shape', { shape: 'rect' });
    expect(html).toContain('data-testid="flip-horizontal"');
    expect(html).toContain('data-testid="flip-vertical"');
  });

  it('a rectangle has corner smoothing beside its radius', () => {
    expect(layer(inspect('Shape', { shape: 'rect' }))).toContain('data-prop="smoothing"');
    expect(layer(inspect('Shape', { shape: 'ellipse' }))).not.toContain('data-prop="smoothing"');
  });

  it('radius is one value until split per corner', () => {
    const uniform = layer(inspect('Shape', { shape: 'rect', roundness: 0.1 }));
    expect(uniform).toContain('data-testid="radius-per-corner"');
    expect(uniform).not.toContain('data-testid="corners"');
    expect(layer(inspect('Shape', { shape: 'rect', corners: [0.1, 0, 0, 0] }))).toContain('data-testid="corners"');
  });

  it('a layer with children can clip them, as a Yes / No', () => {
    let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, props: { shape: 'rect' } }, 'c1'));
    doc = must(addClip(doc, { component: 'Title', from: 0 }, 'kid'));
    doc = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'kid' ? { ...c, parent: 'c1' } : c)) })) };
    expect(layer(inspect('Shape', {}, doc))).toMatch(/data-segmented="Clip content"[\s\S]*?>Yes<[\s\S]*?>No</);
    expect(layer(inspect('Shape', { shape: 'rect' }))).not.toContain('data-segmented="Clip content"');
  });
});

describe('booleans in Properties', () => {
  it('read as a toggle button, never a bare checkbox', () => {
    const html = inspect('Title');
    expect(html).toContain('data-testid="text-italic"');
    expect(html).not.toContain('id="f-italic"');
  });
});
