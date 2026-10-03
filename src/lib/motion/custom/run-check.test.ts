import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import type { OpResult } from '../timeline';
import { CheckState, sourceHash } from './component';
import { writeComponent } from './ops';
import { runCheck } from './run-check';
import { seekPlan } from './determinism';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const doc = must(writeComponent(newMotionDoc(MotionFormat.Landscape), 'Cursor', { source: { html: '<i></i>', css: '', js: '' }, propsSchema: { type: 'object', properties: {} } }));

describe('running the determinism check in the editor', () => {
  it('captures the seek plan of the component alone and records a passing check for its current code', async () => {
    const capture = vi.fn(async (times: number[]) => times.map((time) => ({ time, data: `f${time}`, layout: 'l', errors: [] })));
    const compose = vi.fn(() => '<html>check</html>');

    const result = await runCheck(doc, 'Cursor', { compose, capture });

    expect(compose).toHaveBeenCalledWith(expect.objectContaining({ components: { Cursor: doc.components.Cursor } }));
    expect(capture).toHaveBeenCalledWith(seekPlan(4, 30), '<html>check</html>');
    expect(result.check).toEqual({ hash: sourceHash(doc.components.Cursor), state: CheckState.Passed, problems: [] });
    expect(result.offending).toEqual([]);
  });

  it('records a failure with the offending frames when the preview cannot render it', async () => {
    const capture = vi.fn(async () => {
      throw new Error('capture timed out');
    });

    const result = await runCheck(doc, 'Cursor', { compose: () => '', capture });

    expect(result.check.state).toBe(CheckState.Failed);
    expect(result.check.problems).toEqual(['the preview could not render it: capture timed out']);
  });
});
