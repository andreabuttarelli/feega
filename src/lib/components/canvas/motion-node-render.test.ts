import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MotionNode from './MotionNode.svelte';
import { NodeMode } from '$lib/canvas/inline-motion';
import type { MotionNode as Node } from '$lib/canvas/motion-node';

const node = { id: 'm1', format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } as unknown as Node;

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
