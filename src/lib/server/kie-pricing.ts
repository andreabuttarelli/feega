export const KIE_PRICING_URL = 'https://api.kie.ai/client/v1/model-pricing/page';

const PAGE_SIZE = 100;

const KIE_OK = 200;

export enum KieUnit {
  Image = 'per image',
  Second = 'per second',
  Video = 'per video',
  Generation = 'per generation'
}

const UNITS: ReadonlySet<string> = new Set(Object.values(KieUnit));

export type KieLine = { credits: number; unit: KieUnit; resolution: string | null; tier: string | null; descriptionKey: string };

export type KieModelPrices = { catalogue: string; lines: KieLine[] };

export type KiePrices = ReadonlyMap<string, KieModelPrices>;

type PriceRecord = { modelDescription?: string; interfaceType?: string; creditPrice?: string; creditUnit?: string; anchor?: string };

type PricePage = { code?: number; msg?: string; data?: { records?: PriceRecord[]; pages?: number } | null };

export const modelKeyOf = (id: string): string => id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const DESCRIPTION_ALIASES: Readonly<Record<string, string>> = {
  'qwen2-1/text-to-image': 'qwen-image-2-1-text-to-image'
};

const RESOLUTION = /\b\d(?:\.\d)?K\b|\b\d{3,4}p\b/gi;

const SPLIT_RESOLUTION = /\b(\d)\/(\d)K\b/i;

const TIER = /\b(TURBO|BALANCED|QUALITY)\b/;

const canonical = (token: string): string => (/k$/i.test(token) ? token.toUpperCase() : token.toLowerCase());

function resolutionsOf(description: string): Array<string | null> {
  const split = description.match(SPLIT_RESOLUTION);
  if (split) {
    return [`${split[1]}K`, `${split[2]}K`];
  }
  const found = (description.match(RESOLUTION) ?? []).map(canonical);
  return found.length === 1 ? found : [null];
}

function keyOfAnchor(anchor: string): string | null {
  try {
    const url = new URL(anchor);
    const model = url.searchParams.get('model') ?? url.pathname.split('/').filter(Boolean).pop();
    return model ? modelKeyOf(model) : null;
  } catch {
    return null;
  }
}

export function pricesOf(records: readonly PriceRecord[]): KiePrices {
  const prices = new Map<string, KieModelPrices>();
  for (const record of records) {
    const key = keyOfAnchor(record.anchor ?? '');
    const credits = Number(record.creditPrice);
    if (!key || !UNITS.has(record.creditUnit ?? '') || !Number.isFinite(credits) || credits <= 0) {
      continue;
    }
    const description = record.modelDescription ?? '';
    const tier = description.match(TIER)?.[1] ?? null;
    const entry = prices.get(key) ?? { catalogue: record.interfaceType ?? '', lines: [] };
    for (const resolution of resolutionsOf(description)) {
      entry.lines.push({ credits, unit: record.creditUnit as KieUnit, resolution, tier, descriptionKey: modelKeyOf(description) });
    }
    prices.set(key, entry);
  }
  return prices;
}

async function pageOf(doFetch: typeof fetch, pageNum: number): Promise<{ records: PriceRecord[]; pages: number }> {
  const res = await doFetch(KIE_PRICING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageNum, pageSize: PAGE_SIZE })
  });
  if (!res.ok) {
    throw new Error(`kie_pricing_failed: HTTP ${res.status}`);
  }
  const reply = (await res.json()) as PricePage;
  if (reply.code !== KIE_OK || !reply.data?.records) {
    throw new Error(`kie_pricing_failed: ${reply.code} ${reply.msg ?? ''}`.trim());
  }
  return { records: reply.data.records, pages: reply.data.pages ?? 1 };
}

export async function fetchKiePrices(doFetch: typeof fetch = fetch): Promise<KiePrices> {
  const first = await pageOf(doFetch, 1);
  const rest = await Promise.all(Array.from({ length: Math.max(first.pages - 1, 0) }, (_, i) => pageOf(doFetch, i + 2)));
  const prices = pricesOf([first, ...rest].flatMap((page) => page.records));
  if (!prices.size) {
    throw new Error('kie_pricing_failed: empty price list');
  }
  return prices;
}

export function creditsBy(lines: readonly KieLine[], unit: KieUnit | readonly KieUnit[], keyOf: (line: KieLine) => string | null): Record<string, number> {
  const units = new Set(Array.isArray(unit) ? unit : [unit]);
  const credits: Record<string, number> = {};
  for (const line of lines.filter((l) => units.has(l.unit))) {
    const key = keyOf(line);
    if (key !== null) {
      credits[key] = Math.max(credits[key] ?? 0, line.credits);
    }
  }
  return credits;
}

export function linesOfModel(prices: KiePrices, model: string): KieModelPrices | undefined {
  const key = modelKeyOf(model);
  const direct = prices.get(key);
  if (direct) {
    return direct;
  }
  const prefix = DESCRIPTION_ALIASES[model] ?? key;
  const entries = [...prices.values()].map((entry) => ({ catalogue: entry.catalogue, lines: entry.lines.filter((l) => l.descriptionKey === prefix || l.descriptionKey.startsWith(`${prefix}-`)) }));
  return entries.find((entry) => entry.lines.length);
}
