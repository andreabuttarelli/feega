import { describe, expect, it } from 'vitest';
import { parseMotionDoc, type MotionClip } from '@feega/motion-core/motion/doc';
import { FIGMA_FILE_KEY, figmaClipWithImage } from '../../../../tests/fixtures/figma/image-clip';
import { figmaPlan } from './figma-doc';
import { imagesFilled } from './images';

const HASH = 'ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12';

let n = 0;
const newId = () => `id${++n}`;

type Tracked = { tracks: { clips: unknown[] }[]; comps: Record<string, { tracks: { clips: unknown[] }[] }> };
const clipsOf = (doc: Tracked) => [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);

const pasted = () => figmaPlan(figmaClipWithImage(HASH), newId)!;

describe('Figma image fills keep their place until the image arrives', () => {
  it('remembers the file and which clip waits for which image', () => {
    const plan = pasted();
    const [item] = plan.items;

    expect(plan.fileKey).toBe(FIGMA_FILE_KEY);
    expect(item.images.map((i) => i.hash)).toEqual([HASH]);
    expect(plan.skipped.join(' ')).toContain('placed as a placeholder');
  });

  it('swaps the placeholder for an image fill, even inside a group', () => {
    const [item] = pasted().items;
    const waiting = item.images[0];

    const filled = imagesFilled(item.doc, item.images, { [HASH]: 'asset-1' });

    expect(parseMotionDoc(filled).ok).toBe(true);
    const clip = clipsOf(filled).find((c) => c.id === waiting.clipId);
    expect(clip?.props.fills).toMatchObject([{ type: 'image', assetId: 'asset-1', fit: 'cover' }]);
  });

  it('leaves a placeholder whose image did not come', () => {
    const [item] = pasted().items;

    expect(imagesFilled(item.doc, item.images, {})).toEqual(item.doc);
  });
});
