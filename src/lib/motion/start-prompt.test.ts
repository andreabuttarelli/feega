import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from './doc';
import { Agent, showsStart } from './start-prompt';

const empty = newMotionDoc(MotionFormat.Landscape);

describe('the start prompt over an empty preview', () => {
  it('shows on an empty video nobody is working on', () => {
    expect(showsStart(empty, Agent.Idle)).toBe(true);
  });

  it('hides as soon as an agent turn starts, before the first edit lands', () => {
    expect(showsStart(empty, Agent.Working)).toBe(false);
  });

  it('stays hidden once the doc has content', () => {
    const filled = { ...empty, tracks: [{ id: 't', clips: [{ id: 'c' }] }] } as unknown as typeof empty;

    expect(showsStart(filled, Agent.Idle)).toBe(false);
  });
});
