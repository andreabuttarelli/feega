import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runAcpTurn } from './client';

const FAKE_AGENT = { command: process.execPath, args: [fileURLToPath(new URL('./fake-agent.mjs', import.meta.url))] };
const FEEGA_MCP = { name: 'feega', command: 'feega-mcp', args: [], env: [] };

describe('runAcpTurn', () => {
  it('sends the prompt to the agent and returns its reply', async () => {
    const turn = await runAcpTurn({ agent: FAKE_AGENT, cwd: process.cwd(), mcpServers: [FEEGA_MCP], prompt: 'make it blue' });

    expect(turn.text).toBe('heard: make it blue');
    expect(turn.stopReason).toBe('end_turn');
  });

  it('hands the agent the Feega MCP server and allows its tool calls once', async () => {
    const turn = await runAcpTurn({ agent: FAKE_AGENT, cwd: process.cwd(), mcpServers: [FEEGA_MCP], prompt: 'x' });

    expect(turn.toolCalls).toEqual(['feega edit via feega (yes)']);
  });

  it('fails when the agent command does not exist', async () => {
    await expect(runAcpTurn({ agent: { command: 'feega-no-such-agent', args: [] }, cwd: process.cwd(), mcpServers: [], prompt: 'x' })).rejects.toThrow();
  });
});
