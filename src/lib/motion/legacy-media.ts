import { PropFormat, type PropSpec } from './custom/component';
import { FieldType } from './template/field-model';

type Raw = Record<string, unknown>;
type LegacyHint = { hint: RegExp; media: Pick<PropSpec, 'format' | 'assetKind'> };

const LEGACY_MEDIA_HINTS: readonly LegacyHint[] = [
  { hint: /\s*\(asset id or link\)/, media: { format: PropFormat.MediaItem, assetKind: 'image' } },
  { hint: /\s*\(id or link[^)]*\)/, media: { format: PropFormat.MediaItem } }
];

const hintIn = (text: unknown) => (typeof text === 'string' ? LEGACY_MEDIA_HINTS.find((l) => l.hint.test(text)) : undefined);

function pickerSpec(spec: Raw): Raw {
  const legacy = spec.type === 'string' && !spec.format ? hintIn(spec.title) : undefined;
  return legacy ? { ...spec, ...legacy.media, title: String(spec.title).replace(legacy.hint, '') } : spec;
}

function pickerField(field: Raw): Raw {
  const legacy = field.type === FieldType.Text ? hintIn(field.label) : undefined;
  return legacy ? { ...field, type: FieldType.Asset, label: String(field.label).replace(legacy.hint, '') } : field;
}

const isRaw = (value: unknown): value is Raw => !!value && typeof value === 'object';

const valuesMapped = (value: unknown, map: (item: Raw) => Raw): unknown => (isRaw(value) ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, isRaw(item) ? map(item) : item])) : value);

const pickerComponent = (component: Raw): Raw => (isRaw(component.propsSchema) ? { ...component, propsSchema: { ...component.propsSchema, properties: valuesMapped(component.propsSchema.properties, pickerSpec) } } : component);

export function withMediaPickers<T extends Raw>(doc: T): T {
  return {
    ...doc,
    ...(doc.components ? { components: valuesMapped(doc.components, pickerComponent) } : {}),
    ...(Array.isArray(doc.fields) ? { fields: doc.fields.map((f) => (isRaw(f) ? pickerField(f) : f)) } : {})
  };
}
