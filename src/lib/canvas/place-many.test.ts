import { describe, expect, it } from 'vitest';
import { planPlaceMany, reverseEach } from './place-many';

const at = (id: string, x: number, y: number, w = 10, h = 10, rotation = 0) => ({ id, x, y, w, h, rotation });

describe('placing several nodes in one gesture', () => {
  it('sorts each node into the one write it needs', () => {
    const plan = planPlaceMany([
      { before: at('moved', 0, 0), after: at('moved', 5, 5) },
      { before: at('sized', 0, 0), after: at('sized', 2, 0, 20, 10) },
      { before: at('turned', 0, 0), after: at('turned', 3, 4, 10, 10, 30) },
      { before: at('still', 0, 0), after: at('still', 0, 0) }
    ]);

    expect(plan.turns).toEqual([{ id: 'turned', degrees: 30 }]);
    expect(plan.resizes).toEqual([{ id: 'sized', before: { x: 0, y: 0, w: 10, h: 10 }, after: { x: 2, y: 0, w: 20, h: 10 } }]);
    expect(plan.moves).toEqual([
      { id: 'moved', x: 5, y: 5 },
      { id: 'turned', x: 3, y: 4 }
    ]);
  });

  it('turns the short way across ±180', () => {
    expect(planPlaceMany([{ before: at('a', 0, 0, 10, 10, 170), after: at('a', 0, 0, 10, 10, -170) }]).turns).toEqual([{ id: 'a', degrees: 20 }]);
  });

  it('undoes the steps last first, so redoing them replays the first step first', async () => {
    const seen: string[] = [];
    const back = await reverseEach(['turn', 'move'], async (step) => {
      seen.push(step);
      return `${step}'`;
    });

    expect(seen).toEqual(['move', 'turn']);
    expect(back).toEqual(["move'", "turn'"]);
  });

  it('drops a step that could not be reversed', async () => {
    expect(await reverseEach(['a', 'b'], async (step) => (step === 'a' ? null : step))).toEqual(['b']);
  });
});
