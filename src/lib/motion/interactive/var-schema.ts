import { z } from 'zod';
import { HEX, MAX_OPTIONS, MAX_VAR_TEXT, VAR_NAME, VarKind, kindProblem, type VarBinding, type VarDecl } from './var-model';

const name = z.string().regex(VAR_NAME, 'a variable name is letters, digits and _, not starting with a digit');
const hex = z.string().regex(HEX, 'a colour is #rrggbb');

export const varDeclSchema: z.ZodType<VarDecl> = z.discriminatedUnion('kind', [
  z.object({ name, kind: z.literal(VarKind.Number), default: z.number().finite(), min: z.number().finite(), max: z.number().finite() }).strict(),
  z.object({ name, kind: z.literal(VarKind.Boolean), default: z.boolean() }).strict(),
  z.object({ name, kind: z.literal(VarKind.Enum), default: z.string(), options: z.array(z.string().min(1)).min(1).max(MAX_OPTIONS) }).strict(),
  z.object({ name, kind: z.literal(VarKind.Color), default: hex }).strict(),
  z.object({ name, kind: z.literal(VarKind.String), default: z.string().max(MAX_VAR_TEXT) }).strict()
]);

export const varBindingSchema: z.ZodType<VarBinding> = z.object({ var: name, clip: z.string(), prop: z.string() }).strict();

export function varProblem(decl: VarDecl): string | null {
  const parsed = varDeclSchema.safeParse(decl);
  if (!parsed.success) {
    return `${decl.name}: ${parsed.error.issues.map((i) => i.message).join('; ')}`;
  }
  return kindProblem(decl);
}
