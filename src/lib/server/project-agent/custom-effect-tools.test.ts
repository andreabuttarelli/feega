import { describe, expect, it } from 'vitest';
import type { Tool } from 'ai';
import { fakeDb } from '$lib/server/db/fake-db';
import { createProjectTools } from './project-tools';

const FRAG = 'vec4 effect(vec2 uv) { return texture2D(u_src, uv); }';
const stored = { id: 'eff-1', org_id: 'org-1', name: 'dim', version: 1, frag: FRAG, params: [], check_state: 'passed', check_problems: [], cost_ms: 2, deleted_at: null, updated_at: 'now' };

function run(rows: unknown[], name: string, input: unknown) {
  const fake = fakeDb({ effects: rows }, { filter: true });
  const tools = createProjectTools({ db: fake.db, orgId: 'org-1', projectId: 'p', userId: 'user-1' });
  const out = (tools[name] as Tool & { execute: (i: unknown, o: unknown) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c', messages: [] });
  return { out, fake };
}

describe('custom effects from the canvas chat', () => {
  it('write_effect stores a workspace effect as the canvas agent', async () => {
    const { out, fake } = run([], 'write_effect', { name: 'glow', frag: FRAG, params: [] });

    expect(await out).toMatchObject({ ok: true, name: 'glow' });
    expect(fake.calls.find((c) => c.op === 'insert')!.payload).toMatchObject({ org_id: 'org-1', actor_kind: 'agent', actor_id: 'user-1' });
  });

  it('list_effects shows the built-ins and the workspace custom effects, with the step to use', async () => {
    const { out } = run([stored], 'list_effects', {});

    expect(await out).toMatchObject({ custom: [{ effect_id: 'eff-1', name: 'dim', state: 'passed', step: { id: 'custom', ref: 'eff-1' } }] });
  });
});
