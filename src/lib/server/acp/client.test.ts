import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AcpUpdate } from '$lib/acp/acp-events';
import { listAcpModels, runAcpTurn, type PermissionAsk, type PermissionOutcome } from './client';

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

const fakeWith = (models: string) => ({ ...FAKE_AGENT, env: { FAKE_ACP_MODELS: models } });

describe('listAcpModels', () => {
  it('reads the model select an agent offers among its config options', async () => {
    expect(await listAcpModels(fakeWith('config'), process.cwd())).toEqual({
      current: 'fast',
      models: [
        { id: 'fast', name: 'Fast', description: 'Quick answers' },
        { id: 'deep', name: 'Deep', description: null }
      ]
    });
  });

  it('reads the unstable session models when there is no model option', async () => {
    const listed = await listAcpModels(fakeWith('models'), process.cwd());

    expect(listed?.current).toBe('fast');
    expect(listed?.models.map((m) => m.id)).toEqual(['fast', 'deep']);
  });

  it('is null for an agent that offers no model choice', async () => {
    expect(await listAcpModels(FAKE_AGENT, process.cwd())).toBeNull();
  });
});

describe('runAcpTurn with a model', () => {
  const run = (models: string, model: string | null) => runAcpTurn({ agent: fakeWith(models), cwd: process.cwd(), mcpServers: [], prompt: 'hi', model }, { onUpdate: () => {}, ask: choose('yes') });

  it('switches the model through the config option before prompting', async () => {
    expect((await run('config', 'deep')).text).toBe('heard: hi on deep');
  });

  it('switches the model through session/set_model when that is all the agent has', async () => {
    expect((await run('models', 'deep')).text).toBe('heard: hi on deep');
  });

  it('keeps the agent default when the saved model no longer exists', async () => {
    expect((await run('config', 'gone')).text).toBe('heard: hi on fast');
  });
});
