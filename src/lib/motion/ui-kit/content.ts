import { UI_KIT, UiKind, type UiPiece } from './kit';
import { defaultsOf, structureOf } from './anchors';

export enum Interaction {
  Presses = 'presses',
  Still = 'still'
}

const INTERACTION: Record<UiKind, Interaction> = {
  [UiKind.LinkShortener]: Interaction.Presses,
  [UiKind.LinkList]: Interaction.Still,
  [UiKind.StatCards]: Interaction.Still,
  [UiKind.Funnel]: Interaction.Still,
  [UiKind.Payouts]: Interaction.Still,
  [UiKind.Qr]: Interaction.Still,
  [UiKind.Window]: Interaction.Still,
  [UiKind.Sidebar]: Interaction.Still,
  [UiKind.Hero]: Interaction.Presses,
  [UiKind.PromptBox]: Interaction.Presses,
  [UiKind.EditorCanvas]: Interaction.Presses,
  [UiKind.CardGrid]: Interaction.Presses,
  [UiKind.Pricing]: Interaction.Presses,
  [UiKind.Chat]: Interaction.Still,
  [UiKind.Modal]: Interaction.Presses,
  [UiKind.Toggle]: Interaction.Presses,
  [UiKind.Upload]: Interaction.Still,
  [UiKind.GeneratedResult]: Interaction.Still,
  [UiKind.Cursor]: Interaction.Presses
};

const KIND_OF = new Map(Object.entries(UI_KIT).map(([kind, piece]) => [piece.name, kind as UiKind]));

export const kitKind = (name: string) => KIND_OF.get(name) ?? null;

export const isUiPiece = (name: string, js?: string) => kitKind(name) !== null || (js ? structureOf(js) !== null : false);

export function interactionOf(name: string, js?: string): Interaction {
  const kind = kitKind(name);
  if (kind) {
    return INTERACTION[kind];
  }
  const structure = js ? structureOf(js) : null;
  return structure?.blocks.some((b) => b.kind === 'button') ? Interaction.Presses : Interaction.Still;
}

const CONTENT_PARAM = /param\('(\w+)',\s*'(?:[^'\\]|\\.)*',\s*\{\s*type:\s*'(?:text|textarea)',\s*group:\s*'Content'/g;

export const contentParams = (piece: Pick<UiPiece, 'js'>) => [...piece.js.matchAll(CONTENT_PARAM)].map((m) => m[1]);

const GENERIC = /lorem|ipsum|placeholder|\bexample\b|\bsample\b|untitled|^\s*(item|card|feature|plan|step|block|title|label|text|button|heading|name|value)\s*\d*\s*$|\bfoo\b|john doe|jane doe|\bacme\b|your (text|title|company|brand|product)|xxx|^[.\s…-]*$/i;

export const genericText = (text: string) => GENERIC.test(text);

const REPEAT_SHARE = 0.5;
const REPEAT_MIN = 3;

function repeated(lines: string[][]): boolean {
  const columns = Math.max(0, ...lines.map((l) => l.length));
  return Array.from({ length: columns }, (_, c) => lines.map((l) => (l[c] ?? '').toLowerCase())).some((column) => {
    const counts = new Map<string, number>();
    column.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
    const most = Math.max(0, ...counts.values());
    return lines.length >= REPEAT_MIN && most >= REPEAT_MIN && most > lines.length * REPEAT_SHARE;
  });
}

export function emptyContent(name: string, props: Record<string, unknown>, js?: string): string[] {
  const kind = kitKind(name);
  if (kind === UiKind.Cursor) {
    return [];
  }
  if (kind) {
    const piece = UI_KIT[kind];
    const defaults = defaultsOf(piece);
    return contentParams(piece).flatMap((key) => {
      const value = String(props[key] ?? '');
      if (!(key in props) || value === defaults[key]) {
        return [`${key} is the kit's sample text, not this product's`];
      }
      const lines = value.split('\n').map((l) => l.split('|').map((c) => c.trim()));
      if (lines.flat().some(genericText)) {
        return [`${key} is empty or generic ("${value.slice(0, 40)}")`];
      }
      return repeated(lines) ? [`${key} repeats the same text on most lines: each line says something specific`] : [];
    });
  }
  const structure = js ? structureOf(js) : null;
  if (!structure) {
    return [];
  }
  const texts = structure.blocks.filter((b) => b.kind !== 'picture').flatMap((b) => [b.text, ...(b.items ?? [])]);
  return texts.filter(genericText).map((t) => `"${t.slice(0, 40)}" is empty or generic`);
}
