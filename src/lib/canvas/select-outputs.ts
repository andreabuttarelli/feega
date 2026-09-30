import type { ConnectorType } from './connectors';
import {
  DEFAULT_FIELDS,
  fieldOf,
  isSyncedSourceType,
  SOURCE_ITEM_FIELDS,
  type FieldValue,
  type OutputPort,
  type PostRow,
  type ProductRow,
  type SyncedSourceType
} from './select-sources';

export const OUTPUT_HANDLE_PREFIX = 'out:';
const FIELD_HANDLE_PREFIX = `${OUTPUT_HANDLE_PREFIX}field:`;

export const MAX_CUSTOM_OUTPUTS = 20;
export const MAX_OUTPUT_LABEL = 60;

export type CustomOutput = { id: string; field: string; label?: string };

export type SelectOutput = {
  handle: string;
  label: string;
  port: OutputPort;
  field: string;
  custom: CustomOutput | null;
  incompatible: boolean;
};

export type OutputValue = FieldValue & { port: OutputPort };

const DEFAULT_OUTPUTS = [
  { handle: `${OUTPUT_HANDLE_PREFIX}images`, label: 'Images', port: 'images', slot: 'images' },
  { handle: `${OUTPUT_HANDLE_PREFIX}text`, label: 'Text', port: 'text', slot: 'text' }
] as const;

export function isOutputHandle(handle: unknown): handle is string {
  return typeof handle === 'string' && handle.startsWith(OUTPUT_HANDLE_PREFIX);
}

export const fieldHandle = (field: string) => `${FIELD_HANDLE_PREFIX}${field}`;

export function fieldsFor(sourceType: string | null | undefined) {
  return isSyncedSourceType(sourceType) ? SOURCE_ITEM_FIELDS[sourceType] : [];
}

const knownLabel = (key: string) =>
  Object.values(SOURCE_ITEM_FIELDS)
    .flat()
    .find((f) => f.key === key)?.label ?? key;

function customOutput(sourceType: string | null | undefined, custom: CustomOutput): SelectOutput {
  const field = isSyncedSourceType(sourceType) ? fieldOf(sourceType, custom.field) : null;
  return {
    handle: fieldHandle(custom.field),
    label: custom.label?.trim() || field?.label || knownLabel(custom.field),
    port: field?.port ?? 'text',
    field: custom.field,
    custom,
    incompatible: !field
  };
}

export function selectOutputs(sourceType: string | null | undefined, custom: readonly CustomOutput[]): SelectOutput[] {
  const customs = custom.map((c) => customOutput(sourceType, c));
  if (!isSyncedSourceType(sourceType)) {
    return customs;
  }

  const defaults = DEFAULT_OUTPUTS.map((d) => ({
    handle: d.handle,
    label: d.label,
    port: d.port,
    field: DEFAULT_FIELDS[sourceType][d.slot],
    custom: null,
    incompatible: false
  }));
  return [...defaults, ...customs];
}

type RowFor = { products: ProductRow; social_account_feed: PostRow };

export function outputValues<T extends SyncedSourceType>(
  sourceType: T,
  row: RowFor[T],
  custom: readonly CustomOutput[]
): Record<string, OutputValue> {
  const values: Record<string, OutputValue> = {};
  for (const output of selectOutputs(sourceType, custom)) {
    if (output.incompatible) {
      continue;
    }
    const field = fieldOf(sourceType, output.field)!;
    values[output.handle] = { port: output.port, ...field.extract(row) };
  }
  return values;
}

type OutputTile = { output?: ConnectorType | null; outputs?: readonly SelectOutput[] };

const namedOutput = (tile: OutputTile, handle: string | null | undefined) => tile.outputs?.find((o) => o.handle === handle);

export function portOfHandle(tile: OutputTile, handle: string | null | undefined): ConnectorType | null {
  return namedOutput(tile, handle)?.port ?? tile.output ?? null;
}

export function unavailableOutput(tile: OutputTile, handle: string | null | undefined): boolean {
  return namedOutput(tile, handle)?.incompatible === true;
}

export function addOutput(outputs: CustomOutput[], field: string, newId: () => string): CustomOutput[] {
  if (outputs.some((o) => o.field === field) || outputs.length >= MAX_CUSTOM_OUTPUTS) {
    return outputs;
  }
  return [...outputs, { id: newId(), field }];
}

export function renameOutput(outputs: CustomOutput[], id: string, label: string): CustomOutput[] {
  const trimmed = label.trim().slice(0, MAX_OUTPUT_LABEL);
  return outputs.map((o) => {
    if (o.id !== id) {
      return o;
    }
    const { label: _drop, ...rest } = o;
    return trimmed ? { ...rest, label: trimmed } : rest;
  });
}

export function removeOutput(outputs: CustomOutput[], id: string): CustomOutput[] {
  return outputs.filter((o) => o.id !== id);
}
