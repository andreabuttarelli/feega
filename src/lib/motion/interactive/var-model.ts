export enum VarKind {
  Number = 'number',
  Boolean = 'boolean',
  Enum = 'enum',
  Color = 'color',
  String = 'string'
}

export const VAR_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
export const MAX_VARS = 32;
export const MAX_VAR_TEXT = 500;
export const MAX_OPTIONS = 32;
export const HEX = /^#[0-9a-fA-F]{6}$/;

export type VarDecl =
  | { name: string; kind: VarKind.Number; default: number; min: number; max: number }
  | { name: string; kind: VarKind.Boolean; default: boolean }
  | { name: string; kind: VarKind.Enum; default: string; options: string[] }
  | { name: string; kind: VarKind.Color; default: string }
  | { name: string; kind: VarKind.String; default: string };
export type VarValue = number | boolean | string;
export type VarValues = Record<string, VarValue>;
export type VarBinding = { var: string; clip: string; prop: string };

export enum BindPaint {
  Text = 'text',
  Color = 'color',
  Background = 'background'
}

export type PaintBinding = { var: string; selector: string; paint: BindPaint };

type Kind<D extends VarDecl> = {
  numeric: (decl: D, value: VarValue) => number | undefined;
  problem: (decl: D) => string | null;
};

const ofKind = <K extends VarKind>(kind: Kind<Extract<VarDecl, { kind: K }>>) => kind;

const KINDS: { [K in VarKind]: Kind<Extract<VarDecl, { kind: K }>> } = {
  [VarKind.Number]: ofKind({
    numeric: (_d, v) => v as number,
    problem: (d) => (d.min > d.max ? `${d.name}: min is above max` : d.default < d.min || d.default > d.max ? `${d.name}: default ${d.default} is outside ${d.min}..${d.max}` : null)
  }),
  [VarKind.Boolean]: ofKind({
    numeric: (_d, v) => (v ? 1 : 0),
    problem: () => null
  }),
  [VarKind.Enum]: ofKind({
    numeric: (d, v) => d.options.indexOf(v as string),
    problem: (d) => (d.options.includes(d.default) ? null : `${d.name}: default "${d.default}" is not one of ${d.options.join(', ')}`)
  }),
  [VarKind.Color]: ofKind({
    numeric: () => undefined,
    problem: () => null
  }),
  [VarKind.String]: ofKind({
    numeric: () => undefined,
    problem: () => null
  })
};

const kindOf = (decl: VarDecl) => KINDS[decl.kind] as Kind<VarDecl>;

export function kindProblem(decl: VarDecl): string | null {
  return kindOf(decl).problem(decl);
}

export function defaultsOf(decls: readonly VarDecl[]): VarValues {
  return Object.fromEntries(decls.map((d) => [d.name, d.default]));
}

export type VarRules = { kinds: Record<keyof typeof VarKind, VarKind>; hex: string; maxText: number };

export const VAR_RULES: VarRules = { kinds: { ...VarKind }, hex: HEX.source, maxText: MAX_VAR_TEXT };

export function coerceVars(decls: readonly VarDecl[], raw: unknown, rules: VarRules = VAR_RULES): VarValues {
  const given = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const hex = new RegExp(rules.hex);
  const text = (v: unknown): v is string => typeof v === 'string';
  const read: Record<string, (d: VarDecl, v: unknown) => VarValue | undefined> = {
    [rules.kinds.Number]: (d, v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min((d as { max: number }).max, Math.max((d as { min: number }).min, v)) : undefined),
    [rules.kinds.Boolean]: (_d, v) => (typeof v === 'boolean' ? v : undefined),
    [rules.kinds.Enum]: (d, v) => (text(v) && (d as { options: string[] }).options.includes(v) ? v : undefined),
    [rules.kinds.Color]: (_d, v) => (text(v) && hex.test(v) ? v.toLowerCase() : undefined),
    [rules.kinds.String]: (_d, v) => (text(v) ? v.slice(0, rules.maxText) : undefined)
  };
  const out: VarValues = {};
  for (const decl of decls) {
    const value = Object.prototype.hasOwnProperty.call(given, decl.name) ? read[decl.kind]?.(decl, given[decl.name]) : undefined;
    if (value !== undefined) {
      out[decl.name] = value;
    }
  }
  return out;
}

export function numericVars(decls: readonly VarDecl[], values: VarValues): Record<string, number> {
  const out: Record<string, number> = {};
  for (const decl of decls) {
    const value = kindOf(decl).numeric(decl, values[decl.name] ?? decl.default);
    if (value !== undefined) {
      out[decl.name] = value;
    }
  }
  return out;
}

export function varSchemaOf(decls: readonly VarDecl[]): VarDecl[] {
  return decls.map((d) => ({ ...d }));
}

export const VARS_GUIDE = `Runtime variables (interactive web export): named values the site that embeds the video sets from its own code (number with min..max, boolean, enum of options, color #rrggbb, string), each with a default. Expressions read numbers as vars.<name> (boolean 1/0, enum the option index), so "input.time * vars.speed * 90" spins faster when the host raises speed; text and colours bind straight to a text layer (bind_var). Videos and the preview use the defaults.`;
