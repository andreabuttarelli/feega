import { globalSheetOf } from './font-wiring';
import type { ReadFile } from './files';
import type { TextWritten } from './literal-text';
import { selectorInBody } from './scoped-rule';
import type { Css } from './style-attr';

export enum PageTarget {
  Html = 'html',
  Body = 'body'
}

const NO_INDENT = '';

function selectorWithin(target: PageTarget, within?: string | null): string {
  if (!within) {
    return target;
  }
  return target === PageTarget.Html ? `${target}${within}` : `${within} ${target}`;
}

export async function pageRule(read: ReadFile, target: PageTarget, css: Css, viewport?: number, media?: string | null, within?: string | null): Promise<TextWritten> {
  const sheet = await globalSheetOf(read);
  const before = sheet === null ? null : await read(sheet);
  if (sheet === null || before === null) {
    return { ok: false, reason: 'no global stylesheet found for page styles' };
  }
  return { ok: true, change: { path: sheet, before, after: selectorInBody(before, selectorWithin(target, within), new Map(Object.entries(css)), viewport, NO_INDENT, media) } };
}
