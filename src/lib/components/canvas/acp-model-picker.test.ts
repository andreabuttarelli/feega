import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { AgentModel } from '$lib/acp/agent-models';
import AcpModelPicker from './AcpModelPicker.svelte';

const MODELS: AgentModel[] = [
  { id: 'sol', name: '5.6 Sol', description: null },
  { id: 'luna', name: '6 Luna', description: 'Fast and affordable' }
];

const html = (models: AgentModel[], selected: string | null) => render(AcpModelPicker, { props: { models, selected, onchoose: () => {} } }).body;

describe('the model picker', () => {
  it('lists every model the agent offers and marks the current one', () => {
    const body = html(MODELS, 'luna');

    expect(body).toContain('data-testid="acp-model"');
    expect(body).toContain('5.6 Sol');
    expect(body).toMatch(/value="luna"[^>]*selected/);
    expect(body).toContain('title="Fast and affordable"');
  });

  it('is absent when the agent offers no model choice', () => {
    expect(html([], null)).not.toContain('<select');
  });
});
