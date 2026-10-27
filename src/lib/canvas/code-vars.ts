import type { VarValue, VarValues } from './code-frame';

export enum VarType {
  Text = 'text',
  LongText = 'longtext',
  Color = 'color',
  Range = 'range',
  Number = 'number',
  Boolean = 'boolean',
  Select = 'select',
  Image = 'image',
  Font = 'font'
}

export type VarDecl = {
  name: string;
  type: VarType;
  default: VarValue;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
};

export type VarVerdict = { ok: true; value: VarValue } | { ok: false; error: string };

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const IMAGE_URL = /^(https?:\/\/|data:image\/)/i;

const isType = (x: unknown): x is VarType => (Object.values(VarType) as unknown[]).includes(x);

const refuse = (decl: VarDecl, wants: string): VarVerdict => ({ ok: false, error: `${decl.name} (${decl.type}) needs ${wants}` });

function clampRange(decl: VarDecl, value: number): number {
  const min = decl.min ?? -Infinity;
  const max = decl.max ?? Infinity;
  const stepped = decl.step ? (decl.min ?? 0) + Math.round((value - (decl.min ?? 0)) / decl.step) * decl.step : value;
  return Math.min(max, Math.max(min, stepped));
}

const text = (single: boolean) => (decl: VarDecl, value: VarValue): VarVerdict =>
  typeof value !== 'string' ? refuse(decl, 'a string') : single && value.includes('\n') ? refuse(decl, 'a single line') : { ok: true, value };

const CHECK: Record<VarType, (decl: VarDecl, value: VarValue) => VarVerdict> = {
  [VarType.Text]: text(true),
  [VarType.LongText]: text(false),
  [VarType.Font]: text(true),
  [VarType.Color]: (decl, value) => (typeof value === 'string' && HEX.test(value) ? { ok: true, value: value.toLowerCase() } : refuse(decl, 'a hex colour like #ff5100')),
  [VarType.Range]: (decl, value) => (typeof value === 'number' && Number.isFinite(value) ? { ok: true, value: clampRange(decl, value) } : refuse(decl, 'a number')),
  [VarType.Number]: (decl, value) => (typeof value === 'number' && Number.isFinite(value) ? { ok: true, value: clampRange(decl, value) } : refuse(decl, 'a number')),
  [VarType.Boolean]: (decl, value) => (typeof value === 'boolean' ? { ok: true, value } : refuse(decl, 'true or false')),
  [VarType.Select]: (decl, value) => (typeof value === 'string' && decl.options?.includes(value) ? { ok: true, value } : refuse(decl, `one of: ${(decl.options ?? []).join(', ')}`)),
  [VarType.Image]: (decl, value) => (typeof value === 'string' && IMAGE_URL.test(value) ? { ok: true, value } : refuse(decl, 'an http(s) image URL'))
};

export function checkVarValue(decl: VarDecl, value: VarValue): VarVerdict {
  return CHECK[decl.type](decl, value);
}

const BOUNDS = (decl: VarDecl) => `a value between ${decl.min ?? '-∞'} and ${decl.max ?? '∞'}${decl.step ? ` in steps of ${decl.step}` : ''}`;

export function checkVarValues(decls: readonly VarDecl[], values: VarValues): { ok: true; values: VarValues } | { ok: false; error: string } {
  for (const [name, value] of Object.entries(values)) {
    const decl = decls.find((d) => d.name === name);
    if (!decl) {
      return { ok: false, error: `vars.${name} is not declared in the code. Declared: ${decls.map((d) => d.name).join(', ') || 'none'}.` };
    }

    const verdict = checkVarValue(decl, value);
    if (!verdict.ok) {
      return verdict;
    }
    if (verdict.value !== value && typeof value === 'number') {
      return { ok: false, error: `${name} (${decl.type}) needs ${BOUNDS(decl)}` };
    }
  }

  return { ok: true, values };
}

type DeclSpec = { type?: unknown; default?: unknown; label?: unknown; min?: unknown; max?: unknown; step?: unknown; options?: unknown };

const num = (x: unknown) => (typeof x === 'number' ? x : undefined);

export function varDecl(name: string, spec: unknown, shorthand: VarType = VarType.Text): VarDecl | null {
  const full = typeof spec === 'object' && spec !== null && !Array.isArray(spec) ? (spec as DeclSpec) : null;
  const type = full ? full.type : shorthand;
  if (!isType(type)) {
    return null;
  }

  const fallback = (full ? full.default : spec) as VarValue;
  const decl: VarDecl = { name, type, default: fallback };
  if (!full) {
    return decl;
  }

  const extra = {
    label: typeof full.label === 'string' ? full.label : undefined,
    min: num(full.min),
    max: num(full.max),
    step: num(full.step),
    options: Array.isArray(full.options) ? full.options.map(String) : undefined
  };
  return Object.assign(decl, Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)));
}
