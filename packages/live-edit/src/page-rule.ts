import { globalSheetOf } from './font-wiring';
import type { FileChange, ReadFile } from './files';
import { pageSheetOf } from './page-fallback';
import { selectorInBody } from './scoped-rule';
import type { Css } from './style-attr';

export enum PageTarget {
  Html = 'html',
  Body = 'body'
}

export type PageWritten = { ok: true; changes: FileChange[]; created: boolean } | { ok: false; reason: string };

const NO_INDENT = '';

function selectorWithin(target: PageTarget, within?: string | null): string {
  if (!within) {
    return target;
  }
  return target === PageTarget.Html ? `${target}${within}` : `${within} ${target}`;
}

export async function pageRule(read: ReadFile, target: PageTarget, css: Css, viewport?: number, media?: string | null, within?: string | null): Promise<PageWritten> {
  const sheet = await globalSheetOf(read);
  const before = sheet === null ? null : await read(sheet);
  const edit = (body: string) => selectorInBody(body, selectorWithin(target, within), new Map(Object.entries(css)), viewport, NO_INDENT, media);
  if (sheet !== null && before !== null) {
    return { ok: true, changes: [{ path: sheet, before, after: edit(before) }], created: false };
  }
  const home = await pageSheetOf(read);
  if (home === null) {
    return { ok: false, reason: 'no global stylesheet found for page styles' };
  }
  return { ok: true, changes: [{ path: home.path, before: home.before, after: home.compose(edit(home.inner)) }, ...home.extra], created: home.created };
}
