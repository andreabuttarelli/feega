import { offsetOf, type LiveAt } from './class-patch';
import type { StringLiteral } from './data-source';
import type { ReadFile } from './files';
import { loopArray, loopsAt, piecesOf, type ArrayLiteral, type LoopHead, type Piece, type Refused } from './loop-array';
import { hiddenOut } from './move-node';

const WRAPPER = /^\{\{?|\}?\}$/g;
const DISPLAY_TRANSFORMS = /(?:\.(?:toLowerCase|toUpperCase|trim)\(\))+$/;
const MEMBER = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/;
const PLAIN_NAME = /^[A-Za-z_$][\w$]*$/;
const STRING_LITERAL = /^(['"`])((?:\\.|(?!\1)[^\\])*)\1(?:\s+as\s+const)?$/;
const PROPERTY = /^(?:(['"])([^'"]+)\1|([A-Za-z_$][\w$]*))\s*(:)?\s*/;
const BINDING = /^(?:(['"])([^'"]+)\1|([A-Za-z_$][\w$]*))\s*(?::\s*([A-Za-z_$][\w$]*))?$/;
const WHOLE_ENTRY = '';
const SHOWN_LENGTH = 40;

const NO_POSITION = 'no position of the item given';
const OUTSIDE = 'the item is outside the array';
const NOT_OBJECT = 'the entry is not an object literal: edit it in the data source';

const VALUE_REFUSALS: { applies: RegExp; reason: (field: string, value: string) => string }[] = [
  { applies: PLAIN_NAME, reason: (field, value) => `\`${field}\` of this item is the constant \`${value}\`, not a string literal: edit it where it is declared` },
  { applies: /./, reason: (field, value) => `\`${field}\` of this item is \`${value.slice(0, SHOWN_LENGTH)}\`, an expression, not a string literal` }
];

const shown = (field: string) => field || 'the entry';

function bindingsOf(item: string): Map<string, string> {
  const bindings = new Map<string, string>();
  if (item.startsWith('{')) {
    for (const part of item.slice(1, -1).split(',')) {
      const found = part.trim().match(BINDING);
      if (found) {
        bindings.set(found[4] ?? found[3] ?? found[2], found[3] ?? found[2]);
      }
    }
  }
  return bindings;
}

function fieldOf(head: LoopHead, expression: string): string | null {
  if (expression === head.item) {
    return WHOLE_ENTRY;
  }

  const member = expression.match(MEMBER);
  if (member && member[1] === head.item) {
    return member[2];
  }
  return bindingsOf(head.item).get(expression) ?? null;
}

function propertyIn(array: ArrayLiteral, entry: Piece, field: string): Piece | Refused {
  const props = array.text[entry.start] === '{' ? piecesOf(array.text, entry.start) : null;
  if (!props) {
    return { reason: NOT_OBJECT };
  }

  const found = props.find((p) => {
    const named = array.text.slice(p.start, p.end).match(PROPERTY);
    return (named?.[2] ?? named?.[3]) === field;
  });
  return found ?? { reason: `the entry has no \`${field}\`` };
}

function valueSpan(array: ArrayLiteral, entry: Piece, field: string): Piece | Refused {
  if (field === WHOLE_ENTRY) {
    return entry;
  }

  const prop = propertyIn(array, entry, field);
  if ('reason' in prop) {
    return prop;
  }

  const head = array.text.slice(prop.start, prop.end).match(PROPERTY)!;
  if (!head[4]) {
    return { reason: `\`${field}\` of this item is a shorthand reference, not a string literal` };
  }
  return { start: prop.start + head[0].length, end: prop.end };
}

const KEY_SUFFIX = ' copy';

function literalAt(array: ArrayLiteral, span: Piece, field: string): StringLiteral | Refused {
  const value = array.text.slice(span.start, span.end).trim();
  const found = value.match(STRING_LITERAL);
  if (!found || (found[1] === '`' && found[2].includes('${'))) {
    return { reason: VALUE_REFUSALS.find((r) => r.applies.test(value))!.reason(shown(field), value) };
  }

  const start = span.start + array.text.slice(span.start).indexOf(found[1]) + 1;
  return { path: array.path, text: array.text, start, end: start + found[2].length, quote: found[1], value: found[2] };
}

export function keyedCopy(array: ArrayLiteral, index: number, head: LoopHead): string {
  const entry = array.pieces[index];
  const text = array.text.slice(entry.start, entry.end);
  const field = head.key === undefined ? null : fieldOf(head, head.key);
  const span = field === null ? null : valueSpan(array, entry, field);
  const literal = field === null || span === null || 'reason' in span ? null : literalAt(array, span, field);
  if (!literal || 'reason' in literal) {
    return text;
  }

  const at = literal.end - entry.start;
  return text.slice(0, at) + KEY_SUFFIX + text.slice(at);
}

export async function loopLiteral(read: ReadFile, at: LiveAt, instance: number | undefined, raw: string): Promise<StringLiteral | Refused | null> {
  const source = await read(at.file);
  if (source === null) {
    return null;
  }

  const expression = raw.replace(WRAPPER, '').trim().replace(DISPLAY_TRANSFORMS, '');
  const heads = loopsAt(hiddenOut(source), offsetOf(source, at));
  const field = heads.length === 1 ? fieldOf(heads[0], expression) : null;
  if (field === null) {
    return null;
  }
  if (instance === undefined) {
    return { reason: NO_POSITION, at };
  }

  const found = await loopArray(read, at);
  if ('reason' in found) {
    return found;
  }

  const entry = found.array.pieces[instance];
  if (!entry) {
    return { reason: OUTSIDE, at };
  }

  const span = valueSpan(found.array, entry, field);
  return 'reason' in span ? span : literalAt(found.array, span, field);
}
