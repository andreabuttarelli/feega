import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { syncAiModels } from './ai-models-sync';
import { offerableModels } from './offerable-models';

const LIVE = process.env.OPENROUTER_LIVE === '1';
const BASE_URL = 'https://openrouter.ai/api/v1';
const LIVE_TIMEOUT_MS = 60_000;

function memoryAdmin() {
  const rows: Record<string, unknown>[] = [];
  const admin = {
    from: () => ({
      upsert: (incoming: Record<string, unknown>[]) => {
        rows.push(...incoming);
        return { then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }) };
      },
      select: () => ({
        eq: (column: string, value: string) => ({
          then: (resolve: (result: { data: Record<string, unknown>[]; error: null }) => unknown) =>
            resolve({ data: rows.filter((row) => row[column] === value), error: null })
        })
      })
    })
  } as unknown as SupabaseClient;
  return { admin, rows };
}

describe.skipIf(!LIVE)('OpenRouter immagini, dal vivo', () => {
  it('sincronizza i prezzi reali e distingue Seedream Lite da Pro', async () => {
    const { admin, rows } = memoryAdmin();

    const sync = await syncAiModels(admin, { baseUrl: BASE_URL });
    const catalogue = await offerableModels(admin, 'image');
    const lite = catalogue.choices.find((choice) => choice.id === 'seedream-5-lite');
    const pro = catalogue.choices.find((choice) => choice.id === 'seedream-5-pro');
    const tokenPriced = catalogue.choices.find((choice) => choice.id === 'gpt-image-2.5-sunburst');
    const genericPriced = catalogue.choices.find(
      (choice) => choice.id.includes('/') && typeof choice.unitCredits === 'number'
    );
    const capabilityPriced = catalogue.choices.find(
      (choice) => Object.keys(choice.creditOverrides?.resolution ?? {}).length > 1
    );
    const fixedPrices = new Set(
      catalogue.choices.flatMap((choice) => typeof choice.unitCredits === 'number' ? [choice.unitCredits] : [])
    );

    expect(sync.ok).toBe(true);
    expect(rows.filter((row) => row.catalogue === 'image').length).toBeGreaterThan(50);
    expect(lite?.unitCredits).toBe(7);
    expect(pro?.variableCredits).toBe(true);
    expect(fixedPrices.size).toBeGreaterThan(1);
    expect(genericPriced).toBeDefined();
    expect(capabilityPriced).toBeDefined();
    expect(tokenPriced?.variableCredits).toBe(true);
  }, LIVE_TIMEOUT_MS);
});
