import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { AgentModel } from '$lib/acp/agent-models';
import AcpModelPicker from './AcpModelPicker.svelte';

const MODELS: AgentModel[] = [
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: null },
  { id: 'anthropic/claude-sonnet', name: 'Claude Sonnet', description: 'Balanced' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: null }
];

const html = (models: AgentModel[], selected: string | null, open = true) => render(AcpModelPicker, { props: { models, selected, open, onchoose: () => {} } }).body;

describe('the model picker', () => {
  it('shows the current model on its trigger', () => {
    const body = html(MODELS, 'anthropic/claude-sonnet', false);

    expect(body).toContain('data-testid="acp-model"');
    expect(body).toContain('Claude Sonnet');
    expect(body).not.toContain('data-testid="acp-model-search"');
  });

  it('opens with a search box and the models grouped by provider', () => {
    const body = html(MODELS, 'anthropic/claude-sonnet');

    expect(body).toContain('data-testid="acp-model-search"');
    expect(body.indexOf('>google<')).toBeLessThan(body.indexOf('Gemini 2.5 Flash'));
    expect(body.indexOf('Gemini 2.5 Flash')).toBeLessThan(body.indexOf('>anthropic<'));
    expect(body).toMatch(/aria-selected="true"[^>]*data-model="anthropic\/claude-sonnet"/);
    expect(body).toContain('title="Balanced"');
  });

  it('is absent when the agent offers no model choice', () => {
    expect(html([], null)).not.toContain('acp-model');
  });
});
