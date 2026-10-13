import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import DocFields from './DocFields.svelte';
import { AssetKind } from '$lib/motion/components';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { insertTemplate } from '$lib/motion/template/library';
import { MEDIA_CLOUD_TEMPLATE } from '$lib/motion/template/media-cloud/template';

const PICTURE = { id: 'a1', kind: AssetKind.Image, label: 'Picture', previewUrl: '/a1.png' };

describe('the doc fields of a video started from a media component', () => {
  it('renders when the media list is still the empty text the component starts with', () => {
    let n = 0;
    const placed = insertTemplate(newMotionDoc(MotionFormat.Landscape), MEDIA_CLOUD_TEMPLATE, { from: 0, newId: () => `i${++n}` });
    if (!placed.ok) {
      throw new Error(placed.error);
    }

    const body = render(DocFields, { props: { doc: placed.doc, assets: [PICTURE], onchange: () => {} } }).body;

    expect(body).toContain('Pictures and videos');
    expect(body).toContain('/a1.png');
  });
});
