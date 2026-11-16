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
const RESET_VALUE: Record<string, string> = { [DISPLAY]: 'revert' };

const styled = (node: CodeNode): node is Styled => node.kind !== NodeKind.Text && node.kind !== NodeKind.Break;

function collect(node: CodeNode, parent: string | null, into: Entries, seen: Set<string>) {
  if (!styled(node)) {
    return;
  }
  const id = node.clipId && node.className ? node.clipId : null;
  if (id) {
    if (into.has(id)) {
      seen.add(id);
    }
    into.set(id, { rules: node.rules, parent });
  }
  if (node.kind === NodeKind.Element) {
    node.children.forEach((c) => collect(c, id ?? parent, into, seen));
  }
}

function entriesOf(root: ElementNode, keep: Root): Entries {
  const twice = new Set<string>();
  const all: Entries = new Map();
  collect(root, null, all, twice);
  twice.forEach((id) => all.delete(id));
  if (keep === Root.Page) {
    all.delete(root.clipId ?? '');
  }
  return all;
}

const key = (value: Rule[1]) => JSON.stringify(value);

const displayOf = (rules: readonly Rule[]) => rules.find(([p]) => p === DISPLAY)?.[1];

function changed(before: readonly Rule[], after: readonly Rule[]): Rule[] {
  const was = new Map(before.map(([p, v]) => [p, key(v)]));
  const now = new Set(after.map(([p]) => p));
  const set = after.filter(([p, v]) => was.get(p) !== key(v));
  const dropped: Rule[] = before.filter(([p]) => !now.has(p)).map(([p]) => [p, RESET_VALUE[p] ?? UNSET]);
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

function withRootMedia(root: ElementNode, kind: Root, deferred: ReadonlySet<string>, views: readonly ViewRoot[]): ElementNode {
  const base = entriesOf(root, kind);
  const present = new Set([...deferred].filter((id) => base.has(id)));
  return attach(root, mediaByClip(base, kind, present, views), present) as ElementNode;
}

const sameName = (name: string) => (c: ComponentSpec) => c.name === name;

export function withMedia(base: PageSpec, views: readonly ViewPage[], deferred: ReadonlySet<string> = new Set()): PageSpec {
  if (!views.length) {
    return base;
  }
  const components = base.components.map((c) => ({ ...c, root: withRootMedia(c.root, Root.Component, deferred, views.map((v) => ({ maxWidth: v.maxWidth, root: v.page.components.find(sameName(c.name))?.root }))) }));
  return { ...base, root: withRootMedia(base.root, Root.Page, deferred, views.map((v) => ({ maxWidth: v.maxWidth, root: v.page.root }))), components };
}
