import { describe, expect, it } from 'vitest';
import { Step, markFrame, shownLate, timeline } from './frame-timeline';

describe('frame timeline', () => {
  it('raccoglie i passi di ogni frame in ordine, a partire dal gruppo', () => {
    performance.clearMarks();

    markFrame('a:0.5', Step.Asked);
    markFrame('a:0.5:thumb', Step.Put);
    markFrame('b', Step.Asked);
    markFrame('a@bp:tablet:live1', Step.Put);

    const rows = timeline(performance.getEntriesByType('mark'));

    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'a@bp:tablet']);
    expect(rows[0].steps.map((s) => s.step)).toEqual([Step.Asked, Step.Put]);
  });
});

describe('shown late', () => {
  const drawn = (group: string, at: number) => ({ step: Step.Drawn, at, group });

  it('flags a frame still blank in a screenshot taken a frame after its vectors were drawn', () => {
    const late = shownLate([{ id: 'a', steps: [drawn('a:vectors', 100)], blankShotAt: 200 }]);

    expect(late).toEqual([{ id: 'a', drawnAt: 100, blankShotAt: 200 }]);
  });

  it('accepts a frame blank only in screenshots taken within a frame of the draw', () => {
    expect(shownLate([{ id: 'a', steps: [drawn('a:vectors', 100)], blankShotAt: 110 }])).toEqual([]);
  });

  it('times from the first draw of vectors or the whole frame, not the thumbnail', () => {
    const steps = [drawn('a:thumb', 50), drawn('a', 300)];

    expect(shownLate([{ id: 'a', steps, blankShotAt: 200 }])).toEqual([]);
  });

  it('ignores the placeholder card drawn before the content', () => {
    const steps = [drawn('a:[1280,4511,{"surface":"frame"}]', 50), drawn('a:1:256:vectors', 300)];

    expect(shownLate([{ id: 'a', steps, blankShotAt: 200 }])).toEqual([]);
  });
});
