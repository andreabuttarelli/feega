import { describe, expect, it } from 'vitest';
import { Step, markFrame, timeline } from './frame-timeline';

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
