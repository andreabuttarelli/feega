import type { FileChange } from '@feega/live-edit/files';
import { LiveProp } from '@feega/live-edit/live-fields';
import { ElementState } from '@feega/live-edit/element-state';
import type { UsageDims } from './usage';
import { Styling, type EditAsk, type WebviewUsageDims } from '../messages';

const OTHER = 'other';
const BASE = 'base';
const CUSTOM = 'custom';

const FILE_EXTS = ['tsx', 'jsx', 'ts', 'js', 'vue', 'svelte', 'astro', 'html', 'css', 'scss', 'sass', 'less', 'md', 'mdx'];
const BREAKPOINTS = ['sm', 'md', 'lg', 'xl', '2xl'];

const CATEGORY_OF_PROP: Partial<Record<LiveProp, string>> = {
  [LiveProp.Text]: 'text_content',
  [LiveProp.Color]: 'color',
  [LiveProp.Fill]: 'color',
  [LiveProp.FontSize]: 'typography',
  [LiveProp.FontWeight]: 'typography',
  [LiveProp.Padding]: 'spacing',
  [LiveProp.Margin]: 'spacing',
  [LiveProp.Gap]: 'spacing',
  [LiveProp.Radius]: 'border'
};

const CATEGORY_OF_CSS: [RegExp, string][] = [
  [/^(margin|padding|gap|row-gap|column-gap)/, 'spacing'],
  [/^(font|text-|line-height|letter-spacing|word-spacing)/, 'typography'],
  [/^(border|outline)/, 'border'],
  [/(shadow|opacity|filter|transform|transition|blur|mix-blend)/, 'effect'],
  [/^(color$|background|fill|stroke)/, 'color'],
  [/^(width|height|min-|max-|aspect-ratio|size)/, 'size'],
  [/^(display|flex|grid|position|align|justify|overflow|z-index|top|left|right|bottom|order|place)/, 'layout']
];

export function propCategoryOf(prop: LiveProp, css: Record<string, string> | undefined): string | undefined {
  const known = CATEGORY_OF_PROP[prop];
  if (known) {
    return known;
  }
  const property = Object.keys(css ?? {})[0];

  return CATEGORY_OF_CSS.find(([pattern]) => property && pattern.test(property))?.[1];
}

export function targetOf(ask: Pick<EditAsk, 'prop'>, styling: Styling): string {
  if (ask.prop === LiveProp.Text) {
    return 'text';
  }

  return styling === Styling.Tailwind ? 'tailwind_class' : 'scoped_css';
}

export function fileExtOf(path: string): string {
  const dot = path.lastIndexOf('.');
  const ext = dot < 0 ? '' : path.slice(dot + 1).toLowerCase();

  return FILE_EXTS.includes(ext) ? ext : OTHER;
}

const lineCounts = (text: string) => {
  const counts = new Map<string, number>();
  for (const line of text.split('\n')) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }

  return counts;
};

const surplus = (from: string, against: string) => {
  const other = lineCounts(against);
  let total = 0;
  for (const [line, count] of lineCounts(from)) {
    total += Math.max(count - (other.get(line) ?? 0), 0);
  }

  return total;
};

export function linesOf(changes: FileChange[]) {
  const touched = changes.filter((change) => change.before !== change.after && change.encoding === undefined);

  return {
    lines_added: touched.reduce((sum, change) => sum + surplus(change.after, change.before), 0),
    lines_removed: touched.reduce((sum, change) => sum + surplus(change.before, change.after), 0),
    files_count: touched.length,
    paths: touched.map((change) => change.path)
  };
}

export const breakpointOf = (name: string | undefined): string => (name === undefined ? BASE : BREAKPOINTS.includes(name) ? name : CUSTOM);

const STATE_OF: Record<string, string> = {
  [ElementState.Default]: 'default',
  [ElementState.Hover]: 'hover',
  [ElementState.Focus]: 'focus',
  [ElementState.FocusVisible]: 'focus',
  [ElementState.Active]: 'active',
  [ElementState.Disabled]: 'disabled',
  dark: 'dark'
};

export const stateOf = (state: string | undefined): string => STATE_OF[state ?? ElementState.Default] ?? OTHER;

const MAX_IDENTIFIER = 64;

export const identifierOf = (value: string): string => value.replace(/[^A-Za-z0-9_.:-]/g, '-').replace(/^[^A-Za-z0-9]+/, '').slice(0, MAX_IDENTIFIER) || OTHER;

const VARIANTS = ['focus', 'variant'];
const FOCUS_MODES = ['mount', 'snapshot'];
const CONTROL_KINDS = ['select', 'toggle', 'text', 'number', 'children'];

const countOf = (value: number | undefined) => (Number.isInteger(value) && value! >= 0 ? { prop_count: value! } : {});

export const webviewDimsOf = (dims: WebviewUsageDims = {}): UsageDims => ({
  ...(dims.state === undefined ? {} : { state: stateOf(dims.state) }),
  ...(dims.breakpoint === undefined ? {} : { breakpoint: dims.breakpoint === BASE ? BASE : breakpointOf(dims.breakpoint) }),
  ...(dims.variant !== undefined && VARIANTS.includes(dims.variant) ? { variant: dims.variant } : {}),
  ...(dims.mode !== undefined && FOCUS_MODES.includes(dims.mode) ? { mode: dims.mode } : {}),
  ...(dims.control !== undefined && CONTROL_KINDS.includes(dims.control) ? { control: dims.control } : {}),
  ...countOf(dims.prop_count),
  ...(dims.error_class === undefined ? {} : { error_class: identifierOf(dims.error_class) }),
  ...(dims.area === undefined ? {} : { area: 'webview' })
});
