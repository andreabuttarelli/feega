import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import VideoBudget from './VideoBudget.svelte';

describe('video budget card', () => {
  it('tells the cost so far and offers to continue for a named amount', () => {
    const body = render(VideoBudget, { props: { budget: { ok: true, spent_usd: 2.04, cap_usd: 2, raise_usd: 1 }, oncontinue: () => {} } }).body;

    expect(body).toContain('$2.04');
    expect(body).toContain('Continue (+$1.00)');
    expect(body).toContain('data-testid="budget-continue"');
  });
});
