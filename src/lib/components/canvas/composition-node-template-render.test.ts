import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import CompositionNode from './CompositionNode.svelte';
import { BUILTIN_TEMPLATES, builtinTemplate } from '$lib/motion/template/builtins';
import { FORMAT_OF_ASPECT, composedTemplate, sequentialIds } from '$lib/canvas/composition-template';
import { Target, composeHtml } from '$lib/motion/hyperframes/compose';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { STRIP_TEMPLATE_ID } from '$lib/motion/template/photo-strip/template';
import { newCompositionNodeAt, type CompositionNode as Node, type UpstreamCard } from '$lib/canvas/composition-node';

const base = { ...newCompositionNodeAt({ x: 0, y: 0 }), refId: null, cells: {} } as Node;
const wired: UpstreamCard[] = ['a1', 'a2', 'a3'].map((assetId) => ({ sourceId: `n-${assetId}`, assetId, kind: 'image' }));
const assets = Object.fromEntries(wired.map((c) => [(c as { assetId: string }).assetId, `https://cdn.test/${(c as { assetId: string }).assetId}.jpg`]));

const body = (node: Node, cards: UpstreamCard[] = wired) =>
  render(CompositionNode, { props: { node, cards, assets, templates: BUILTIN_TEMPLATES, composeIn: { project: 'p1', canvas: 'c1' }, onpatch: () => {}, onpickcomponent: () => {} } }).body;

describe('a composition node on a library component', () => {
  const picked: Node = { ...base, template: { id: STRIP_TEMPLATE_ID, values: { captions: 'Rome' } } };

  it('previews the component, and the player page it plays carries the wired images', () => {
    const made = composedTemplate(builtinTemplate(STRIP_TEMPLATE_ID)!, { format: FORMAT_OF_ASPECT[picked.aspect], values: {} }, wired, sequentialIds());
    if (!made.ok) {
      throw new Error(made.error);
    }
    const player = composeHtml({ doc: made.doc, tokens: FEEGA_TOKENS, assets, target: Target.Screen });

    expect(body(picked)).toContain('data-testid="composition-template"');
    expect(player).toContain('https://cdn.test/a1.jpg');
    expect(player).toContain('https://cdn.test/a3.jpg');
  });

  it('previews the component even before anything is wired', () => {
    expect(body(picked, [])).toContain('data-testid="composition-template"');
  });

  it('shows the component text fields to edit in place, with the typed value', () => {
    const html = body(picked);
    const fields = html.slice(html.indexOf('data-testid="composition-fields"'));

    expect(fields).toContain('value="Rome"');
  });

  it('offers to pick a component and to go back to the media layout', () => {
    const html = body(picked);

    expect(html).toContain('data-testid="pick-component"');
    expect(html).toContain('data-testid="clear-component"');
  });
});

describe('a composition node on its own media layout', () => {
  it('still offers the component library, and has nothing to clear', () => {
    const html = body(base);

    expect(html).toContain('data-testid="pick-component"');
    expect(html).not.toContain('data-testid="clear-component"');
    expect(html).not.toContain('data-testid="composition-template"');
  });
});
