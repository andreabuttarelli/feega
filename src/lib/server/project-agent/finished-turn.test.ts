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

  it('separa due step che non portano spazio fra loro: la frase non si incolla alla successiva', () => {
    const turn = finishedTurn([
      { text: 'Registering Inter, then adding text.', content: [] },
      { text: 'The glow went on the top track.', content: [] }
    ]);

    expect(turn.content).toBe('Registering Inter, then adding text.\n\nThe glow went on the top track.');
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
