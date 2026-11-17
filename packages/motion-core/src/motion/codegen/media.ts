import { NodeKind, type CodeNode, type ComponentSpec, type ElementNode, type MediaRules, type PageSpec, type Rule } from './ir';

export type ViewPage = { maxWidth: number; page: PageSpec };

type Styled = Exclude<CodeNode, { kind: NodeKind.Text | NodeKind.Break }>;
type Entry = { rules: Rule[]; parent: string | null };
type Entries = Map<string, Entry>;
type State = { rules: readonly Rule[]; hidden: boolean };
enum Root {
  Page,
  Component
}

type ViewRoot = { maxWidth: number; root: ElementNode | undefined };

const DISPLAY = 'display';
const HIDE: Rule = [DISPLAY, 'none'];
const UNSET = 'unset';
const PAGE_FRAME: ReadonlySet<string> = new Set(['width', 'max-width', 'margin-inline']);
const RESET_VALUE: Record<string, string> = { [DISPLAY]: 'revert' };
const SHORTHANDS: Record<string, readonly string[]> = Object.fromEntries(
  ['padding', 'margin'].flatMap((box) => [
    [`${box}-top`, [box, `${box}-block`]],
    [`${box}-bottom`, [box, `${box}-block`]],
    [`${box}-left`, [box, `${box}-inline`]],
    [`${box}-right`, [box, `${box}-inline`]]
  ])
);
const WRAP = 'flex-wrap';
const BETWEEN_VIEWS: Rule = [WRAP, 'wrap'];
const AT_VIEW: Rule = [WRAP, 'nowrap'];

const styled = (node: CodeNode): node is Styled => node.kind !== NodeKind.Text && node.kind !== NodeKind.Break;

function collect(node: CodeNode, parent: string | null, into: Entries, seen: Set<string>, framed: ElementNode | null) {
  if (!styled(node)) {
    return;
  }
  const id = node.clipId && node.className ? node.clipId : null;
  if (id) {
    if (into.has(id)) {
      seen.add(id);
    }
    into.set(id, { rules: node === framed ? node.rules.filter(([p]) => !PAGE_FRAME.has(p)) : node.rules, parent });
  }
  if (node.kind === NodeKind.Element) {
    node.children.forEach((c) => collect(c, id ?? parent, into, seen, framed));
  }
}

function entriesOf(root: ElementNode, keep: Root): Entries {
  const twice = new Set<string>();
  const all: Entries = new Map();
  collect(root, null, all, twice, keep === Root.Page ? root : null);
  twice.forEach((id) => all.delete(id));
  return all;
}

const key = (value: Rule[1]) => JSON.stringify(value);

const displayOf = (rules: readonly Rule[]) => rules.find(([p]) => p === DISPLAY)?.[1];

function changed(before: readonly Rule[], after: readonly Rule[]): Rule[] {
  const was = new Map(before.map(([p, v]) => [p, key(v)]));
  const now = new Set(after.map(([p]) => p));
  const set = after.filter(([p, v]) => was.get(p) !== key(v));
  const covered = (p: string) => (SHORTHANDS[p] ?? []).some((shorthand) => now.has(shorthand)) || [...now].some((q) => SHORTHANDS[q]?.includes(p));
  const dropped: Rule[] = before.filter(([p]) => !now.has(p) && !covered(p)).map(([p]) => [p, RESET_VALUE[p] ?? UNSET]);
  return [...set, ...dropped];
}

function shown(before: readonly Rule[], after: readonly Rule[]): Rule[] {
  const rest = changed(before, after).filter(([p]) => p !== DISPLAY);
  return [...rest, [DISPLAY, displayOf(after) ?? RESET_VALUE[DISPLAY]]];
}

function mediaByClip(base: Entries, kind: Root, deferred: ReadonlySet<string>, views: readonly ViewRoot[]): Map<string, MediaRules[]> {
  const out = new Map<string, MediaRules[]>();
  const state = new Map<string, State>([...base].map(([id, e]) => [id, { rules: e.rules, hidden: deferred.has(id) }]));

  for (const view of views) {
    if (!view.root) {
      continue;
    }
    const current = entriesOf(view.root, kind);
    for (const [id, entry] of base) {
      const was = state.get(id)!;
      const now = current.get(id);
      const parentHidden = entry.parent !== null && !!state.get(entry.parent)?.hidden;
      const rules = !now ? (was.hidden || parentHidden ? [] : [HIDE]) : was.hidden ? shown(was.rules, now.rules) : changed(was.rules, now.rules);

      if (!now && !was.hidden && !parentHidden) {
        state.set(id, { ...was, hidden: true });
      }
      if (now) {
        state.set(id, { rules: now.rules, hidden: false });
      }
      if (rules.length) {
        out.set(id, [...(out.get(id) ?? []), { maxWidth: view.maxWidth, rules }]);
      }
    }
  }
  return out;
}

