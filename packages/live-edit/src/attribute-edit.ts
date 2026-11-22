import { offsetOf, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import type { TextWritten } from './literal-text';
import { Delimiter, attributesOf, removeAttribute, tagNameAt, type Attribute } from './open-tag';
import { setAttributes } from './set-attributes';

const EDITABLE = /^(data-[\w-]+|src|srcset|sizes|alt|title|aria-label|placeholder|poster)$/;
const BOOKKEEPING = /^data-feega/;
const BOUND_PREFIX = /^(?::|v-bind:)/;
const IMAGE_SOURCE = 'src';
const SHADOWING_SOURCE = ['srcset', 'sizes'];
const PLAIN_LITERAL = /^\s*(?:(['"`])[^'"`$\\]*\1|-?\d+(?:\.\d+)?)\s*$/;

export const isEditableAttribute = (name: string) => EDITABLE.test(name) && !BOOKKEEPING.test(name);

const named = (attributes: Attribute[], name: string) => attributes.filter((a) => a.name.replace(BOUND_PREFIX, '') === name);

function isLiteral(attribute: Attribute): boolean {
  if (BOUND_PREFIX.test(attribute.name) || attribute.delimiter === Delimiter.Shorthand) {
    return false;
  }
  return attribute.delimiter !== Delimiter.Brace || PLAIN_LITERAL.test(attribute.value ?? '');
}

function withoutAttributes(text: string, start: number, names: string[]): string {
  return names.reduce((current, name) => named(attributesOf(current, start), name).reduceRight(removeAttribute, current), text);
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
  if (name !== IMAGE_SOURCE) {
    return setAttributes(read, at, { [name]: value });
  }
  const shadowing = SHADOWING_SOURCE.find((other) => !named(attributesOf(text, start), other).every(isLiteral));
  if (shadowing) {
    return { ok: false, reason: `${shadowing} comes from an expression and would keep the old image: edit it where it is declared`, at };
  }
  const written = await setAttributes(read, at, { [name]: value });
  return written.ok ? { ok: true, change: { ...written.change, after: withoutAttributes(written.change.after, start, SHADOWING_SOURCE) } } : written;
}
