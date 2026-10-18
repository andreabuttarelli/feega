import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MotionNode from './MotionNode.svelte';
import { MotionFormat } from '$lib/motion/doc';
import { FrameKind } from '$lib/canvas/motion-node';

const node = { id: 'n1', format: MotionFormat.Landscape, docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, kind: FrameKind.Frame };

describe('tile di un frame', () => {
  it('non mostra Open editor: il frame si apre con doppio clic o Invio', () => {
    const body = render(MotionNode, { props: { node, href: '/p/p1/c/c1/motion/n1', previewUrl: '/preview' } }).body;
    expect(body).not.toContain('Open editor');
    expect(body).not.toContain('open-motion-editor');
  });
});
