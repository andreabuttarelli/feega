import { describe, expect, it } from 'vitest';
import { HF_PORTS } from '@feega/motion-core/motion/hyperframes/catalog';
import { snakeKey, PropFormat } from '@feega/motion-core/motion/custom/component';
import { propsOf } from '@feega/motion-core/motion/hyperframes/model';
import { FieldType } from '@feega/motion-core/motion/template/field-model';
import { HF_PREFIX, HF_TEMPLATES } from './hyperframes';

const PICKER: Record<string, FieldType> = { [PropFormat.Asset]: FieldType.Asset, [PropFormat.Media]: FieldType.MediaList };

describe('hyperframes templates expose media props with the media pickers', () => {
  it.each(HF_PORTS.map((p) => [p.id, p]))('%s', (_, port) => {
    const entry = HF_TEMPLATES.find((t) => t.id === `${HF_PREFIX}${port.id}`)!;
    const types = Object.fromEntries(entry.template.doc.fields.map((f) => [f.key, f.type]));
    const wrong = Object.entries(propsOf(port))
      .filter(([, spec]) => spec.format && spec.format in PICKER)
      .filter(([key, spec]) => types[snakeKey(key)] !== PICKER[spec.format as string])
      .map(([key]) => key);

    expect(wrong).toEqual([]);
  });
});
