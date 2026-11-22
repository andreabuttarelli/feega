import { isEditableAttribute } from '@feega/live-edit/attribute-edit';
import type { Pick } from '../messages';

const DATA_PREFIX = /^data-/;

export const editableAttributes = (attributes: Pick['attributes']) => (attributes ?? []).filter((a) => isEditableAttribute(a.name));

export const attributeLabel = (name: string) => name.replace(DATA_PREFIX, '').replace(/-/g, ' ');
