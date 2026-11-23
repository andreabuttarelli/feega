export type ClassSlot = { start: number; end: number; quotes: string[]; interpolated: boolean };

const BRACE_ATTR = /\s(?:class|className)=\{/;
const BOUND_ATTR = /\s(?::class|v-bind:class)=(["'])/;
const INTERPOLATED_ATTR = /\sclass=(["'])([^"'{}]*)\{/;
const QUOTES = ['"', "'", '`'];
const OPENERS = '([';
const BEFORE_STANDALONE = ['', '(', '[', ','];
const AFTER_STANDALONE = ['', ',', ')', ']'];
const MAX_DEPTH = 1;
const INTERPOLATION = '${';
const EXPRESSION_OPEN = '{';
const EXPRESSION_CLOSE = '}';

export const hasInterpolatedClass = (open: string) => /\s(?:class|className)=(?:\{|"[^"]*\{|'[^']*\{)/.test(open);

function closingOf(text: string, from: number): number {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (QUOTES.includes(ch)) {
      const end = literalEnd(text, i);
      if (end < 0) {
        return -1;
      }
      i = end;
      continue;
    }
    depth += ch === EXPRESSION_OPEN ? 1 : ch === EXPRESSION_CLOSE ? -1 : 0;
    if (depth < 0) {
      return i;
    }
  }
  return -1;
}

function literalEnd(text: string, start: number): number {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
      continue;
    }
    if (quote === '`' && text.startsWith(INTERPOLATION, i)) {
      const end = closingOf(text, i + INTERPOLATION.length);
      if (end < 0) {
        return -1;
      }
      i = end;
      continue;
    }
    if (text[i] === quote) {
      return i;
    }
  }
  return -1;
}

const around = (text: string, index: number, step: -1 | 1): string => {
  for (let i = index; i >= 0 && i < text.length; i += step) {
    if (!/\s/.test(text[i])) {
      return text[i];
    }
  }
  return '';
};

function slotOf(expr: string, base: number, start: number, end: number): ClassSlot | null {
  const quote = expr[start];
  const cut = quote === '`' ? expr.indexOf(INTERPOLATION, start) : -1;
  const staticEnd = cut > start && cut < end ? cut : end;
  const interpolated = staticEnd !== end;
  const staticText = expr.slice(start + 1, staticEnd);
  if (interpolated && !/\s$/.test(staticText)) {
    return null;
  }
  return { start: base + start + 1, end: base + staticEnd, quotes: [quote], interpolated };
}

function literalIn(expr: string, base: number): ClassSlot | null {
  const openers: string[] = [];
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (QUOTES.includes(ch)) {
      const end = literalEnd(expr, i);
      if (end < 0) {
        return null;
      }
      const alone = BEFORE_STANDALONE.includes(around(expr, i - 1, -1)) && AFTER_STANDALONE.includes(around(expr, end + 1, 1));
      const reachable = openers.length <= MAX_DEPTH && openers.every((opener) => OPENERS.includes(opener));
      const slot = alone && reachable ? slotOf(expr, base, i, end) : null;
      if (slot) {
        return slot;
      }
      i = end;
      continue;
    }
    if ('([{'.includes(ch)) {
      openers.push(ch);
    }
    if (')]}'.includes(ch)) {
      openers.pop();
    }
  }
  return null;
}

export function classSlot(open: string): ClassSlot | null {
  const braced = BRACE_ATTR.exec(open);
  if (braced) {
    const from = braced.index + braced[0].length;
    const end = closingOf(open, from);
    return end < 0 ? null : withAttrQuote(literalIn(open.slice(from, end), from), '');
  }
  const interpolated = INTERPOLATED_ATTR.exec(open);
  if (interpolated && /\s$/.test(interpolated[2])) {
    const start = interpolated.index + interpolated[0].indexOf(interpolated[1]) + 1;
    return { start, end: start + interpolated[2].length, quotes: [interpolated[1]], interpolated: true };
  }
  const bound = BOUND_ATTR.exec(open);
  if (bound) {
    const from = bound.index + bound[0].length;
    const end = open.indexOf(bound[1], from);
    return end < 0 ? null : withAttrQuote(literalIn(open.slice(from, end), from), bound[1]);
  }
  return null;
}

function withAttrQuote(slot: ClassSlot | null, attrQuote: string): ClassSlot | null {
  return slot && attrQuote ? { ...slot, quotes: [...slot.quotes, attrQuote] } : slot;
}

export const safeIn = (text: string, slot: ClassSlot): boolean => !slot.quotes.some((q) => text.includes(q)) && !text.includes('\\') && !text.includes(INTERPOLATION);
