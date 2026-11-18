import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PrototypePlayer from './PrototypePlayer.svelte';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';

const frame = { id: 'f1', name: 'Landing', live: { doc: newMotionDoc(MotionFormat.Landscape), tokens: { colors: {}, fonts: {} } as never, assets: {} } };
const html = (onclose?: () => void) => render(PrototypePlayer, { props: { frames: [frame] as never, start: 'f1', onclose } }).body;

describe('prototype player chrome', () => {
  it('names the frame and offers one device control', () => {
    const body = html();
    expect(body).toContain('Landing');
    for (const name of ['Desktop', 'Tablet', 'Phone', 'Restart', 'Zoom']) {
      expect(body, name).toContain(`aria-label="${name}"`);
    }
  });

  it('drops the old segmented bars', () => {
    expect(html()).not.toContain('>Fill width<');
  });

  it('shows Close only when the player can close', () => {
    expect(html(() => {})).toContain('aria-label="Close"');
    expect(html()).not.toContain('aria-label="Close"');
  });
});
