import type { EditorShotId } from '../editor-shots';

export enum ArticleKind {
  Roundup = 'roundup',
  UseCase = 'use-case',
  Single = 'single',
  Agent = 'agent'
}

export type Question = { readonly q: string; readonly a: string };

export type Source = { readonly label: string; readonly href: string };

export enum VisualKind {
  Editor = 'editor',
  Diff = 'diff',
  Flow = 'flow'
}

export enum DiffSign {
  Add = '+',
  Remove = '-',
  Keep = ' '
}

export type DiffLine = { readonly sign: DiffSign; readonly text: string };

export type FlowLane = { readonly title: string; readonly steps: readonly string[] };

export type Visual =
  | { readonly kind: VisualKind.Editor; readonly shot: EditorShotId }
  | { readonly kind: VisualKind.Diff; readonly file: string; readonly lines: readonly DiffLine[] }
  | { readonly kind: VisualKind.Flow; readonly them: FlowLane; readonly us: FlowLane };

export type Highlight = {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly visual: Visual;
  readonly caption: string;
};

export enum CalloutTone {
  Tip = 'tip',
  Warning = 'warning',
  Note = 'note'
}

export type Callout = { readonly tone: CalloutTone; readonly title: string; readonly text: string };

export type Cta = { readonly text: string; readonly label: string; readonly href: string };

export type Shot = { readonly src: string; readonly alt: string; readonly width: number; readonly height: number; readonly caption: string };

export type TableBlock = {
  readonly heading: string;
  readonly head: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly callout?: Callout;
};

export type Step = { readonly title: string; readonly text: string };

export type Rich = {
  readonly verdict: string;
  readonly snapshotHeading: string;
  readonly snapshot: string;
  readonly highlights: readonly Highlight[];
  readonly cost: { readonly heading: string; readonly paragraphs: readonly string[] };
  readonly stepsHeading: string;
  readonly steps: readonly Step[];
  readonly closing: string;
  readonly moreQuestions: readonly Question[];
  readonly takeaways?: readonly string[];
  readonly tables?: readonly TableBlock[];
  readonly hero?: Shot;
};

export type Section = {
  readonly heading: string;
  readonly html: string;
  readonly callout?: Callout;
  readonly cta?: Cta;
  readonly image?: Shot;
};

export type Extras = {
  readonly takeaways: readonly string[];
  readonly tables: readonly TableBlock[];
  readonly hero: Shot;
  readonly sections: readonly Section[];
  readonly sources: readonly Source[];
};

export type Article = {
  readonly kind: ArticleKind;
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly hook: string;
  readonly lead: string;
  readonly pickThem: { readonly name: string; readonly points: readonly string[] };
  readonly pickFeega: readonly string[];
  readonly sections: readonly Section[];
  readonly mistakes: readonly Question[];
  readonly questions: readonly Question[];
  readonly sources: readonly Source[];
  readonly rich?: Rich;
  readonly checked: string;
};

export function table(head: readonly string[], rows: readonly (readonly string[])[]): string {
  const th = head.map((h) => `<th>${h}</th>`).join('');
  const tr = rows.map(([first, ...cells]) => `<tr><th scope="row">${first}</th>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<div class="table"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

export const diff = (...lines: readonly (readonly [DiffSign, string])[]): readonly DiffLine[] => lines.map(([sign, text]) => ({ sign, text }));
