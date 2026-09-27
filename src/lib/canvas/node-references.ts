import { z } from 'zod';

export const REFERENCE_SOURCES = ['catalogue', 'asset'] as const;

export type ReferenceSource = (typeof REFERENCE_SOURCES)[number];

export const nodeReferenceSchema = z.object({
  source: z.enum(REFERENCE_SOURCES),
  id: z.string().min(1)
});

export type NodeReference = z.infer<typeof nodeReferenceSchema>;

export function referencesOf(data: Record<string, unknown>): NodeReference[] {
  const raw = Array.isArray(data.references) ? data.references : [];
  return raw.flatMap((item) => {
    const parsed = nodeReferenceSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function sameReference(a: NodeReference, b: NodeReference): boolean {
  return a.source === b.source && a.id === b.id;
}

export function removeReference(list: NodeReference[], ref: NodeReference): NodeReference[] {
  return list.filter((item) => !sameReference(item, ref));
}

export function toggleReference(list: NodeReference[], ref: NodeReference): NodeReference[] {
  if (list.some((item) => sameReference(item, ref))) {
    return removeReference(list, ref);
  }
  return [...list, ref];
}
