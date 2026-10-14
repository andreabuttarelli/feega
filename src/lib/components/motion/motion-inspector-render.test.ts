import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MotionInspector from './MotionInspector.svelte';
import MultiInspector from './MultiInspector.svelte';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, setTransform } from '$lib/motion/timeline';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { EditMode } from '$lib/motion/edit-mode';
import type { ComponentId } from '$lib/motion/components';

function withClip(component: ComponentId, id: string, doc: MotionDoc = newMotionDoc(MotionFormat.Landscape)): MotionDoc {
  const added = addClip(doc, { component, from: 0 }, id);
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

function inspect(component: ComponentId, mode = EditMode.Motion) {
  const doc = withClip(component, 'c1');
  const clip = findClip(doc, 'c1')!.clip;
  return render(MotionInspector, { props: { doc, clip, tokens: FEEGA_TOKENS, assets: [], frame: 0, mode, onchange: () => {} } }).body;
}

const sections = (html: string) => [...html.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1]);

describe('Properties for one clip', () => {
  it('a title: its name and kind on top, then layout, layer, fill, effects, text, animation in that order', () => {
    const html = inspect('Title');

    expect(html).toMatch(/class="name[^"]*">Better marketing</);
    expect(html).toMatch(/class="kind[^"]*">Title</);
    const order = sections(html).filter((s) => ['layout', 'layer', 'fill', 'effects', 'text', 'animate'].includes(s));
    expect(order).toEqual(['layout', 'layer', 'fill', 'effects', 'text', 'animate']);
  });

  it('a title shows each value with an English label and its unit, never a glyph or a bare ratio', () => {
    const html = inspect('Title');

    expect(html).toContain('>Spacing</span>');
    expect(html).toContain('>em</span>');
    expect(html).toContain('>Offset X</span>');
    expect(html).not.toContain('>ΔX</span>');
    expect(html).not.toContain('>↔</span>');
  });

  it('a title aligns with three icon toggles, not a dropdown', () => {
    const html = inspect('Title');

    expect(html).toContain('data-segmented="Align"');
    expect(html).toContain('aria-label="Align left"');
  });

  it('a colour is a swatch, a hex field and a picker, not a row of brand swatches', () => {
    const html = inspect('Caption');

    expect(html).toContain('data-colour="Box"');
    expect(html).toContain('id="f-background"');
    expect(html).not.toContain('class="swatches');
  });

  it('a title and a shape fill with a layer stack, never the single-colour fields', () => {
    for (const component of ['Title', 'Shape'] as const) {
      const html = inspect(component);
      expect(html).toContain('data-testid="fill-stack"');
      expect(html).not.toContain('id="f-color"');
      expect(html).not.toContain('id="f-fillKind"');
    }
  });

  it('a shape adds stroke and its path, and no text', () => {
    const list = sections(inspect('Shape'));

    expect(list).toEqual(expect.arrayContaining(['fill', 'stroke', 'shape']));
    expect(list).not.toContain('text');
  });

  it('an image has no fill, stroke or text', () => {
    const list = sections(inspect('Image'));

    expect(list).toContain('layout');
    expect(list).not.toContain('fill');
    expect(list).not.toContain('text');
  });

  it('Design mode leaves animation out', () => {
    expect(sections(inspect('Title', EditMode.Design))).not.toContain('animate');
  });

  it('a box value the transform already shows appears once', () => {
    const opacities = inspect('Title').match(/data-field="Opacity"/g) ?? [];

    expect(opacities).toHaveLength(1);
  });
});

describe('Properties for several clips', () => {
  it('shows a shared value as it is and a differing one as Mixed', () => {
    let doc = withClip('Shape', 'b', withClip('Title', 'a'));
    const faded = setTransform(doc, 'a', { opacity: 0.5 });
    doc = faded.ok ? faded.doc : doc;

    const html = render(MultiInspector, { props: { doc, ids: ['a', 'b'], frame: 0, onchange: () => {} } }).body;

    expect(html).toContain('2 layers');
    expect(html).toMatch(/aria-label="Opacity"[^>]*placeholder="Mixed"/);
    expect(html).toMatch(/aria-label="Rotate Z"[^>]*value="0"/);
  });
});
