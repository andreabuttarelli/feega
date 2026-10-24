import { describe, expect, it } from 'vitest';
import { runAgent, Stop, type Chat, type ChatReply, type Tools } from './agent-loop';

const usage = (cost: number): ChatReply['usage'] => ({ prompt_tokens: 100, completion_tokens: 10, cost });

const toolReply = (cost: number): ChatReply => ({
  message: { content: null, tool_calls: [{ id: 'c1', function: { name: 'ping', arguments: '{}' } }] },
  usage: usage(cost)
});

const doneReply = (cost: number): ChatReply => ({ message: { content: 'finished' }, usage: usage(cost) });

const scripted =
  (...replies: ChatReply[]): Chat =>
  async () =>
    replies.shift() as ChatReply;

const tools: Tools = { specs: [{ name: 'ping', description: '', parameters: { type: 'object' } }], call: async () => ({ text: 'pong', images: [] }) };

describe('the external agent loop', () => {
  it('counts turns, tool calls and cost until the model stops asking for tools', async () => {
    const stats = await runAgent({ system: 's', task: 't', tools, capUsd: 1, chat: scripted(toolReply(0.1), toolReply(0.2), doneReply(0.3)) });

    expect(stats).toMatchObject({ stop: Stop.Done, turns: 3, toolCalls: 2, finalText: 'finished', toolCallsByName: { ping: 2 } });
    expect(stats.usage.costUsd).toBeCloseTo(0.6);
  });

  it('stops before the next turn once the cost cap is reached', async () => {
    const stats = await runAgent({ system: 's', task: 't', tools, capUsd: 0.25, chat: scripted(toolReply(0.2), toolReply(0.2), doneReply(0.2)) });

    expect(stats).toMatchObject({ stop: Stop.CostCap, turns: 2 });
  });

  it('stops at the turn limit', async () => {
    const stats = await runAgent({ system: 's', task: 't', tools, capUsd: 10, maxTurns: 2, chat: scripted(toolReply(0), toolReply(0), doneReply(0)) });

    expect(stats).toMatchObject({ stop: Stop.TurnLimit, turns: 2 });
  });

  it('answers a tool that throws with an error the model can read, and counts it', async () => {
    const broken: Tools = { ...tools, call: async () => Promise.reject(new Error('boom')) };
    const stats = await runAgent({ system: 's', task: 't', tools: broken, capUsd: 1, chat: scripted(toolReply(0), doneReply(0)) });

    expect(stats).toMatchObject({ stop: Stop.Done, toolErrors: 1 });
  });

  it('reports a failed chat call as an error, not a crash', async () => {
    const failing: Chat = async () => Promise.reject(new Error('503'));
    const stats = await runAgent({ system: 's', task: 't', tools, capUsd: 1, chat: failing });

    expect(stats).toMatchObject({ stop: Stop.Error, error: '503' });
  });

  it('keeps the transcript, tool calls and errors included', async () => {
    const stats = await runAgent({ system: 's', task: 't', tools, capUsd: 1, chat: scripted(toolReply(0), doneReply(0)) });

    expect(stats.transcript.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool', 'assistant']);
    expect(stats.transcript[3]).toMatchObject({ role: 'tool', content: 'pong' });
  });

  it('sends the tool list as it is at each turn, so a loaded tool shows up', async () => {
    const live: Tools = { specs: [...tools.specs], call: async () => (live.specs.push({ name: 'loaded', description: '', parameters: { type: 'object' } }), { text: 'ok', images: [] }) };
    const seen: string[][] = [];
    const chat: Chat = async (_messages, apiTools) => {
      seen.push((apiTools as { function: { name: string } }[]).map((t) => t.function.name));
      return seen.length === 1 ? toolReply(0) : doneReply(0);
    };

    await runAgent({ system: 's', task: 't', tools: live, capUsd: 1, chat });

    expect(seen).toEqual([['ping'], ['ping', 'loaded']]);
  });
});
