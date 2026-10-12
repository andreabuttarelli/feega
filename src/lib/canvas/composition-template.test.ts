import { describe, expect, it } from 'vitest';
import { builtinTemplate } from '$lib/motion/template/builtins';
import { STRIP_TEMPLATE_ID } from '$lib/motion/template/photo-strip/template';
import { templateFields } from '$lib/motion/template/library';
import { FieldType } from '$lib/motion/template/field-model';
import { MotionFormat } from '$lib/motion/doc';
import type { UpstreamCard } from './composition-node';
import { composedTemplate, editedValues, sequentialIds, templateInputs } from './composition-template';

const image = (assetId: string): UpstreamCard => ({ sourceId: `n-${assetId}`, assetId, kind: 'image' });
const video = (assetId: string): UpstreamCard => ({ sourceId: `n-${assetId}`, assetId, kind: 'video' });
const field = (key: string, type: FieldType) => ({ key, type });

describe('templateInputs: wired media fill the template media fields', () => {
  it('a media list takes every wired medium in order, videos marked as videos', () => {
    const inputs = templateInputs([field('media', FieldType.MediaList)], {}, [image('a1'), video('v1'), image('a2')]);

    expect(inputs).toEqual({ media: 'a1,video:v1,a2' });
  });

  it('a single media slot takes the next wired medium, and the list after it the rest', () => {
    const inputs = templateInputs([field('logo', FieldType.Asset), field('media', FieldType.MediaList)], {}, [image('a1'), image('a2'), image('a3')]);

    expect(inputs).toEqual({ logo: 'a1', media: 'a2,a3' });
  });

  it('a motion feeds its poster, and a motion without one feeds nothing', () => {
    const motion: UpstreamCard = { sourceId: 'm1', kind: 'motion', revision: 2, posterAssetId: 'p1' };
    const bare: UpstreamCard = { sourceId: 'm2', kind: 'motion', revision: 1, posterAssetId: null };

    expect(templateInputs([field('media', FieldType.MediaList)], {}, [bare, motion])).toEqual({ media: 'p1' });
  });

  it('typed values pass through; nothing wired leaves the template media as designed', () => {
    const inputs = templateInputs([field('media', FieldType.MediaList), field('captions', FieldType.Text)], { captions: 'Hello' }, []);

    expect(inputs).toEqual({ captions: 'Hello' });
  });
});

describe('composedTemplate: the node read as the template it picked', () => {
  const strip = builtinTemplate(STRIP_TEMPLATE_ID)!;

  it('lays the wired images into the media list and the typed text into its field, at the picked format', () => {
    const made = composedTemplate(strip, { format: MotionFormat.Vertical, values: { captions: 'Lisbon, Porto' } }, [image('a1'), image('a2'), image('a3')], sequentialIds());

    expect(made.ok).toBe(true);
    if (!made.ok) {
      return;
    }
    expect({ width: made.doc.width, height: made.doc.height }).toEqual({ width: 1080, height: 1920 });
    const values = Object.fromEntries(templateFields(made.doc, made.clipId).map((f) => [f.key, f.value]));
    expect(String(values.captions)).toBe('Lisbon, Porto');
    expect(JSON.stringify(values.media)).toContain('a1');
    expect(JSON.stringify(values.media)).toContain('a3');
  });

  it('refuses a value for a field the template does not have', () => {
    const made = composedTemplate(strip, { format: MotionFormat.Square, values: { nope: 'x' } }, [], sequentialIds());

    expect(made.ok).toBe(false);
  });

  it('builds the same document twice, so the preview does not reload on every render', () => {
    const once = composedTemplate(strip, { format: MotionFormat.Square, values: {} }, [], sequentialIds());
    const twice = composedTemplate(strip, { format: MotionFormat.Square, values: {} }, [], sequentialIds());

    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
  });
});

describe('editedValues: what the library detail changed, minus the media the canvas wires', () => {
  it('keeps edited text, drops untouched fields and media', () => {
    const strip = builtinTemplate(STRIP_TEMPLATE_ID)!;
    const made = composedTemplate(strip, { format: MotionFormat.Vertical, values: { captions: 'Rome' } }, [image('a1')], sequentialIds());
    if (!made.ok) {
      throw new Error(made.error);
    }

    expect(editedValues(made)).toEqual({ captions: 'Rome' });
  });
});
