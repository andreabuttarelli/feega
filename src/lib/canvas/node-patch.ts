export type NodeData = Record<string, unknown>;

export enum MergeRule {
  Replace = 'replace',
  Deep = 'deep'
}

const MERGE_RULES: Readonly<Record<string, MergeRule>> = {
  params: MergeRule.Deep,
  filters: MergeRule.Deep
};

const DEEP = () => MergeRule.Deep;

function ruleOf(key: string): MergeRule {
  return MERGE_RULES[key] ?? MergeRule.Replace;
}

type RuleOf = (key: string) => MergeRule;

function isRecord(value: unknown): value is NodeData {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function present(value: unknown): unknown {
  return value === undefined ? null : value;
}

export function sameValue(a: unknown, b: unknown): boolean {
  const left = present(a);
  const right = present(b);
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, i) => sameValue(item, right[i]));
  }
  if (!isRecord(left) || !isRecord(right)) {
    return false;
  }

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => sameValue(left[key], right[key]));
}

function diffLevel(before: NodeData, after: NodeData, keys: string[], rule: RuleOf): NodeData {
  const out: NodeData = {};
  for (const key of keys) {
    const was = before[key];
    const now = after[key];
    if (sameValue(was, now)) {
      continue;
    }
    if (rule(key) === MergeRule.Deep && isRecord(was) && isRecord(now)) {
      out[key] = diffLevel(was, now, [...new Set([...Object.keys(was), ...Object.keys(now)])], DEEP);
      continue;
    }
    out[key] = present(now);
  }
  return out;
}

export function diffNodeData(saved: NodeData, next: NodeData, keys: string[] = Object.keys(next)): NodeData {
  return diffLevel(saved, next, keys, ruleOf);
}

function applyLevel(target: NodeData, patch: NodeData, rule: RuleOf): NodeData {
  const out: NodeData = { ...target };

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) {
      delete out[key];
      continue;
    }
    if (rule(key) === MergeRule.Deep && isRecord(value)) {
      out[key] = applyLevel(isRecord(out[key]) ? out[key] : {}, value, DEEP);
      continue;
    }
    out[key] = value;
  }

  return out;
}

export function mergeNodeData(current: NodeData, patch: NodeData): NodeData {
  return applyLevel(current, patch, ruleOf);
}

function nestedOf(data: NodeData, key: string): NodeData {
  const value = data[key];
  return isRecord(value) ? value : {};
}

function baseLevel(saved: NodeData, patch: NodeData, rule: RuleOf): NodeData {
  const out: NodeData = {};

  for (const [key, value] of Object.entries(patch)) {
    if (rule(key) === MergeRule.Deep && isRecord(value)) {
      out[key] = baseLevel(nestedOf(saved, key), value, DEEP);
      continue;
    }
    out[key] = present(saved[key]);
  }

  return out;
}

export function baseOf(saved: NodeData, patch: NodeData): NodeData {
  return baseLevel(saved, patch, ruleOf);
}

function losesItems(current: unknown, base: unknown, wanted: unknown): boolean {
  const listed = Array.isArray(current) || Array.isArray(wanted);
  return listed && !sameValue(current, base) && !sameValue(current, wanted);
}

function clashLevel(current: NodeData, base: NodeData, patch: NodeData, rule: RuleOf, prefix: string): string[] {
  return Object.entries(patch).flatMap(([key, value]) => {
    const path = `${prefix}${key}`;
    if (rule(key) === MergeRule.Deep && isRecord(value) && isRecord(base[key])) {
      return clashLevel(nestedOf(current, key), base[key] as NodeData, value, DEEP, `${path}.`);
    }
    return key in base && losesItems(current[key], base[key], value) ? [path] : [];
  });
}

export function clashingKeys(current: NodeData, base: NodeData, patch: NodeData): string[] {
  return clashLevel(current, base, patch, ruleOf, '');
}
