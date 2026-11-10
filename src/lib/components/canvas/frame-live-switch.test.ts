import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MotionNode from './MotionNode.svelte';
import { MotionFormat } from '@feega/motion-core/motion/doc';
import { FrameKind } from '$lib/canvas/motion-node';
import { LiveHost } from '$lib/canvas/frame-live';
import { frameLive } from '$lib/canvas/frame-live.svelte';

const node = (interactive: boolean) => ({ id: 'n1', format: MotionFormat.Landscape, docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, kind: FrameKind.Frame, interactive });
const shown = (interactive: boolean, liveHost: LiveHost) => render(MotionNode, { props: { node: node(interactive), href: '/p/p1/c/c1/motion/n1', previewUrl: '/preview', liveHost } }).body;

describe('the Play switch above a frame', () => {
  it('is on an interactive frame only', () => {
    expect(shown(true, LiveHost.Node)).toContain('data-testid="frame-live-switch"');
    expect(shown(false, LiveHost.Node)).not.toContain('frame-live-switch');
  });

  it('is drawn by the GPU canvas, not twice by the node, when the canvas owns it', () => {
    expect(shown(true, LiveHost.Canvas)).not.toContain('frame-live-switch');
  });

  it('plays a frame that is not interactive once Play on canvas turns it on', () => {
    frameLive.toggle('n1');
    expect(shown(false, LiveHost.Node)).toContain('data-testid="frame-live"');
    frameLive.stop();
  });
});
