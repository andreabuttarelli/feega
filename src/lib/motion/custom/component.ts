import { z } from 'zod';
import { COLOR, CUSTOM_NAME } from '../components';
import { contentStamp } from '../stamp';

export { CUSTOM_NAME };
export const MAX_HTML = 20_000;
export const MAX_CSS = 20_000;
export const MAX_JS = 40_000;
export const MAX_PROPS = 30;
export const MAX_COMPONENTS = 24;
const PROP_KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;

export enum PropFormat {
  Color = 'color',
  Textarea = 'textarea',
  Asset = 'asset'
}

export enum CheckState {
  Unchecked = 'unchecked',
  Passed = 'passed',
  Failed = 'failed'
}

const propSpecSchema = z
  .object({
    type: z.enum(['string', 'number', 'boolean']),
    title: z.string().max(60).optional(),
    description: z.string().max(200).optional(),
    default: z.union([z.string().max(2000), z.number(), z.boolean()]).optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    step: z.number().positive().optional(),
    enum: z.array(z.string().max(60)).min(1).max(20).optional(),
    format: z.enum([PropFormat.Color, PropFormat.Textarea, PropFormat.Asset]).optional(),
    maxLength: z.number().int().positive().max(2000).optional()
  })
  .strict();

export const propsSchemaSchema = z
  .object({
    type: z.literal('object').default('object'),
    properties: z.record(z.string().regex(PROP_KEY, 'prop names are identifiers'), propSpecSchema).refine((p) => Object.keys(p).length <= MAX_PROPS, `at most ${MAX_PROPS} props`)
  })
  .strict();

export const sourceSchema = z.object({ html: z.string().max(MAX_HTML), css: z.string().max(MAX_CSS), js: z.string().max(MAX_JS) }).strict();

export const checkSchema = z.object({ hash: z.string(), state: z.enum(CheckState), problems: z.array(z.string().max(500)).max(20) }).strict();

export const customComponentSchema = z
  .object({
    source: sourceSchema,
    propsSchema: propsSchemaSchema,
    version: z.number().int().min(1),
    check: checkSchema.nullable().default(null)
  })
  .strict();

export type PropSpec = z.infer<typeof propSpecSchema>;
export type PropsSchema = z.infer<typeof propsSchemaSchema>;
export type CustomSource = z.infer<typeof sourceSchema>;
export type ComponentCheck = z.infer<typeof checkSchema>;
export type CustomComponent = z.infer<typeof customComponentSchema>;
export type CustomComponents = Record<string, CustomComponent>;

export const SOURCE_FILES = ['html', 'css', 'js'] as const;
export type SourceFile = (typeof SOURCE_FILES)[number];

export type ComponentVerdict = { ok: true; component: CustomComponent } | { ok: false; error: string };

const issues = (error: z.ZodError) => error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');

export function parseComponent(input: unknown): ComponentVerdict {
  const parsed = customComponentSchema.safeParse(input);
  return parsed.success ? { ok: true, component: parsed.data } : { ok: false, error: issues(parsed.error) };
}

export enum Strictness {
  Strict = 'strict',
  Lenient = 'lenient'
}

type ValueRule = (spec: PropSpec, value: unknown) => string | null;

const TYPE_RULES: Record<PropSpec['type'], ValueRule> = {
  string: (spec, value) => {
    if (typeof value !== 'string') {
      return 'expected text';
    }
    if (spec.enum && !spec.enum.includes(value)) {
      return `expected one of ${spec.enum.join(', ')}`;
    }
    if (spec.format === PropFormat.Color && !COLOR.test(value)) {
      return 'expected #rrggbb, transparent or a brand colour';
    }
    return value.length > (spec.maxLength ?? 2000) ? 'text too long' : null;
  },
  number: (spec, value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'expected a number';
    }
    if (spec.minimum !== undefined && value < spec.minimum) {
      return `below ${spec.minimum}`;
    }
    return spec.maximum !== undefined && value > spec.maximum ? `above ${spec.maximum}` : null;
  },
  boolean: (_, value) => (typeof value === 'boolean' ? null : 'expected true or false')
};

const FALLBACK: Record<PropSpec['type'], (spec: PropSpec) => string | number | boolean> = {
  string: (spec) => spec.enum?.[0] ?? '',
  number: (spec) => spec.minimum ?? 0,
  boolean: () => false
};

export function defaultOf(spec: PropSpec): string | number | boolean {
  return spec.default ?? FALLBACK[spec.type](spec);
}

export type ValuesVerdict = { ok: true; values: Record<string, unknown> } | { ok: false; error: string };

export function customValues(component: Pick<CustomComponent, 'propsSchema'>, given: Record<string, unknown>, strictness: Strictness): ValuesVerdict {
  const values: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(component.propsSchema.properties)) {
    if (!(key in given) || given[key] === undefined) {
      values[key] = defaultOf(spec);
      continue;
    }
    const problem = TYPE_RULES[spec.type](spec, given[key]);
    if (problem && strictness === Strictness.Strict) {
      return { ok: false, error: `${key}: ${problem}` };
    }
    values[key] = problem ? defaultOf(spec) : given[key];
  }

  const unknown = Object.keys(given).filter((k) => !(k in component.propsSchema.properties));
  if (unknown.length && strictness === Strictness.Strict) {
    return { ok: false, error: `unknown props ${unknown.join(', ')}; this component takes ${Object.keys(component.propsSchema.properties).join(', ') || 'none'}` };
  }
  return { ok: true, values };
}

export function sourceHash(component: Pick<CustomComponent, 'source' | 'propsSchema'>): string {
  return contentStamp(JSON.stringify([component.source.html, component.source.css, component.source.js, component.propsSchema]));
}

export function checkState(component: CustomComponent): CheckState {
  if (!component.check || component.check.hash !== sourceHash(component)) {
    return CheckState.Unchecked;
  }
  return component.check.state;
}
