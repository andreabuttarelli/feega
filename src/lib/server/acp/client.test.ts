import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { AcpUpdate } from '$lib/acp/acp-events';
import { createAcpSessions, listAcpModels, type AcpTurnHooks, type AcpTurnInput, type PermissionAsk, type PermissionOutcome } from './client';

const sessions = createAcpSessions();
afterAll(() => sessions.closeAll());

const runAcpTurn = (input: AcpTurnInput, hooks: AcpTurnHooks) => sessions.turn({ ...input, thread: crypto.randomUUID(), agentId: 'fake' }, hooks);

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
        { id: 'fast', name: 'Fast', description: 'Quick answers', efforts: [] },
        { id: 'deep', name: 'Deep', description: null, efforts: [] }
      ],
      effort: null
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
  const run = (models: string, model: string | null, effort: string | null = null) => runAcpTurn({ agent: fakeWith(models), cwd: process.cwd(), mcpServers: [], prompt: 'hi', choice: { model, effort } }, { onUpdate: () => {}, ask: choose('yes') });

  it('switches the model through the config option before prompting', async () => {
    expect((await run('config', 'deep')).text).toBe('heard: hi on deep');
  });

  it('switches the model through session/set_model when that is all the agent has', async () => {
    expect((await run('models', 'deep')).text).toBe('heard: hi on deep');
  });

  it('sets the effort the user chose, with or without a model change', async () => {
    expect((await run('effort', null, 'max')).text).toBe('heard: hi on fast/max');
    expect((await run('effort', 'deep', 'low')).text).toBe('heard: hi on deep/low');
  });

  it('lists the efforts next to the models', async () => {
    const listed = await listAcpModels(fakeWith('effort'), process.cwd());

    expect(listed?.effort).toBe('mid');
    expect(listed?.models[0].efforts).toEqual(['low', 'mid', 'max']);
  });

  it('keeps the agent default when the saved model no longer exists', async () => {
    expect((await run('config', 'gone')).text).toBe('heard: hi on fast');
  });
});

describe('an agent session per chat thread', () => {
  const memory = { ...FAKE_AGENT, env: { FAKE_ACP_MEMORY: '1' } };
  const say = (thread: string, hooks: Partial<AcpTurnHooks> = {}, agentId = 'fake') =>
    sessions.turn({ thread, agentId, agent: memory, cwd: process.cwd(), mcpServers: [], prompt: 'hi' }, { onUpdate: () => {}, ask: choose('yes'), ...hooks });

  it('keeps the agent alive between turns, so the second turn remembers the first', async () => {
    const thread = crypto.randomUUID();
    const first = await say(thread);
    const second = await say(thread);

    const pid = first.text.split(' of ')[1];
    expect(first.text).toBe(`turn 1 of ${pid}`);
    expect(second.text).toBe(`turn 2 of ${pid}`);
  });

  it('says it is starting only when it launches the agent', async () => {
    const thread = crypto.randomUUID();
    const onStarting = vi.fn();
    await say(thread, { onStarting });
    await say(thread, { onStarting });

    expect(onStarting).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh agent for another thread, or another agent on the same thread', async () => {
    const thread = crypto.randomUUID();
    await say(thread);

    expect((await say(crypto.randomUUID())).text).toMatch(/^turn 1 of/);
    expect((await say(thread, {}, 'other')).text).toMatch(/^turn 1 of/);
  });

  it('cancels the running turn of a thread on request', async () => {
    const thread = crypto.randomUUID();
    const chatty = { ...FAKE_AGENT, env: { FAKE_ACP_CHATTY: '1' } };
    const turn = sessions.turn({ thread, agentId: 'chatty', agent: chatty, cwd: process.cwd(), mcpServers: [], prompt: 'go' }, { onUpdate: () => {}, ask: choose('yes') });
    await vi.waitFor(() => expect(sessions.cancel(thread)).toBe(true));

    expect((await turn).stopReason).toBe('cancelled');
    expect(sessions.cancel(crypto.randomUUID())).toBe(false);
  });

  it('ignores a line on stdout that is not JSON instead of crashing', async () => {
    const noisy = { ...FAKE_AGENT, env: { FAKE_ACP_NOISE: '1' } };
    const done = await sessions.turn({ thread: crypto.randomUUID(), agentId: 'noisy', agent: noisy, cwd: process.cwd(), mcpServers: [FEEGA_MCP], prompt: 'x' }, { onUpdate: () => {}, ask: choose('yes') });

    expect(done.text).toBe('heard: x');
  });
});
