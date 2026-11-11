import type { UrlPlan } from '$lib/server/url-import/url-doc';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { Capture } from './boards';
import { parseSheets, readSheets, type VarRule } from './css-tokens';
import { boundToTokens, spacingMultiples, type BoundCount } from './design-bind';
import { boardBound, designBoard, DESIGN_BOARD } from './design-board';
import { tokenSetOf, variableName, variablesOf, type TokenMap, type TokenSet } from './design-tokens';
import type { RenderConditions } from './render-conditions';
import type { ReadFile } from './write-back';

export enum DesignSystem {
  On = 'on',
  Off = 'off'
}

export const designSystemOf = (on: boolean | undefined) => (on === false ? DesignSystem.Off : DesignSystem.On);

export type Design = { set: TokenSet; rules: VarRule[] };

export type DesignReport = { tokens: number } & BoundCount;

export type Designed = { plan: UrlPlan; map: TokenMap; report: DesignReport; skipped: string[] };

const SKIPPED_PREFIX = 'Design system';

export async function designOf(read: ReadFile): Promise<Design | null> {
  const parsed = parseSheets(await readSheets(read));
  const set = tokenSetOf(parsed);
  return set.tokens.length ? { set, rules: parsed.rules } : null;
}

export const tokenCount = async (read: ReadFile) => (await designOf(read))?.set.tokens.length ?? 0;

export const modeOfScheme = (c: RenderConditions) => c.scheme.charAt(0).toUpperCase() + c.scheme.slice(1);

function classesIn(node: RestNode, out: Set<string>): Set<string> {
  (node.source?.cls ?? '').split(/\s+/).forEach((c) => c && out.add(c));
  (node.children ?? []).forEach((child) => classesIn(child, out));
  return out;
}

const classesOf = (captures: Capture[]) => [...captures.reduce((all, c) => classesIn(c.tree.root, all), new Set<string>())];

function usedTokens(design: Design, captures: Capture[]): Set<string> {
  const classes = classesOf(captures);
  return new Set(design.set.tokens.filter((t) => classes.some((c) => c.endsWith(`-${variableName(t.name)}`))).map((t) => t.name));
}

export function withBoard(design: Design, repo: string, captures: Capture[]): Capture[] {
  const { variables } = variablesOf(design.set, repo, { used: usedTokens(design, captures), multiples: spacingMultiples(classesOf(captures)) });
  return [{ label: DESIGN_BOARD, tree: designBoard(variables), uses: [] }, ...captures];
}

export type DesignAsk = { repo: string; base: RenderConditions; boards: Record<string, string>; captures: Capture[]; width: number };

export function designed(design: Design, plan: UrlPlan, ask: DesignAsk): Designed {
  const base = modeOfScheme(ask.base);
  const scale = plan.plan.items[0] ? plan.plan.items[0].doc.width / ask.width : 1;
  const made = variablesOf(design.set, ask.repo, { scale, used: usedTokens(design, ask.captures), active: base, multiples: spacingMultiples(classesOf(ask.captures)) });
  const counted: BoundCount = { byClass: 0, byRule: 0, byValue: 0, unbound: 0 };

  const items = plan.plan.items.map((item) => {
    const done = boundToTokens(item.doc, { ...made, rules: design.rules, base, boards: { ...ask.boards, [DESIGN_BOARD]: base } });
    (Object.keys(counted) as (keyof BoundCount)[]).forEach((k) => (counted[k] += done.bound[k]));
    return { ...item, doc: boardBound(done.doc) };
  });

  const skipped = [...design.set.skipped, ...made.dropped].map((s) => `${SKIPPED_PREFIX}: ${s}`);
  return { plan: { ...plan, plan: { ...plan.plan, items } }, map: made.map, report: { tokens: Object.keys(made.map).length, ...counted }, skipped };
}
