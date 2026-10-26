import { describe, expect, it } from 'vitest';
import { PALETTE, searchPalette } from './command-palette';
import { Command } from '$lib/motion/shortcuts';
import { canRunInFrame } from './frame-inspector';
import { CANVAS_COMMAND_OF } from './shortcuts';

describe('command palette', () => {
  it('lists actions that have no shortcut', () => {
    const commands = PALETTE.map((e) => e.command);

    expect(commands).toContain(Command.SelectSameFill);
    expect(commands).toContain(Command.SelectSameEffect);
    expect(PALETTE.find((e) => e.command === Command.SelectSameFill)?.label).toBe('');
  });

  it('lists each action once, named, and only those it can run by id', () => {
    const commands = PALETTE.map((e) => e.command);

    expect(new Set(commands).size).toBe(commands.length);
    expect(PALETTE.every((e) => e.name.length > 0)).toBe(true);
    expect(PALETTE.every((e) => canRunInFrame(e.command) || e.command in CANVAS_COMMAND_OF)).toBe(true);
  });

  it('keeps the shortcut label of an action that has one', () => {
    expect(PALETTE.find((e) => e.command === Command.FlipHorizontal)?.label).toBe('⇧H');
  });

  it('finds an action by any word of its name or what it does', () => {
    expect(searchPalette('flip hor').map((e) => e.command)).toContain(Command.FlipHorizontal);
    expect(searchPalette('same fill').map((e) => e.command)).toContain(Command.SelectSameFill);
    expect(searchPalette('xyz nothing')).toEqual([]);
    expect(searchPalette('').length).toBe(PALETTE.length);
  });
});
