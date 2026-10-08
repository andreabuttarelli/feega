import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MotionTimeline from './MotionTimeline.svelte';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import type { ComponentId } from '$lib/motion/components';
import { addClip } from '$lib/motion/timeline';
import { Snap } from '$lib/motion/timeline-view';

function withClip(doc: MotionDoc, component: ComponentId, assetId: string): MotionDoc {
  const result = addClip(doc, { component, from: 0, durationInFrames: 60, props: { assetId } }, `clip-${assetId}`);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

const html = (component: ComponentId, waveforms: Record<string, number[]> = {}) =>
  render(MotionTimeline, {
    props: {
      doc: withClip(newMotionDoc(MotionFormat.Landscape), component, 'a1'),
      snap: Snap.Off,
      waveforms,
      assetUrls: { a1: 'https://cdn.test/a1' },
      onchange: () => {}
    }
  }).body;

const bar = (body: string) => body.slice(body.indexOf('data-clip-id="clip-a1"'));

describe('timeline clip previews', () => {
  it('an audio clip draws its waveform inside the bar', () => {
    expect(bar(html('Audio', { a1: [0.2, 1, 0.5] }))).toMatch(/class="wave[ "]/);
  });

  it('an image clip shows its picture behind the label', () => {
    expect(bar(html('Image'))).toMatch(/class="thumbs[ "][^>]*https:\/\/cdn\.test\/a1/);
  });

  it('a video clip carries a filmstrip', () => {
    expect(bar(html('Video'))).toMatch(/class="strip[ "]/);
  });
});
