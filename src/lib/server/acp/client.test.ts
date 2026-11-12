import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AcpUpdate } from '$lib/acp/acp-events';
import { runAcpTurn, type PermissionAsk, type PermissionOutcome } from './client';

const FAKE_AGENT = { command: process.execPath, args: [fileURLToPath(new URL('./fake-agent.mjs', import.meta.url))] };
const FEEGA_MCP = { name: 'feega', command: '/bin/feega-mcp', args: [], env: [] };

const choose = (optionId: string) => async (): Promise<PermissionOutcome> => ({ outcome: 'selected', optionId });

const turn = (prompt: string, ask: (p: PermissionAsk) => Promise<PermissionOutcome> = choose('yes'), onUpdate: (u: AcpUpdate) => void = () => {}) =>
  runAcpTurn({ agent: FAKE_AGENT, cwd: process.cwd(), mcpServers: [FEEGA_MCP], prompt }, { onUpdate, ask });

describe('runAcpTurn', () => {
  it('sends the prompt to the agent and returns its reply', async () => {
    const done = await turn('make it blue');

    expect(done.text).toBe('heard: make it blue');
    expect(done.stopReason).toBe('end_turn');
  });

  it('never replies to a notification it does not know', async () => {
    const done = await turn('quiet');

    expect(done.text).toBe('heard: quiet');
  });

  it('streams each session update as it arrives', async () => {
    const seen: string[] = [];
    await turn('x', choose('yes'), (u) => {
      seen.push(u.sessionUpdate);
    });

    expect(seen).toEqual(['agent_message_chunk', 'tool_call']);
  });

  it('asks the user before a tool runs and passes the choice to the agent', async () => {
    const asked: PermissionAsk[] = [];
    const done = await turn('x', async (p) => {
      asked.push(p);
      return { outcome: 'selected', optionId: 'no' };
    });

    expect(asked[0].title).toBe('feega edit');
    expect(asked[0].options.map((o) => o.kind)).toEqual(['reject_once', 'allow_once']);
    expect(done.toolCalls).toEqual(['feega edit via feega (no)']);
  });

  it('sends session/cancel when the turn is aborted, and the agent stops as cancelled', async () => {
    const stop = new AbortController();
    const done = await runAcpTurn(
      { agent: FAKE_AGENT, cwd: process.cwd(), mcpServers: [FEEGA_MCP], prompt: 'x' },
      {
        onUpdate: () => {},
        signal: stop.signal,
        ask: () =>
          new Promise((settle) => {
            stop.signal.addEventListener('abort', () => settle({ outcome: 'cancelled' }));
            stop.abort();
          })
      }
    );

    expect(done.stopReason).toBe('cancelled');
  });

  it('fails when the agent command does not exist', async () => {
    await expect(runAcpTurn({ agent: { command: 'feega-no-such-agent', args: [] }, cwd: process.cwd(), mcpServers: [], prompt: 'x' }, { onUpdate: () => {}, ask: choose('yes') })).rejects.toThrow();
  });
});