const hasRule = (rules: readonly Rule[], property: string, value?: string) => rules.some(([p, v]) => p === property && (value === undefined || v === value));

const isRow = (rules: readonly Rule[]) => hasRule(rules, DISPLAY, 'flex') && !hasRule(rules, 'flex-direction') && !hasRule(rules, WRAP);

const settled = (rules: readonly Rule[] | undefined) => !rules || hasRule(rules, WRAP) || hasRule(rules, 'flex-direction');

function betweenViews(id: string, base: Entry, widths: readonly number[], seen: readonly (Entries | null)[]): MediaRules[] {
  const settledAt = (i: number) => (i ? settled(seen[i - 1]?.get(id)?.rules) : hasRule(base.rules, WRAP));
  return widths.flatMap((width, i) => [
    ...(i && !settledAt(i) && !settledAt(i - 1) ? [{ maxWidth: width, rules: [AT_VIEW] }] : []),
    ...(settledAt(i) ? [] : [{ maxWidth: width - 1, rules: [BETWEEN_VIEWS] }])
  ]);
}

function withRows(media: Map<string, MediaRules[]>, base: Entries, widths: readonly number[], views: readonly ViewRoot[], kind: Root): Map<string, MediaRules[]> {
  const seen = views.map((v) => (v.root ? entriesOf(v.root, kind) : null));
  for (const [id, entry] of base) {
    if (isRow(entry.rules)) {
      media.set(id, [...(media.get(id) ?? []), ...betweenViews(id, entry, widths, seen)].sort((a, b) => b.maxWidth - a.maxWidth));
    }
  }
  return media;
}

function attach(node: CodeNode, media: Map<string, MediaRules[]>, deferred: ReadonlySet<string>): CodeNode {
  if (!styled(node)) {
    return node;
  }
  const own = node.clipId ? media.get(node.clipId) : undefined;
  const hidden = node.clipId && node.className && deferred.has(node.clipId);
  const rules = hidden ? [...node.rules.filter(([p]) => p !== DISPLAY), HIDE] : node.rules;
  const withOwn = { ...node, rules, ...(own ? { media: own } : {}) };
  return withOwn.kind === NodeKind.Element ? { ...withOwn, children: withOwn.children.map((c) => attach(c, media, deferred)) } : withOwn;
}

const MIN_HEIGHT = 'min-height';

function heightMedia(root: ElementNode, views: readonly ViewRoot[]): MediaRules[] {
  const heightOf = (rules: readonly Rule[]) => rules.find(([p]) => p === MIN_HEIGHT)?.[1];
  let previous = heightOf(root.rules);
  return views.flatMap((view) => {
    const now = view.root && heightOf(view.root.rules);
    if (now === undefined || key(now) === key(previous ?? '')) {
      return [];
    }
    previous = now;
    return [{ maxWidth: view.maxWidth, rules: [[MIN_HEIGHT, now] as Rule] }];
  });
}

function withRootMedia(root: ElementNode, kind: Root, deferred: ReadonlySet<string>, views: readonly ViewRoot[], baseWidth: number): ElementNode {
  const base = entriesOf(root, kind);
  const present = new Set([...deferred].filter((id) => base.has(id)));
  const widths = [baseWidth, ...views.map((v) => v.maxWidth)];
  const attached = attach(root, withRows(mediaByClip(base, kind, present, views), base, widths, views, kind), present) as ElementNode;
  const own = kind === Root.Page && !root.clipId ? heightMedia(root, views) : [];
  return own.length ? { ...attached, media: [...(attached.media ?? []), ...own] } : attached;
}

const sameName = (name: string) => (c: ComponentSpec) => c.name === name;

export function withMedia(base: PageSpec, views: readonly ViewPage[], baseWidth: number, deferred: ReadonlySet<string> = new Set()): PageSpec {
  if (!views.length) {
    return base;
  }
  const components = base.components.map((c) => ({ ...c, root: withRootMedia(c.root, Root.Component, deferred, views.map((v) => ({ maxWidth: v.maxWidth, root: v.page.components.find(sameName(c.name))?.root })), baseWidth) }));
  return { ...base, root: withRootMedia(base.root, Root.Page, deferred, views.map((v) => ({ maxWidth: v.maxWidth, root: v.page.root })), baseWidth), components };
}
