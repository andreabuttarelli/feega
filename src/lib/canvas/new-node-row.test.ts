import { describe, expect, it } from 'vitest';
import { CANVAS_ADD_BAR } from './addable';
import { validateNodeData } from './node-data';
import { newNodeRow } from '$lib/canvas-node-data';

describe('un nodo appena aggiunto supera la validazione del server', () => {
  it.each(CANVAS_ADD_BAR)('%s nasce vuoto e valido', (what) => {
    expect(validateNodeData(what, newNodeRow(what)).ok).toBe(true);
  });
});
