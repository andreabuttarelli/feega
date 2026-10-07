import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import ScriptBrief from './ScriptBrief.svelte';

describe('script brief card', () => {
  it('shows research and script with a go button and a countdown', () => {
    const body = render(ScriptBrief, { props: { brief: '**Research**\n- For: makers\n\n**Script**\n- 0–3 s, problem: a messy inbox', seconds: 8, ongo: () => {}, onedit: () => {} } }).body;

    expect(body).toContain('data-testid="script-brief"');
    expect(body).toContain('For: makers');
    expect(body).toContain('a messy inbox');
    expect(body).toContain('data-testid="brief-go"');
    expect(body).toContain('data-testid="brief-edit"');
    expect(body).toContain('8');
  });
});
