export type NodeData = Record<string, unknown>;

export enum MergeRule {
  Replace = 'replace',
  OneLevel = 'one-level'
}

const MERGE_RULES: Readonly<Record<string, MergeRule>> = {
  params: MergeRule.OneLevel,
  filters: MergeRule.OneLevel
};

function ruleOf(key: string): MergeRule {
  return MERGE_RULES[key] ?? MergeRule.Replace;
}

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

function mergesOneLevel(key: string, a: unknown, b: unknown): boolean {
  return ruleOf(key) === MergeRule.OneLevel && isRecord(a) && isRecord(b);
}

function diffLevel(before: NodeData, after: NodeData, keys: string[]): NodeData {
  const out: NodeData = {};
  for (const key of keys) {
    if (sameValue(before[key], after[key])) {
      continue;
    }
    out[key] = present(after[key]);
  }
  return out;
}

export function diffNodeData(saved: NodeData, next: NodeData, keys: string[] = Object.keys(next)): NodeData {
  const out: NodeData = {};

  for (const key of keys) {
    const before = saved[key];
    const after = next[key];
    if (sameValue(before, after)) {
      continue;
    }

    if (mergesOneLevel(key, before, after)) {
      const inner = before as NodeData;
      const outer = after as NodeData;
      out[key] = diffLevel(inner, outer, [...new Set([...Object.keys(inner), ...Object.keys(outer)])]);
      continue;
    }

    out[key] = present(after);
  }

  return out;
}

function applyLevel(target: NodeData, patch: NodeData, nested: (key: string) => MergeRule): NodeData {
  const out: NodeData = { ...target };

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) {
      delete out[key];
      continue;
    }
    if (nested(key) === MergeRule.OneLevel && isRecord(value)) {
      out[key] = applyLevel(isRecord(out[key]) ? out[key] : {}, value, () => MergeRule.Replace);
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

export function baseOf(saved: NodeData, patch: NodeData): NodeData {
  const out: NodeData = {};

  for (const [key, value] of Object.entries(patch)) {
    if (ruleOf(key) === MergeRule.OneLevel && isRecord(value)) {
      const inner = nestedOf(saved, key);
      out[key] = Object.fromEntries(Object.keys(value).map((sub) => [sub, present(inner[sub])]));
      continue;
    }
    out[key] = present(saved[key]);
  }

  return out;
}

function clashes(current: unknown, base: unknown, wanted: unknown): boolean {
  return !sameValue(current, base) && !sameValue(current, wanted);
}

export function clashingKeys(current: NodeData, base: NodeData, patch: NodeData): string[] {
  const out: string[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (ruleOf(key) === MergeRule.OneLevel && isRecord(value) && isRecord(base[key])) {
      const now = nestedOf(current, key);
      const was = base[key] as NodeData;
      for (const sub of Object.keys(value)) {
        if (clashes(now[sub], was[sub], value[sub])) {
          out.push(`${key}.${sub}`);
        }
      }
      continue;
    }
    if (key in base && clashes(current[key], base[key], value)) {
      out.push(key);
    }
  }

  return out;
}
