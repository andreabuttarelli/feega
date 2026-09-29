import { usableGatewayModels, type GatewayModel } from '$lib/server/openrouter-models';

export const FALLBACK_CHAT_MODEL_IDS = [
  'anthropic/claude-opus-5',
  'anthropic/claude-sonnet-5',
  'anthropic/claude-haiku-4.5',
  'openai/gpt-5.6-sol',
  'google/gemini-3.7-flash',
  'x-ai/grok-4.6',
  'deepseek/deepseek-v4-flash-vision-exp',
  'z-ai/glm-5.3-flash'
];

const vendorOf = (id: string) => id.split('/')[0] ?? '';

/** `:batch`, `:free`, `~vendor/...`: varianti dello stesso modello, non modelli nuovi. */
const isVariant = (id: string) => id.includes(':') || id.startsWith('~');

const newestFirst = (a: GatewayModel, b: GatewayModel) => b.created - a.created;

export function newModelsForCatalog(known: string[]): string[] {
  const followed = new Set(known.map(vendorOf));
  const byVendor = new Map<string, GatewayModel>();

  for (const model of usableGatewayModels()) {
    if (isVariant(model.id)) continue;

    const vendor = vendorOf(model.id);
    if (!followed.has(vendor)) continue;

    const best = byVendor.get(vendor);
    if (!best || newestFirst(best, model) > 0) byVendor.set(vendor, model);
  }

  const owned = new Set(known);
  return [...byVendor.values()].filter((m) => !owned.has(m.id)).sort(newestFirst).map((m) => m.id);
}
