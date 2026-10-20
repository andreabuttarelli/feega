import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MotionNode from './MotionNode.svelte';
import { NodeMode } from '$lib/canvas/inline-motion';
import type { MotionNode as Node } from '$lib/canvas/motion-node';

const node = { id: 'm1', format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, kind: 'frame' } as unknown as Node;

const html = (nodeMode: NodeMode, posterUrl: string | null) => render(MotionNode, { props: { node, href: '/e', previewUrl: '/p', posterUrl, nodeMode } }).body;

describe('a frame opening in the editor', () => {
  it('with no stored poster shows a neutral skeleton, not a black stage', () => {
    expect(html(NodeMode.Edit, null)).toContain('data-testid="motion-node-skeleton"');
  });

  it('with a stored poster keeps showing it', () => {
    const body = html(NodeMode.Edit, '/assets/poster');

    expect(body).toContain('data-testid="motion-node-poster"');
    expect(body).not.toContain('motion-node-skeleton');
  });
});

describe('an empty frame on the canvas', () => {
  it('is its bare stage: no empty-state icon, no label, no buttons', () => {
    const body = html(NodeMode.Preview, null);

    expect(body).toContain('data-testid="motion-node-stage"');
    expect(body).not.toContain('class="empty');
    expect(body).not.toContain('<svg');
    expect(body).not.toContain('<button');
  });
});

describe('a free element on the canvas', () => {
  const element = { ...node, kind: 'element' } as unknown as Node;
  const body = (posterUrl: string | null) => render(MotionNode, { props: { node: element, href: '/e', previewUrl: '/p', posterUrl, nodeMode: NodeMode.Preview } }).body;

  it('is only its picture: no play bar, no Open editor, no clapperboard', () => {
    const shown = body(null);

    expect(shown).not.toContain('Open editor');
    expect(shown).not.toContain('aria-label="Play"');
    expect(shown).toContain('data-testid="element-placeholder"');
    expect(shown).toContain('data-kind="element"');
  });

  it('shows its poster once it has one', () => {
    expect(body('/assets/poster')).toContain('data-testid="motion-node-poster"');
  });
});
