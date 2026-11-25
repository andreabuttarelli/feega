import { AgentAsk, ToHost, type HostMessage } from '../messages';

type Ask = { id: number; ask: AgentAsk; selection: boolean };

type AskDeps = { capture: (selection: boolean) => Promise<string | null>; context: () => string | null };

type Answer = Extract<HostMessage, { kind: ToHost.AgentAnswer }>;

export async function answerAsk({ id, ask, selection }: Ask, deps: AskDeps): Promise<Answer> {
  if (ask === AgentAsk.Screenshot) {
    return { kind: ToHost.AgentAnswer, id, png: await deps.capture(selection), text: null };
  }
  return { kind: ToHost.AgentAnswer, id, png: null, text: deps.context() };
}
