import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SelectionToolbar from './SelectionToolbar.svelte';
import type { RunQuote } from '$lib/canvas/run-quote';

const quote = (patch: Partial<RunQuote> = {}): RunQuote =>
  ({ label: 'Generate', credits: 4, variants: null, variable: false, enabled: true, reason: null, tooLong: false, choice: undefined, cost: { medium: 'image', params: {} }, ...patch }) as RunQuote;

function toolbar(data: Record<string, unknown>, runQuote: RunQuote) {
  return render(SelectionToolbar, {
    props: { box: { x: 100, y: 100, width: 200 }, count: 1, nodeSummaries: [{ id: 'n', type: 'image', data }], runQuote }
  }).body;
}

describe('the run button', () => {
  it('turns into Stop in place while the node runs, with no separate Stop control', () => {
    const body = toolbar({ running: true }, quote());

    expect(body.match(/data-control="run"/g)).toHaveLength(1);
    expect(body).toMatch(/data-control="run"[^>]*data-testid="stop-run"|data-testid="stop-run"[^>]*data-control="run"/);
    expect(body).not.toContain('role="group" aria-label="Stop"');
    expect(body).toContain('run-ring');
  });

  it('stays hoverable when disabled so its tooltip can say why', () => {
    const body = toolbar({}, quote({ enabled: false, reason: 'Write a prompt first' }));
    const run = body.match(/<button[^>]*data-control="run"[^>]*>/)![0];

    expect(run).toContain('aria-disabled="true"');
    expect(run).not.toMatch(/\sdisabled(=|\s|>)/);
  });
});
