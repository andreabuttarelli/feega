import { NodeKind, type CodeNode, type ElementNode, type MediaRules, type PageSpec, type Rule } from './ir';

export type ViewPage = { maxWidth: number; page: PageSpec };

type Styled = Exclude<CodeNode, { kind: NodeKind.Text | NodeKind.Break }>;
type RulesByClip = Map<string, Rule[]>;

const HIDDEN: Rule[] = [['display', 'none']];
const RESET = 'unset';

const styled = (node: CodeNode): node is Styled => node.kind !== NodeKind.Text && node.kind !== NodeKind.Break;

function collect(node: CodeNode, into: RulesByClip, seen: Set<string>): RulesByClip {
  if (!styled(node)) {
    return into;
  }
  if (node.clipId && node.className) {
    if (into.has(node.clipId)) {
      seen.add(node.clipId);
    }
    into.set(node.clipId, node.rules);
  }
  if (node.kind === NodeKind.Element) {
    node.children.forEach((c) => collect(c, into, seen));
  }
  return into;
}

function rulesOf(root: ElementNode): RulesByClip {
  const twice = new Set<string>();
  const all = collect(root, new Map(), twice);
  twice.forEach((id) => all.delete(id));
  return all;
}

const key = (value: Rule[1]) => JSON.stringify(value);

function changed(before: readonly Rule[], after: readonly Rule[] | undefined): Rule[] {
  if (!after) {
    return before === HIDDEN ? [] : HIDDEN;
  }
  const was = new Map(before.map(([p, v]) => [p, key(v)]));
  const now = new Set(after.map(([p]) => p));
  const set = after.filter(([p, v]) => was.get(p) !== key(v));
  const dropped: Rule[] = before.filter(([p]) => !now.has(p)).map(([p]) => [p, RESET]);
  return [...set, ...dropped];
}

function mediaByClip(base: ElementNode, views: readonly ViewPage[]): Map<string, MediaRules[]> {
  const out = new Map<string, MediaRules[]>();
  let previous = rulesOf(base);
  previous.delete(base.clipId ?? '');

  for (const view of views) {
    const current = rulesOf(view.page.root);
    for (const [name, before] of previous) {
      const rules = changed(before, current.get(name));
      if (rules.length) {
        out.set(name, [...(out.get(name) ?? []), { maxWidth: view.maxWidth, rules }]);
      }
    }
    previous = new Map([...previous].map(([name, rules]) => [name, current.get(name) ?? HIDDEN]));
  }
  return out;
}

function attach(node: CodeNode, media: Map<string, MediaRules[]>): CodeNode {
  if (!styled(node)) {
    return node;
  }
  const own = node.clipId ? media.get(node.clipId) : undefined;
  const withOwn = own ? { ...node, media: own } : node;
  return withOwn.kind === NodeKind.Element ? { ...withOwn, children: withOwn.children.map((c) => attach(c, media)) } : withOwn;
}

export function withMedia(base: PageSpec, views: readonly ViewPage[]): PageSpec {
  if (!views.length) {
    return base;
  }
  return { ...base, root: attach(base.root, mediaByClip(base.root, views)) as ElementNode };
}
