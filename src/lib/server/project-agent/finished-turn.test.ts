import { describe, expect, it } from 'vitest';
import { finishedTurn } from './finished-turn';

describe('finishedTurn — il turno salvato è quello che l utente ha visto', () => {
  it('unisce il testo di ogni step, non solo l ultimo', () => {
    const turn = finishedTurn([
      { text: 'Guardo la tela. ', content: [] },
      { text: 'Ci sono 3 nodi.', content: [] }
    ]);

    expect(turn.content).toBe('Guardo la tela. Ci sono 3 nodi.');
  });

  it('tiene i tool riusciti e quelli falliti, con il loro esito', () => {
    const turn = finishedTurn([
      {
        text: '',
        content: [
          { type: 'tool-call', toolCallId: 'a', toolName: 'list_nodes', input: {} },
          { type: 'tool-result', toolCallId: 'a', toolName: 'list_nodes', input: {}, output: { n: 3 } },
          { type: 'tool-error', toolCallId: 'b', toolName: 'create_node', input: { t: 1 }, error: new Error('boom') }
        ]
      }
    ]);

    expect(turn.tools).toEqual([
      { toolCallId: 'a', toolName: 'list_nodes', status: 'done', input: {}, output: { n: 3 } },
      { toolCallId: 'b', toolName: 'create_node', status: 'error', input: { t: 1 }, errorText: 'boom' }
    ]);
  });
});
