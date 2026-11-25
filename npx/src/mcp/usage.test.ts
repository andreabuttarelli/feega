import { describe, expect, it } from 'vitest';
import type { UsageEvent } from '../../../inspect/src/host/usage';
import { mcpUsage } from './usage';

const INSTALL = '3f1c9a52-5b0e-4c1d-9a54-0d2f6f1e7a10';

function setup(env: NodeJS.ProcessEnv = {}) {
  const sent: UsageEvent[][] = [];
  const usage = mcpUsage({ cwd: '/nonexistent-project', env, version: '0.3.0', install: { get: () => INSTALL, set: () => undefined }, send: async (events) => void sent.push(events) });

  return { usage, sent };
}

describe('mcpUsage', () => {
  it('sends the tool name only', async () => {
    const t = setup();
    t.usage.called('feega_edit');
    await t.usage.end();

    const call = t.sent.flat().find((e) => e.event === 'mcp_tool_call');
    expect(call).toMatchObject({ tool: 'feega_edit', editor: 'npx', install_id: INSTALL });
    expect(JSON.stringify(t.sent)).not.toContain('nonexistent-project');
  });

  it('sends nothing when the user opted out', async () => {
    const t = setup({ DO_NOT_TRACK: '1' });
    t.usage.called('feega_edit');
    await t.usage.end();

    expect(t.sent).toEqual([]);
  });
});
