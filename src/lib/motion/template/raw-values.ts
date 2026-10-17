import { FieldType, type ExposedField } from './fields';

type Slot = { assetId: string; kind?: string; aspect?: string; ratio?: number; fit?: string };

const FREE_ASPECT = 'free';

function slotText(slot: Slot): string {
  const id = slot.kind === 'video' ? `video:${slot.assetId}` : slot.assetId;
  const aspect = slot.aspect === FREE_ASPECT ? slot.ratio : slot.aspect;
  const shape = aspect === undefined ? '' : `@${aspect}${slot.fit ? `/${slot.fit}` : ''}`;
  return `${id}${shape}`;
}

const AS_TEXT = (value: unknown) => (value === null || value === undefined ? '' : String(value));

const RAW: Record<FieldType, (value: unknown) => string> = {
  [FieldType.Text]: AS_TEXT,
  [FieldType.Number]: AS_TEXT,
  [FieldType.Color]: AS_TEXT,
  [FieldType.Asset]: AS_TEXT,
  [FieldType.Select]: AS_TEXT,
  [FieldType.Boolean]: (value) => (value ? 'yes' : 'no'),
  [FieldType.MediaList]: (value) => (Array.isArray(value) ? (value as Slot[]).map(slotText).join(', ') : '')
};

export const rawOf = (field: Pick<ExposedField, 'type'>, value: unknown): string => RAW[field.type](value);

type Valued = Pick<ExposedField, 'key' | 'type'> & { value: unknown };

export function changedRaw(fresh: readonly Valued[], edited: readonly Valued[]): Record<string, string> {
  const before = new Map(fresh.map((f) => [f.key, JSON.stringify(f.value ?? null)]));
  return Object.fromEntries(edited.filter((f) => before.get(f.key) !== JSON.stringify(f.value ?? null)).map((f) => [f.key, rawOf(f, f.value)]));
}
