import type { ShaderParam } from './effect';
import { CONTRACT_UNIFORMS, uniformName } from './prelude';

export enum LintRule {
  Extension = 'extension',
  OffSpec = 'off-spec',
  UnboundedLoop = 'unbounded-loop',
  TooManyFetches = 'too-many-fetches',
  UndeclaredUniform = 'undeclared-uniform',
  UnknownUniform = 'unknown-uniform',
  NoEntry = 'no-entry'
}

export type LintProblem = { rule: LintRule; message: string };

export const MAX_LOOP_BOUND = 64;
export const MAX_FETCHES = 16;

type Check = (frag: string, params: ShaderParam[]) => string | null;

const loopBounds = (frag: string) => [...frag.matchAll(/for\s*\([^;]*;\s*\w+\s*<=?\s*([^;]+);/g)].map((m) => m[1].trim());

const declared = (params: ShaderParam[]) => new Set<string>([...CONTRACT_UNIFORMS, ...params.map((p) => uniformName(p.key))]);

const CHECKS: Record<LintRule, Check> = {
  [LintRule.Extension]: (frag) => (/#\s*extension/.test(frag) ? '#extension is not allowed' : null),
  [LintRule.OffSpec]: (frag) => {
    const hit = /\b(texture2DLod|texture2DGrad\w*|dFdx|dFdy|fwidth|gl_FragData|discard)\b/.exec(frag);
    return hit ? `${hit[1]} is outside WebGL1 core` : null;
  },
  [LintRule.UnboundedLoop]: (frag) => {
    if (/\bwhile\b|\bdo\s*\{/.test(frag)) {
      return 'while/do loops are not allowed; use for with a constant bound';
    }

    const bad = loopBounds(frag).find((b) => !/^\d+(\.\d+)?$/.test(b) || Number(b) > MAX_LOOP_BOUND);
    return bad === undefined ? null : `loop bound ${bad} must be a constant <= ${MAX_LOOP_BOUND}`;
  },
  [LintRule.TooManyFetches]: (frag) => {
    const count = (frag.match(/\btexture2D\s*\(/g) ?? []).length;
    return count > MAX_FETCHES ? `${count} texture fetches, max ${MAX_FETCHES}` : null;
  },
  [LintRule.UndeclaredUniform]: (frag) => (/\buniform\b/.test(frag) ? 'declare uniforms as params, not in the source' : null),
  [LintRule.UnknownUniform]: (frag, params) => {
    const known = declared(params);
    const unknown = [...new Set(frag.match(/\bu_\w+/g) ?? [])].filter((u) => !known.has(u));
    return unknown.length ? `unknown uniforms: ${unknown.join(', ')}` : null;
  },
  [LintRule.NoEntry]: (frag) => (/vec4\s+effect\s*\(\s*vec2\s+\w+\s*\)/.test(frag) ? null : 'missing vec4 effect(vec2 uv)')
};

export function lintFrag(frag: string, params: ShaderParam[]): LintProblem[] {
  const problems: LintProblem[] = [];
  for (const [rule, check] of Object.entries(CHECKS) as [LintRule, Check][]) {
    const message = check(frag, params);
    if (message) {
      problems.push({ rule, message });
    }
  }

  return problems;
}
