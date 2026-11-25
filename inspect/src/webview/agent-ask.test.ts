import { describe, expect, it } from 'vitest';
import { AgentAsk, ToHost } from '../messages';
import { answerAsk } from './agent-ask';

const deps = (png: string | null, text: string | null) => {
  const captured: boolean[] = [];
  return { captured, deps: { capture: async (selection: boolean) => (captured.push(selection), png), context: () => text } };
};

describe('answering the agent from the panel', () => {
  it('answers a screenshot ask with the picture of the tab', async () => {
    const { deps: d, captured } = deps('iVBORw0K', 'ctx');

    expect(await answerAsk({ id: 3, ask: AgentAsk.Screenshot, selection: false }, d)).toEqual({ kind: ToHost.AgentAnswer, id: 3, png: 'iVBORw0K', text: null });
    expect(captured).toEqual([false]);
  });

  it('crops to the selection when the agent asked for it', async () => {
    const { deps: d, captured } = deps('iVBORw0K', null);

    await answerAsk({ id: 4, ask: AgentAsk.Screenshot, selection: true }, d);

    expect(captured).toEqual([true]);
  });

  it('answers a context ask with the block the composer shows', async () => {
    const { deps: d, captured } = deps(null, 'Feega page\npage: /');

    expect(await answerAsk({ id: 5, ask: AgentAsk.Context, selection: false }, d)).toEqual({ kind: ToHost.AgentAnswer, id: 5, png: null, text: 'Feega page\npage: /' });
    expect(captured).toEqual([]);
  });

  it('answers with nothing when the tab cannot be drawn', async () => {
    const { deps: d } = deps(null, null);

    expect(await answerAsk({ id: 6, ask: AgentAsk.Screenshot, selection: false }, d)).toEqual({ kind: ToHost.AgentAnswer, id: 6, png: null, text: null });
  });
});
