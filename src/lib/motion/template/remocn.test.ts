import { describe, expect, it } from 'vitest';
import { REMOCN_PORTS } from '@feega/motion-core/motion/remocn/catalog';
import { snakeKey, PropFormat } from '@feega/motion-core/motion/custom/component';
import { propsOf } from '@feega/motion-core/motion/snapcn/model';
import { FieldType } from '@feega/motion-core/motion/template/field-model';
import { BUILTIN_TEMPLATES } from './builtins';
import { REMOCN_CARDS } from './remocn-cards';
import { REMOCN_PREFIX, REMOCN_TEMPLATES } from './remocn';

const PICKER: Record<string, FieldType> = { [PropFormat.Asset]: FieldType.Asset, [PropFormat.Media]: FieldType.MediaList };

describe('remocn templates', () => {
  it('ships one built-in template and one card per port', () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);

    expect(REMOCN_TEMPLATES.map((t) => t.id).filter((id) => !ids.includes(id))).toEqual([]);
    expect(Object.keys(REMOCN_CARDS)).toHaveLength(REMOCN_PORTS.length);
  });

  it.each(REMOCN_PORTS.map((p) => [p.id, p]))('%s exposes media props with the media pickers', (_, port) => {
    const entry = REMOCN_TEMPLATES.find((t) => t.id === `${REMOCN_PREFIX}${port.id}`)!;
    const types = Object.fromEntries(entry.template.doc.fields.map((f) => [f.key, f.type]));
    const wrong = Object.entries(propsOf(port))
      .filter(([, spec]) => spec.format && spec.format in PICKER)
      .filter(([key, spec]) => types[snakeKey(key)] !== PICKER[spec.format as string])
      .map(([key]) => key);

    expect(wrong).toEqual([]);
  });
});
