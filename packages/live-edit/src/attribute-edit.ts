import { offsetOf, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import type { TextWritten } from './literal-text';
import { Delimiter, attributesOf, tagNameAt, type Attribute } from './open-tag';
import { setAttributes } from './set-attributes';

const EDITABLE = /^(data-[\w-]+|src|alt|title|aria-label|placeholder|poster)$/;
const BOOKKEEPING = /^data-feega/;
const BOUND_PREFIX = /^(?::|v-bind:)/;
const PLAIN_LITERAL = /^\s*(?:(['"`])[^'"`$\\]*\1|-?\d+(?:\.\d+)?)\s*$/;

export const isEditableAttribute = (name: string) => EDITABLE.test(name) && !BOOKKEEPING.test(name);

const named = (attributes: Attribute[], name: string) => attributes.filter((a) => a.name.replace(BOUND_PREFIX, '') === name);

function isLiteral(attribute: Attribute): boolean {
  if (BOUND_PREFIX.test(attribute.name) || attribute.delimiter === Delimiter.Shorthand) {
    return false;
  }
  return attribute.delimiter !== Delimiter.Brace || PLAIN_LITERAL.test(attribute.value ?? '');
}

export async function attributeWrite(read: ReadFile, at: LiveAt, name: string, value: string): Promise<TextWritten> {
  if (!isEditableAttribute(name)) {
    return { ok: false, reason: `${name} is not edited from here` };
  }
  const text = await read(at.file);
  const start = text === null ? -1 : offsetOf(text, at);
  if (text === null || start < 0 || text[start] !== '<' || !tagNameAt(text, start)) {
    return { ok: false, reason: `${at.file}:${at.line}: the element is not where the page says`, at };
  }
  if (!named(attributesOf(text, start), name).every(isLiteral)) {
    return { ok: false, reason: `${name} comes from an expression: edit it where it is declared`, at };
  }
  return setAttributes(read, at, { [name]: value });
}
