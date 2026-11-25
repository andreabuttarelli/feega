import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentAsk, ToView, type ViewMessage } from '../messages';
import { ASK_TIMEOUT_MS, viewAsker } from './view-ask';

afterEach(() => vi.useRealTimers());

const rig = () => {
  const sent: ViewMessage[] = [];
  const asker = viewAsker((message) => void sent.push(message));
  return { sent, asker };
};

describe('asking the panel', () => {
  it('numbers every ask so answers find their question', () => {
    const { sent, asker } = rig();

    void asker.ask(AgentAsk.Screenshot, false);
    void asker.ask(AgentAsk.Context, false);

    const ids = sent.map((m) => (m.kind === ToView.AgentAsk ? m.id : -1));
    expect(new Set(ids).size).toBe(2);
  });

  it('resolves with the answer to that ask only', async () => {
    const { sent, asker } = rig();
    const first = asker.ask(AgentAsk.Screenshot, false);
    const second = asker.ask(AgentAsk.Screenshot, true);
    const [a, b] = sent.map((m) => (m.kind === ToView.AgentAsk ? m.id : -1));

    asker.answer({ id: b, png: 'B', text: null });
    asker.answer({ id: a, png: 'A', text: null });

    expect(await first).toEqual({ png: 'A', text: null });
    expect(await second).toEqual({ png: 'B', text: null });
  });

  it('gives up with nothing when the panel stays silent', async () => {
    vi.useFakeTimers();
    const { asker } = rig();

    const shot = asker.ask(AgentAsk.Screenshot, false);
    await vi.advanceTimersByTimeAsync(ASK_TIMEOUT_MS + 1);

    expect(await shot).toBeNull();
  });

  it('ignores an answer nobody asked for', () => {
    const { asker } = rig();

    expect(() => asker.answer({ id: 99, png: 'x', text: null })).not.toThrow();
  });
});
