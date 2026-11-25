import { isEditableAttribute } from '@feega/live-edit/attribute-edit';
import type { Pick } from '../messages';

const LABEL_PREFIX = /^(?:data-|--)/;

const OPTIONS_SUFFIX = '-options';

export type AttributeField = { name: string; value: string; options: string[] };

const listed = (text: string) => text.split(',').map((o) => o.trim()).filter(Boolean);

function optionsOf(all: NonNullable<Pick['attributes']>, name: string, value: string): string[] {
  const list = all.find((a) => a.name === name + OPTIONS_SUFFIX);
  if (!list) {
    return [];
  }

  const options = listed(list.value);
  return options.includes(value) ? options : [value, ...options];
}

export function editableAttributes(attributes: Pick['attributes']): AttributeField[] {
  const all = attributes ?? [];
  const lists = new Set(all.map((a) => a.name + OPTIONS_SUFFIX));

  return all
    .filter((a) => isEditableAttribute(a.name) && !lists.has(a.name))
    .map((a) => ({ name: a.name, value: a.value, options: optionsOf(all, a.name, a.value) }));
}

export const attributeLabel = (name: string) => name.replace(LABEL_PREFIX, '').replace(/-/g, ' ');
