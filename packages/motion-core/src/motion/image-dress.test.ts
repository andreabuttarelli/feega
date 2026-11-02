import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from './brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { composeHtml } from './hyperframes/compose';
import { imageRectangle } from './image-dress';

const ASSETS = { photo: 'https://cdn.test/photo.png' };

function framed(props: object): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Square), { component: 'Image', from: 0, props: { assetId: 'photo', x: 0.5, y: 0.5, width: 0.4, height: 0.3, ...props } }, 'img');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

describe('an image with a radius, a fill or a stroke', () => {
  it('is drawn as a rectangle whose first fill is the picture', () => {
    const rect = imageRectangle({ assetId: 'photo', fit: 'cover', roundness: 0.1 });
    expect(rect).toMatchObject({ shape: 'rect', roundness: 0.1 });
    expect((rect!.fills as { type: string; assetId: string }[])[0]).toMatchObject({ type: 'image', assetId: 'photo' });
  });

  it('a plain image stays a picture', () => {
    expect(imageRectangle({ assetId: 'photo', fit: 'cover' })).toBeNull();
  });

  it('the HTML render rounds it like a shape', () => {
    expect(composeHtml({ doc: framed({ roundness: 0.1 }), tokens: FEEGA_TOKENS, assets: ASSETS })).toContain('id="sh-img"');
    expect(composeHtml({ doc: framed({}), tokens: FEEGA_TOKENS, assets: ASSETS })).not.toContain('id="sh-img"');
  });
});
