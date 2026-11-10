import { describe, expect, it } from 'vitest';
import { SNAPCN_PORTS } from '@feega/motion-core/motion/snapcn/catalog';
import { snakeKey, PropFormat } from '@feega/motion-core/motion/custom/component';
import { propsOf } from '@feega/motion-core/motion/snapcn/model';
import { FieldType } from '@feega/motion-core/motion/template/field-model';
import { SNAPCN_PREFIX, SNAPCN_TEMPLATES } from './snapcn';

const PICKER: Record<string, FieldType> = { [PropFormat.Asset]: FieldType.Asset, [PropFormat.Media]: FieldType.MediaList };

describe('snapcn templates expose media props with the media pickers', () => {
  it.each(SNAPCN_PORTS.map((p) => [p.id, p]))('%s', (_, port) => {
    const entry = SNAPCN_TEMPLATES.find((t) => t.id === `${SNAPCN_PREFIX}${port.id}`)!;
    const types = Object.fromEntries(entry.template.doc.fields.map((f) => [f.key, f.type]));
    const wrong = Object.entries(propsOf(port))
      .filter(([, spec]) => spec.format && spec.format in PICKER)
      .filter(([key, spec]) => types[snakeKey(key)] !== PICKER[spec.format as string])
      .map(([key]) => key);

    expect(wrong).toEqual([]);
  });
});
