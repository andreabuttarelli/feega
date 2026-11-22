import { CATEGORY_COPY } from './copy';
import { FRAMEWORK_LABEL } from './labels';
import { TEMPLATES } from './library';
import { Framework, type FrameworkCode, type Template } from './template';

const TOKEN_MEANING: Readonly<Record<string, string>> = {
  '--feega-bg': 'the page background',
  '--feega-surface': 'quiet panels and chips',
  '--feega-raised': 'cards and raised surfaces',
  '--feega-input': 'form field backgrounds',
  '--feega-fg': 'main text',
  '--feega-fg-muted': 'secondary text',
  '--feega-fg-subtle': 'hints and placeholders',
  '--feega-line': 'hairline borders and dividers',
  '--feega-line-strong': 'stronger borders',
  '--feega-dot': 'the dotted grid pattern',
  '--feega-accent': 'the brand colour on primary actions',
  '--feega-accent-hover': 'the accent on hover',
  '--feega-accent-fg': 'text on top of the accent',
  '--feega-accent-soft': 'tinted accent backgrounds',
  '--feega-accent-text': 'accent used as text',
  '--feega-danger': 'destructive actions and errors',
  '--feega-danger-fg': 'text on the danger colour',
  '--feega-danger-soft': 'tinted error backgrounds',
  '--feega-success': 'success states',
  '--feega-success-soft': 'tinted success backgrounds',
  '--feega-focus': 'the keyboard focus ring',
  '--feega-overlay': 'the backdrop behind dialogs',
  '--feega-shadow': 'resting elevation',
  '--feega-shadow-float': 'floating elevation',
  '--feega-radius-xs': 'the smallest corner radius',
  '--feega-radius-sm': 'small corner radius',
  '--feega-radius-md': 'medium corner radius',
  '--feega-radius-lg': 'large corner radius',
  '--feega-radius-full': 'fully round pills and buttons',
  '--feega-font': 'the body typeface',
  '--feega-font-display': 'the headline typeface',
  '--feega-font-mono': 'the monospace typeface',
  '--feega-tracking': 'letter spacing for body text',
  '--feega-tracking-tight': 'letter spacing for large headlines',
  '--feega-text-xs': 'the smallest text size',
  '--feega-text-sm': 'small text size',
  '--feega-text-body': 'body text size',
  '--feega-text-lg': 'lead text size',
  '--feega-text-xl': 'subheading size',
  '--feega-text-title': 'title size',
  '--feega-text-display': 'display headline size',
  '--feega-ease': 'the animation curve',
  '--feega-dur': 'the animation duration',
  '--feega-dur-fast': 'the short animation duration',
  '--feega-space-1': 'the smallest spacing step',
  '--feega-space-2': 'spacing step 2',
  '--feega-space-3': 'spacing step 3',
  '--feega-space-4': 'spacing step 4',
  '--feega-space-6': 'spacing step 6',
  '--feega-space-8': 'spacing step 8',
  '--feega-space-12': 'spacing step 12',
  '--feega-space-16': 'spacing step 16',
  '--feega-space-section': 'vertical padding of a section',
  '--feega-gutter': 'side padding of the page',
  '--feega-max-width': 'maximum content width'
};

export type TokenUse = { readonly token: string; readonly meaning: string; readonly uses: number };

const TOKEN_REFERENCE = /var\((--feega-[a-z0-9-]+)/g;

const MAX_TOKENS_LISTED = 12;

export function tokensUsed(css: string): readonly TokenUse[] {
  const counts = new Map<string, number>();
  for (const match of css.matchAll(TOKEN_REFERENCE)) {
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([token]) => token in TOKEN_MEANING)
    .map(([token, uses]) => ({ token, meaning: TOKEN_MEANING[token], uses }))
    .sort((a, b) => b.uses - a.uses || a.token.localeCompare(b.token))
    .slice(0, MAX_TOKENS_LISTED);
}

export const needsScript = (markup: string): boolean => /<script[\s>]/.test(markup);

export type SizeRow = { readonly framework: Framework; readonly files: number; readonly lines: number };

const lineCount = (code: string) => code.split('\n').length;

export function sizesOf(code: FrameworkCode): readonly SizeRow[] {
  return Object.values(Framework)
    .filter((f) => code[f].length > 0)
    .map((framework) => ({ framework, files: code[framework].length, lines: code[framework].reduce((sum, file) => sum + lineCount(file.code), 0) }));
}

const SHARED_TAG_WEIGHT = 2;
const RELATED_COUNT = 6;

export function relatedTo(template: Template): readonly Template[] {
  const score = (other: Template) =>
    other.tags.filter((tag) => template.tags.includes(tag)).length * SHARED_TAG_WEIGHT + (other.category === template.category ? 1 : 0);

  return TEMPLATES.filter((other) => other.id !== template.id)
    .map((other) => ({ other, score: score(other) }))
    .sort((a, b) => b.score - a.score || a.other.name.localeCompare(b.other.name))
    .slice(0, RELATED_COUNT)
    .map((entry) => entry.other);
}

export type ItemFacts = {
  readonly intro: string;
  readonly behaviour: string;
  readonly fonts: string;
  readonly tokens: readonly TokenUse[];
  readonly sizes: readonly SizeRow[];
};

const list = (words: readonly string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

const fontLine = (template: Template) =>
  template.fonts.length === 0
    ? 'It needs no web fonts.'
    : `It uses ${list(template.fonts.map((f) => `${f.family} (${f.weights.join(', ')})`))} from Google Fonts. Without them the font tokens fall back to a system stack.`;

export function factsOf(template: Template, parts: { markup: string; css: string }, code: FrameworkCode): ItemFacts {
  const noun = CATEGORY_COPY[template.category].noun;
  const interactive = needsScript(parts.markup);

  return {
    intro: `${template.name} is a free ${noun}. ${template.description} It is tagged ${list(template.tags)}.`,
    behaviour: interactive
      ? 'It has behaviour: a few lines of script in the plain HTML version, and framework state in the Svelte, React and Vue versions.'
      : 'It is markup and CSS only, with no script in any version.',
    fonts: fontLine(template),
    tokens: tokensUsed(parts.css),
    sizes: sizesOf(code)
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const sizesText = (rows: readonly SizeRow[]): string =>
  rows.length === 0 ? '' : `Size per version: ${rows.map((r) => `${FRAMEWORK_LABEL[r.framework]} ${plural(r.files, 'file')}, ${plural(r.lines, 'line')}`).join('; ')}.`;

