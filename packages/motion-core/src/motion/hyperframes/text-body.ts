import type { ListItem } from '../text-lists';
import { LIST_STEP_EM, MARKER_GAP_EM, markersOf } from '../text-lists';
import { segmentsOf, type RunCase, type TextRun } from '../text-runs';
import { textPaint } from '../fill/render';
import { css, esc } from './html';

const EMPTY_LINE = '&#8203;';

export type TextBodyCtx = {
  p: { text: string; size: number; font: string; runs?: TextRun[]; lists?: ListItem[]; paragraphSpacing: number; paragraphIndent: number };
  text: { id: string | null; lines: (text: string) => string[] };
  color: (value: string) => string;
  asset: (id: string | null) => string | null;
  font: (family: string) => string;
  weight: (family: string, weight: number) => number;
};

const EM_PRECISION = 10000;
const RUN_TRANSFORM: Record<RunCase, string> = { 'as-typed': 'none', upper: 'uppercase', lower: 'lowercase' };

function runPaint(ctx: TextBodyCtx, run: TextRun): Record<string, string | undefined> {
  if (run.fill) {
    return textPaint([run.fill], ctx.color, ctx.asset);
  }
  const colour = run.color ? ctx.color(run.color) : undefined;
  return { color: colour, webkitTextFillColor: colour };
}

function runCss(ctx: TextBodyCtx, run: TextRun): string {
  const family = run.font ?? ctx.p.font;
  return css({
    ...runPaint(ctx, run),
    fontFamily: run.font === undefined ? undefined : ctx.font(run.font),
    fontSize: run.size === undefined ? undefined : `${Math.round((run.size / ctx.p.size) * EM_PRECISION) / EM_PRECISION}em`,
    fontWeight: run.weight === undefined ? undefined : ctx.weight(family, run.weight),
    fontStyle: run.italic === undefined ? undefined : run.italic ? 'italic' : 'normal',
    letterSpacing: run.tracking === undefined ? undefined : `${run.tracking}em`,
    lineHeight: run.leading,
    textDecoration: run.underline || run.strike || run.link ? [run.underline || run.link ? 'underline' : '', run.strike ? 'line-through' : ''].filter(Boolean).join(' ') : undefined,
    textTransform: run.textCase === undefined ? undefined : RUN_TRANSFORM[run.textCase],
    opacity: run.opacity
  });
}

function runHtml(ctx: TextBodyCtx, run: TextRun, html: string): string {
  const style = runCss(ctx, run);
  return run.link ? `<a href="${esc(run.link)}" target="_blank" rel="noopener noreferrer" style="color:inherit;${style}">${html}</a>` : `<span style="${style}">${html}</span>`;
}

function runParagraphs(ctx: TextBodyCtx): string[] {
  const paragraphs: string[] = [''];
  for (const segment of segmentsOf(ctx.p.text, ctx.p.runs)) {
    segment.text.split('\n').forEach((piece, i) => {
      if (i > 0) {
        paragraphs.push('');
      }
      const html = esc(piece);
      paragraphs[paragraphs.length - 1] += segment.run && piece ? runHtml(ctx, segment.run, html) : html;
    });
  }
  return paragraphs;
}

const paragraphsOf = (ctx: TextBodyCtx): string[] => (!ctx.p.runs?.length || ctx.text.id !== null ? ctx.text.lines(ctx.p.text) : runParagraphs(ctx));

export enum TextBodyFor {
  Export = 'export',
  Editor = 'editor'
}

export const MARKER_ATTR = 'data-list-marker';

const BODY_FOR: Record<TextBodyFor, { plainJoin: boolean; markerAttrs: string }> = {
  [TextBodyFor.Export]: { plainJoin: true, markerAttrs: '' },
  [TextBodyFor.Editor]: { plainJoin: false, markerAttrs: ` ${MARKER_ATTR} contenteditable="false"` }
};

function listMarker(marker: string, level: number, attrs: string): string {
  const style = css({ position: 'absolute', left: '0', width: `${emOf((level + 1) * LIST_STEP_EM - MARKER_GAP_EM)}em`, textAlign: 'right', textIndent: '0', whiteSpace: 'nowrap' });
  return `<span${attrs} style="${style}">${marker}</span>`;
}

const emOf = (n: number) => Math.round(n * EM_PRECISION) / EM_PRECISION;

export function textBody(ctx: TextBodyCtx, use: TextBodyFor = TextBodyFor.Export): string {
  const paragraphs = paragraphsOf(ctx);
  const { paragraphSpacing: spacing, paragraphIndent: indent, lists } = ctx.p;
  const markers = markersOf(lists ?? []);
  const { plainJoin, markerAttrs } = BODY_FOR[use];
  if (plainJoin && !spacing && !indent && !markers.some(Boolean)) {
    return paragraphs.join('\n');
  }
  return paragraphs
    .map((html, i) => {
      const marker = markers[i];
      const level = lists?.[i]?.level ?? 0;
      const style = css({ position: marker ? 'relative' : undefined, paddingLeft: marker ? `${emOf((level + 1) * LIST_STEP_EM)}em` : undefined, textIndent: `${indent}em`, marginBottom: `${i < paragraphs.length - 1 ? spacing : 0}em` });
      return `<div style="${style}">${marker ? listMarker(marker, level, markerAttrs) : ''}${html || EMPTY_LINE}</div>`;
    })
    .join('');
}

