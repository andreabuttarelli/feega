import type { GenMedium, ModelChoice } from './gen-node';

export enum VariantInto {
  Nodes = 'nodes',
  History = 'history'
}

export const VARIANT_LADDER = [1, 2, 4, 8] as const;

export const VARIANT_DESTINATIONS = [
  { value: VariantInto.Nodes, label: 'Separate nodes' },
  { value: VariantInto.History, label: 'Node history' }
] as const;

export const DEFAULT_VARIANTS = 1;

export const DEFAULT_INTO = VariantInto.Nodes;

const MEDIUM_CAP: Record<GenMedium, number> = { image: 8, video: 4, text: 1, audio: 1, model3d: 1 };

const GAP = 40;

const REMEMBER_PREFIX = 'feega:variants:';

export type VariantsParams = { variants?: unknown; variantsInto?: unknown };

export type RememberedVariants = { count: number; into: VariantInto };

export type VariantsStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type Box = { x: number; y: number; width: number; height: number };

export type VariantsAsk = { ok: true; count: number; into: VariantInto } | { ok: false; error: 'invalid_variants' | 'invalid_variants_into' };

const isCount = (value: unknown): value is number => (VARIANT_LADDER as readonly unknown[]).includes(value);

const isInto = (value: unknown): value is VariantInto => (Object.values(VariantInto) as unknown[]).includes(value);

export function variantCap(medium: GenMedium, choice?: Pick<ModelChoice, 'maxVariants'>): number {
  return Math.min(MEDIUM_CAP[medium], choice?.maxVariants ?? MEDIUM_CAP[medium]);
}

export function variantCountsFor(medium: GenMedium, choice?: Pick<ModelChoice, 'maxVariants'>): number[] {
  const cap = variantCap(medium, choice);
  return VARIANT_LADDER.filter((count) => count <= cap);
}

export function variantsOf(params: VariantsParams, remembered: RememberedVariants | null): number {
  if (isCount(params.variants)) {
    return params.variants;
  }
  return remembered?.count ?? DEFAULT_VARIANTS;
}

export function variantsIntoOf(params: VariantsParams, remembered: RememberedVariants | null): VariantInto {
  if (isInto(params.variantsInto)) {
    return params.variantsInto;
  }
  return remembered?.into ?? DEFAULT_INTO;
}

export function effectiveVariants(
  medium: GenMedium,
  params: VariantsParams,
  remembered: RememberedVariants | null,
  choice?: Pick<ModelChoice, 'maxVariants'>
): number {
  const wanted = variantsOf(params, remembered);
  return Math.max(...variantCountsFor(medium, choice).filter((count) => count <= wanted));
}

export function variantLayout(source: Box, count: number): { x: number; y: number }[] {
  const columns = Math.ceil(Math.sqrt(count));
  const left = source.x + source.width + GAP;

  return Array.from({ length: count }, (_, i) => ({
    x: left + (i % columns) * (source.width + GAP),
    y: source.y + Math.floor(i / columns) * (source.height + GAP)
  }));
}

export function variantsCredits(perRun: number | null, count: number): number | null {
  return perRun === null ? null : perRun * count;
}

const rememberKey = (userId: string) => `${REMEMBER_PREFIX}${userId}`;

export function browserVariantsStorage(): VariantsStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readRemembered(storage: VariantsStorage | null, userId: string): RememberedVariants | null {
  try {
    const raw = storage?.getItem(rememberKey(userId));
    const parsed = raw ? (JSON.parse(raw) as Partial<RememberedVariants>) : null;
    return parsed && isCount(parsed.count) && isInto(parsed.into) ? { count: parsed.count, into: parsed.into } : null;
  } catch {
    return null;
  }
}

export function writeRemembered(storage: VariantsStorage | null, userId: string, choice: RememberedVariants): void {
  try {
    storage?.setItem(rememberKey(userId), JSON.stringify(choice));
  } catch {
    return;
  }
}

export function parseVariantsAsk(raw: { variants?: unknown; into?: unknown }): VariantsAsk {
  const count = raw.variants ?? DEFAULT_VARIANTS;
  if (!isCount(count)) {
    return { ok: false, error: 'invalid_variants' };
  }

  const into = raw.into ?? DEFAULT_INTO;
  if (!isInto(into)) {
    return { ok: false, error: 'invalid_variants_into' };
  }
  return { ok: true, count, into };
}
