import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MotionNode from './MotionNode.svelte';
import { MotionFormat } from '$lib/motion/doc';
import { FrameKind } from '$lib/canvas/motion-node';

const node = { id: 'n1', format: MotionFormat.Landscape, docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, kind: FrameKind.Frame };

function openLink(onopen: (() => void) | null): string {
  const body = render(MotionNode, { props: { node, href: '/p/p1/c/c1/motion/n1', previewUrl: '/preview', onopen } }).body;
  return body.match(/<a[^>]*data-testid="open-motion-editor"[^>]*>/)?.[0] ?? '';
}

describe('Open editor sul nodo motion', () => {
  it('quando apre l’editor sulla tela non precarica anche la pagina intera: un tocco, una sessione', () => {
    expect(openLink(() => undefined)).toContain('data-sveltekit-preload-data="off"');
  });

  it('quando porta alla pagina dell’editor la precarica come ogni altro link', () => {
    expect(openLink(null)).not.toContain('data-sveltekit-preload-data="off"');
  });
});
