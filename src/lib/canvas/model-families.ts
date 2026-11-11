import { CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';
import type { GenMedium, ModelChoice } from './gen-node';
import { listedCredits } from './gen-cost';
import type { RecommendationTier } from './recommended-models';

export type ModelFamily = { key: string; label: string; icon: string | null };

type FamilyRule = ModelFamily & { match: RegExp; strip?: RegExp };

const FAMILIES: readonly FamilyRule[] = [
  { key: 'claude', label: 'Claude', icon: 'claude', match: /claude|anthropic\//, strip: /^claude\s+/i },
  { key: 'gpt', label: 'GPT', icon: 'openai', match: /gpt|dall-e|openai\/o\d/ },
  { key: 'gemini', label: 'Gemini', icon: 'gemini', match: /gemini|nano-banana|nano banana|imagen/ },
  { key: 'veo', label: 'Veo', icon: 'google', match: /veo/ },
  { key: 'grok', label: 'Grok', icon: 'x-ai', match: /grok|x-ai\// },
  { key: 'qwen', label: 'Qwen', icon: 'qwen', match: /qwen/ },
  { key: 'kimi', label: 'Kimi', icon: 'kimi', match: /kimi|moonshot/ },
  { key: 'deepseek', label: 'DeepSeek', icon: 'deepseek', match: /deepseek/ },
  { key: 'llama', label: 'Llama', icon: 'meta', match: /llama|meta\// },
  { key: 'mistral', label: 'Mistral', icon: 'mistralai', match: /mistral/ },
  { key: 'kling', label: 'Kling', icon: 'kuaishou', match: /kling|kwaivgi/ },
  { key: 'seedance', label: 'Seedance', icon: 'bytedance', match: /seedance/ },
  { key: 'seedream', label: 'Seedream', icon: 'bytedance', match: /seedream|seededit/ },
  { key: 'hailuo', label: 'Hailuo', icon: 'minimax', match: /hailuo|minimax/ },
  { key: 'wan', label: 'Wan', icon: 'alibaba', match: /\bwan[-\s]?\d|wan-ai|\/wan/ },
  { key: 'sora', label: 'Sora', icon: 'openai', match: /sora/ },
  { key: 'flux', label: 'Flux', icon: 'flux', match: /flux|black-forest/ },
  { key: 'ideogram', label: 'Ideogram', icon: 'ideogram', match: /ideogram/ },
  { key: 'recraft', label: 'Recraft', icon: 'recraft', match: /recraft/ },
  { key: 'runway', label: 'Runway', icon: 'runway', match: /runway|gen-4/ },
  { key: 'luma', label: 'Luma', icon: 'luma', match: /luma|ray-?2/ },
  { key: 'elevenlabs', label: 'ElevenLabs', icon: 'elevenlabs', match: /eleven/ },
  { key: 'suno', label: 'Suno', icon: 'suno', match: /suno/ },
  { key: 'hunyuan', label: 'Hunyuan', icon: 'tencent', match: /hunyuan|tencent/ },
  { key: 'trellis', label: 'Trellis', icon: 'microsoft', match: /trellis/ },
  { key: 'higgsfield', label: 'Higgsfield', icon: 'higgsfield', match: /higgsfield|soul/ }
];

const FAMILY_ORDER = new Map(FAMILIES.map((family, index) => [family.key, index]));

function haystack(choice: ModelChoice): string {
  return `${choice.id} ${choice.wireId ?? ''} ${choice.label}`.toLowerCase();
}

function ruleOf(choice: ModelChoice): FamilyRule | undefined {
  const text = haystack(choice);
  return FAMILIES.find((family) => family.match.test(text));
}

export function familyOf(choice: ModelChoice): ModelFamily {
  const rule = ruleOf(choice);
  if (!rule) {
    return { key: choice.provider, label: choice.providerLabel, icon: choice.provider };
  }
  return { key: rule.key, label: rule.label, icon: rule.icon };
}

const VENDOR_PREFIX = /^[^:]+:\s*/;
const CODENAME = /\s*\([^()]*\)\s*$/;

function titleCase(slug: string): string {
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function modelName(choice: ModelChoice): string {
  const raw = choice.label.includes('/') ? titleCase(choice.label.split('/').pop() ?? choice.label) : choice.label;
  const bare = raw.replace(VENDOR_PREFIX, '').replace(CODENAME, '').trim();
  const strip = ruleOf(choice)?.strip;
  const name = strip ? bare.replace(strip, '') : bare;
  return name || raw;
}

export type PriceHeader = { unit: string; detail: string };

const PRICE_HEADER: Record<GenMedium, PriceHeader> = {
  text: { unit: 'Per 1M tokens', detail: 'in / out' },
  image: { unit: 'Per image', detail: 'from' },
  video: { unit: 'Per second', detail: 'from' },
  audio: { unit: 'Per 1K chars', detail: 'from' },
  model3d: { unit: 'Per run', detail: 'from' }
};

export function priceHeader(medium: GenMedium): PriceHeader {
  return PRICE_HEADER[medium];
}

const CHARS_PER_PRICE = 1000;
const CENT = 0.01;

function dollars(credits: number): string {
  const usd = credits / CREDITS_PER_USD_SUBSCRIPTION_LIST;
  if (usd >= 1 && Number.isInteger(usd)) {
    return `$${usd}`;
  }
  if (usd < CENT) {
    return `$${Number(usd.toPrecision(1))}`;
  }
  return `$${usd.toFixed(2)}`;
}

function cheapestPerSecond(choice: ModelChoice): number | undefined {
  const rates = Object.values(choice.perSecondCredits ?? {}).flatMap((byResolution) => Object.values(byResolution ?? {}));
  return rates.length ? Math.min(...rates) : undefined;
}

const PRICE_OF: Record<GenMedium, (choice: ModelChoice) => string | null> = {
  text: (c) => (c.textPricing ? `${dollars(c.textPricing.inputCreditsPerMillion)} / ${dollars(c.textPricing.outputCreditsPerMillion)}` : null),
  image: (c) => unitPrice(c),
  video: (c) => {
    const rate = cheapestPerSecond(c);
    return rate === undefined ? null : dollars(rate);
  },
  audio: (c) => (c.creditsPerCharacter ? dollars(c.creditsPerCharacter * CHARS_PER_PRICE) : unitPrice(c)),
  model3d: (c) => unitPrice(c)
};

function unitPrice(choice: ModelChoice): string | null {
  const credits = listedCredits(choice);
  return credits === undefined ? null : dollars(credits);
}

export function priceLabel(choice: ModelChoice, medium: GenMedium): string | null {
  return PRICE_OF[medium](choice);
}

export type MenuModel = { choice: ModelChoice; name: string; family: ModelFamily };

export type FamilyGroup = ModelFamily & { models: MenuModel[] };

export const RECOMMENDED_FAMILY = 'recommended';

const UNKNOWN_ORDER = FAMILIES.length;

function versionOf(name: string): number {
  const match = name.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

function newestFirst(models: MenuModel[]): MenuModel[] {
  return [...models].sort((a, b) => versionOf(b.name) - versionOf(a.name));
}

function menuModel(choice: ModelChoice): MenuModel {
  return { choice, name: modelName(choice), family: familyOf(choice) };
}

function byFamily(models: MenuModel[]): FamilyGroup[] {
  const groups = new Map<string, FamilyGroup>();
  for (const model of models) {
    const group = groups.get(model.family.key) ?? { ...model.family, models: [] };
    group.models.push(model);
    groups.set(model.family.key, group);
  }

  const rank = (key: string) => FAMILY_ORDER.get(key) ?? UNKNOWN_ORDER;
  return [...groups.values()]
    .sort((a, b) => rank(a.key) - rank(b.key))
    .map((group) => ({ ...group, models: newestFirst(group.models) }));
}

export function familyGroups(choices: ModelChoice[]): FamilyGroup[] {
  const models = choices.map(menuModel);
  const recommended = models.filter((m) => m.choice.tiers?.length);
  const head: FamilyGroup[] = recommended.length ? [{ key: RECOMMENDED_FAMILY, label: 'Recommended', icon: null, models: recommended }] : [];
  const modes = [...new Set(models.map((m) => m.choice.menuGroup).filter((g): g is string => Boolean(g)))].map((mode) => ({
    key: mode,
    label: mode,
    icon: null,
    models: models.filter((m) => m.choice.menuGroup === mode)
  }));

  return [...head, ...modes, ...byFamily(models.filter((m) => !m.choice.menuGroup))];
}

export function searchModels(choices: ModelChoice[], query: string): MenuModel[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }
  return choices.map(menuModel).filter((m) => `${m.name} ${m.choice.label} ${m.family.label} ${m.choice.providerLabel}`.toLowerCase().includes(q));
}

export const TIER_LABEL: Record<RecommendationTier, string> = {
  best: 'Best',
  balanced: 'Balanced',
  'cheapest-good': 'Best value'
};

export enum IconTone {
  Brand = 'brand',
  Mono = 'mono'
}

export enum MenuColumn {
  Family = 'family',
  Model = 'model',
  Route = 'route'
}
