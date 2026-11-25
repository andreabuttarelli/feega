import { AgentAsk, ToView, type ViewMessage } from '../messages';

export const ASK_TIMEOUT_MS = 15000;

export type ViewAnswer = { png: string | null; text: string | null };

export function viewAsker(post: (message: ViewMessage) => unknown) {
  const waiting = new Map<number, (answer: ViewAnswer | null) => void>();
  let next = 0;

  return {
    ask: (ask: AgentAsk, selection: boolean): Promise<ViewAnswer | null> =>
      new Promise((resolve) => {
        const id = ++next;
        const timer = setTimeout(() => (waiting.delete(id), resolve(null)), ASK_TIMEOUT_MS);
        waiting.set(id, (answer) => (clearTimeout(timer), resolve(answer)));
        post({ kind: ToView.AgentAsk, id, ask, selection });
      }),
    answer: ({ id, png, text }: { id: number } & ViewAnswer) => {
      waiting.get(id)?.({ png, text });
      waiting.delete(id);
    }
  };
}
