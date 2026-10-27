import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Db } from '$lib/server/db/client';
import { openFeegaStore } from './feega-store';
import { syncLocalModels } from './local-models';

const ROWS = [
  { id: 'google/gemini-3.1-flash-image', catalogue: 'image', provider: 'openrouter' },
  { id: 'kie/nano-banana-2', catalogue: 'image', provider: 'kie' }
];

function store() {
  return openFeegaStore(join(mkdtempSync(join(tmpdir(), 'feega-models-')), 'm.feega'), { origin: 'http://127.0.0.1:5173' });
}

const fakeSync = (db: Db) => async () => {
  await db.from('ai_models').upsert(ROWS, { onConflict: 'id,catalogue' });
  return { ok: true as const, synced: ROWS.length };
};

async function offered(env: Record<string, string>) {
  const { db } = store();
  await syncLocalModels(db, env, fakeSync(db));
  const { data } = await db.from('ai_models').select('provider');
  return (data ?? []).map((row) => row.provider).sort();
}

describe('i modelli offerti in locale sono quelli con una chiave', () => {
  it('con la sola chiave kie restano i modelli kie', async () => {
    expect(await offered({ KIE_API_KEY: 'k' })).toEqual(['kie']);
  });

  it('con la sola chiave OpenRouter restano i modelli OpenRouter', async () => {
    expect(await offered({ OPENROUTER_API_KEY: 'k' })).toEqual(['openrouter']);
  });

  it('LLM_API_KEY vale come chiave OpenRouter', async () => {
    expect(await offered({ LLM_API_KEY: 'k' })).toEqual(['openrouter']);
  });

  it('con entrambe restano tutti', async () => {
    expect(await offered({ KIE_API_KEY: 'k', LLM_API_KEY: 'k' })).toEqual(['kie', 'openrouter']);
  });
});

describe('la stessa id su due listini non collide', () => {
  it('chat e immagine tengono entrambe la riga', async () => {
    const { db } = store();
    const both = [{ id: 'google/x', catalogue: 'chat', provider: 'openrouter' }, { id: 'google/x', catalogue: 'image', provider: 'openrouter' }];

    const { error } = await db.from('ai_models').upsert(both, { onConflict: 'id,catalogue' });

    expect(error).toBeNull();
  });
});
