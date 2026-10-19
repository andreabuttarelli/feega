import { describe, expect, it } from 'vitest';
import { HoverProbe, hoverProbe, moveGate } from './move-gate';

describe('work done per pointer move', () => {
  it('runs when something it depends on changed', () => {
    const changed = moveGate();
    const doc = {};
    expect(changed(1, 2, doc)).toBe(true);
    expect(changed(1, 3, doc)).toBe(true);
    expect(changed(1, 3, {})).toBe(true);
  });

  it('is skipped when nothing under the pointer changed', () => {
    const changed = moveGate();
    const doc = {};
    changed(1, 2, doc);
    expect(changed(1, 2, doc)).toBe(false);
  });
});

describe('hover probing', () => {
  it('runs for a mouse that only hovers', () => {
    expect(hoverProbe({ pointerType: 'mouse', buttons: 0 })).toBe(HoverProbe.Probe);
  });

  it('is skipped while a button is held, since a drag owns the pointer', () => {
    expect(hoverProbe({ pointerType: 'mouse', buttons: 1 })).toBe(HoverProbe.Clear);
  });

  it('is skipped for touch and pen', () => {
    expect(hoverProbe({ pointerType: 'touch', buttons: 0 })).toBe(HoverProbe.Clear);
  });
});
