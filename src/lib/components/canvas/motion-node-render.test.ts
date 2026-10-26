import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MotionNode from './MotionNode.svelte';
import type { MotionNode as Node } from '$lib/canvas/motion-node';

const node = { id: 'm1', format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, kind: 'frame' } as unknown as Node;

const html = (posterUrl: string | null) => render(MotionNode, { props: { node, href: '/e', previewUrl: '/p', posterUrl } }).body;

describe('an empty frame on the canvas', () => {
  it('is its bare stage: no empty-state icon, no label, no buttons', () => {
    const body = html(null);

    expect(body).toContain('data-testid="motion-node-stage"');
    expect(body).not.toContain('class="empty');
    expect(body).not.toContain('<svg');
    expect(body).not.toContain('<button');
  });
});

describe('a free element on the canvas', () => {
  const element = { ...node, kind: 'element' } as unknown as Node;
  const body = (posterUrl: string | null) => render(MotionNode, { props: { node: element, href: '/e', previewUrl: '/p', posterUrl } }).body;

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
