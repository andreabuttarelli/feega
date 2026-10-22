import { describe, expect, it } from 'vitest';
import { PALETTE, keyEventOf, searchPalette } from './command-palette';
import { Command, SHORTCUTS, commandFor } from '$lib/motion/shortcuts';
import { EditMode } from '$lib/motion/edit-mode';

describe('command palette', () => {
  it('lists every command its shortcut reaches in Design, once, named', () => {
    const design = new Set(SHORTCUTS.filter((b) => (b.mode ?? EditMode.Design) === EditMode.Design && commandFor({ key: b.key, mod: !!b.mod, shift: !!b.shift, alt: !!b.alt, ctrlCmd: !!b.ctrlCmd }, EditMode.Design) === b.command).map((b) => b.command));

    expect(new Set(PALETTE.map((e) => e.command))).toEqual(design);
    expect(PALETTE.length).toBe(design.size);
    expect(PALETTE.every((e) => e.name.length > 0)).toBe(true);
  });

  it('finds an action by any word of its name or what it does', () => {
    expect(searchPalette('flip hor').map((e) => e.command)).toContain(Command.FlipHorizontal);
    expect(searchPalette('xyz nothing')).toEqual([]);
    expect(searchPalette('').length).toBe(PALETTE.length);
  });

  it('runs an entry by pressing its own shortcut, so there is one table', () => {
    for (const entry of PALETTE) {
      const e = keyEventOf(entry);
      expect(commandFor({ key: e.key!, code: e.code, mod: !!e.metaKey, shift: !!e.shiftKey, alt: !!e.altKey, ctrlCmd: !!(e.ctrlKey && e.metaKey) }, EditMode.Design)).toBe(entry.command);
    }
  });
});
