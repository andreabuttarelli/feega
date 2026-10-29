import { describe, expect, it } from 'vitest';
import { PickerSettle } from './picker-settle.svelte';

function later() {
  const queued: (() => void)[] = [];
  return { queued, run: (task: () => void) => queued.push(task), flush: () => queued.splice(0).forEach((task) => task()) };
}

describe('picker settle', () => {
  it('holds the frame picker after an edit until the browser is idle', () => {
    const idle = later();
    const settle = new PickerSettle(idle.run);

    settle.edited('frame');
    expect(settle.settling('frame')).toBe(true);
    expect(settle.settling('other')).toBe(false);

    idle.flush();
    expect(settle.settling('frame')).toBe(false);
  });

  it('asks for one idle slot however many edits land before it', () => {
    const idle = later();
    const settle = new PickerSettle(idle.run);

    settle.edited('frame');
    settle.edited('frame');
    settle.edited('frame');

    expect(idle.queued).toHaveLength(1);
  });
});
