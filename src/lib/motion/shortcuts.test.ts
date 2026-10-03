import { describe, expect, it } from 'vitest';
import { Command, commandFor } from './shortcuts';

const press = (key: string, mod = false, shift = false) => commandFor({ key, mod, shift });

describe('editor shortcuts', () => {
  it('space plays and pauses', () => {
    expect(press(' ')).toBe(Command.TogglePlay);
  });

  it('cmd+z undoes, shift+cmd+z redoes', () => {
    expect(press('z', true)).toBe(Command.Undo);
    expect(press('Z', true, true)).toBe(Command.Redo);
  });

  it('arrows step a frame, with shift a second', () => {
    expect(press('ArrowRight')).toBe(Command.StepForward);
    expect(press('ArrowRight', false, true)).toBe(Command.SecondForward);
  });

  it('j and k jump to the previous and next keyframe', () => {
    expect(press('j')).toBe(Command.PrevKeyframe);
    expect(press('k')).toBe(Command.NextKeyframe);
  });

  it('cmd+c and cmd+v copy and paste', () => {
    expect(press('c', true)).toBe(Command.Copy);
    expect(press('v', true)).toBe(Command.Paste);
  });

  it('an unbound key does nothing', () => {
    expect(press('q')).toBeNull();
  });
});
