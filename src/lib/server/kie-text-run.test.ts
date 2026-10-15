import { describe, expect, it, vi } from 'vitest';
import { computeCostUsd } from './ai-log';
import { runKieText } from './kie-text-run';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const scope = { orgId: 'o', projectId: 'p', userId: 'u' };
const reply = { output: [{ type: 'message', content: [{ type: 'output_text', text: 'ready' }] }], usage: { input_tokens: 2000, output_tokens: 1000 } };

describe('a text node on kie', () => {
  it('writes ai_calls with kie\'s token cost, and that is what it debits', async () => {
    const log = vi.fn();
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify(reply)));

    const out = await runKieText({ config: { apiKey: 'k', fetchFn: fetchFn as unknown as typeof fetch }, log, now: () => 0 }, { model: 'kie/gpt-6-luna', prompt: 'say ready', scope });

    const expected = (2000 * 0.03 + 1000 * 0.15) / 1_000_000;
    expect(out).toEqual({ text: 'ready', costUsd: expected });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ provider: 'kie', model: 'kie/gpt-6-luna', ok: true, flatCostUsd: expected, orgId: 'o' }));
    expect(computeCostUsd(log.mock.calls[0][0])).toBeCloseTo(expected, 6);
  });

  it('a failed call is recorded and costs nothing', async () => {
    const log = vi.fn();
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: 'down' }), { status: 500 }));

    await expect(runKieText({ config: { apiKey: 'k', fetchFn: fetchFn as unknown as typeof fetch }, log }, { model: 'kie/gpt-6-luna', prompt: 'x', scope })).rejects.toThrow(/kie_failed/);
    expect(computeCostUsd(log.mock.calls[0][0])).toBeNull();
  });

  it('refuses when kie has no key', async () => {
    await expect(runKieText({ config: null, log: vi.fn() }, { model: 'kie/gpt-6-luna', prompt: 'x', scope })).rejects.toThrow('kie_not_configured');
  });
});
