import { describe, expect, it, vi } from 'vitest';
import { createPlaceSaves, keepPlaced } from './place-save';
import type { ActionAnswer } from './node-save';

const ok: ActionAnswer = { type: 'success', data: {} };
const offline: ActionAnswer = { type: 'network' };

function harness(answers: ActionAnswer[]) {
  const sent: { action: string; fields: Record<string, string | number> }[] = [];
  const send = vi.fn(async (action: string, fields: Record<string, string | number>) => {
    sent.push({ action, fields });
    return answers.shift() ?? ok;
  });
  const places = createPlaceSaves({ send, backoffMs: () => 0 });
  return { sent, places };
}

describe('placement saves: a move or resize is never rolled back, it is retried until it lands', () => {
  it('a move sent offline is resent with the last position once the network answers', async () => {
    const { sent, places } = harness([offline]);

    places.move('a', 10, 20);
    places.move('a', 30, 40);
    await places.flush();

    expect(sent.map((s) => s.action)).toEqual(['move', 'move']);
    expect(sent.at(-1)?.fields).toMatchObject({ node_id: 'a', x: 30, y: 40 });
    expect(places.dirty('a')).toBe(false);
  });

  it('a resize and a move of the same node are separate writes', async () => {
    const { sent, places } = harness([]);

    places.move('a', 1, 2);
    places.resize('a', 300, 200);
    await places.flush();

    expect(sent.map((s) => s.action).sort()).toEqual(['move', 'resize']);
    expect(sent.find((s) => s.action === 'resize')?.fields).toMatchObject({ node_id: 'a', width: 300, height: 200 });
  });

  it('a group move is retried with its own action', async () => {
    const { sent, places } = harness([{ type: 'error', status: 500 }]);

    places.moveGroup('g', 5, 6);
    await places.flush();

    expect(sent.map((s) => s.action)).toEqual(['moveGroup', 'moveGroup']);
    expect(sent.at(-1)?.fields).toMatchObject({ id: 'g', x: 5, y: 6 });
  });

  it('a pending move is dirty until it lands, so a resync keeps the local position', async () => {
    const { places } = harness([]);

    places.move('a', 1, 2);

    expect(places.dirty('a')).toBe(true);
    await places.flush();
    expect(places.dirty('a')).toBe(false);
  });

  it('a refused move is dropped, not retried forever', async () => {
    const { sent, places } = harness([{ type: 'failure', status: 404 }]);

    places.move('a', 1, 2);
    await places.flush();

    expect(sent).toHaveLength(1);
  });
});

describe('keepPlaced: a resync never moves a tile whose placement is still being saved', () => {
  const server = [{ id: 'a', x: 0, y: 0, w: 100, h: 100, userHeight: null }, { id: 'b', x: 0, y: 0, w: 100, h: 100, userHeight: null }];
  const local = [{ id: 'a', x: 50, y: 60, w: 300, h: 200, userHeight: 200 }, { id: 'b', x: 9, y: 9, w: 9, h: 9, userHeight: null }];

  it('keeps the local box of a dirty tile and takes the server box of an idle one', () => {
    const kept = keepPlaced(server, local, (id) => id === 'a');

    expect(kept[0]).toMatchObject({ x: 50, y: 60, w: 300, h: 200, userHeight: 200 });
    expect(kept[1]).toMatchObject({ x: 0, y: 0, w: 100, h: 100 });
  });
});
