import { describe, expect, it } from 'vitest';
import { Command, SHORTCUTS, ShortcutGroup, commandFor, isTyping, shortcutHelp } from './shortcuts';

type Mods = { mod?: boolean; shift?: boolean; alt?: boolean; code?: string };

const press = (key: string, mods: Mods = {}) => commandFor({ key, code: mods.code, mod: Boolean(mods.mod), shift: Boolean(mods.shift), alt: Boolean(mods.alt) });

describe('playback keys', () => {
  it('space plays and pauses; L plays, K pauses, J goes back', () => {
    expect(press(' ')).toBe(Command.TogglePlay);
    expect(press('l')).toBe(Command.Play);
    expect(press('k')).toBe(Command.Pause);
    expect(press('j')).toBe(Command.Rewind);
  });
});

describe('time keys', () => {
  it('arrows step a frame, with shift ten', () => {
    expect(press('ArrowRight')).toBe(Command.StepForward);
    expect(press('ArrowLeft')).toBe(Command.StepBack);
    expect(press('ArrowRight', { shift: true })).toBe(Command.StepForwardMore);
    expect(press('ArrowLeft', { shift: true })).toBe(Command.StepBackMore);
  });

  it('Home and End go to the start and the end', () => {
    expect(press('Home')).toBe(Command.GoStart);
    expect(press('End')).toBe(Command.GoEnd);
  });

  it('I/O and B/N set the work area', () => {
    expect(press('i')).toBe(Command.WorkIn);
    expect(press('o')).toBe(Command.WorkOut);
    expect(press('b')).toBe(Command.WorkIn);
    expect(press('n')).toBe(Command.WorkOut);
  });

  it('shift+J and shift+K jump between keyframes', () => {
    expect(press('J', { shift: true })).toBe(Command.PrevKeyframe);
    expect(press('K', { shift: true })).toBe(Command.NextKeyframe);
  });
});

describe('editing keys', () => {
  it('cmd+D duplicates, cmd+shift+D splits at the playhead', () => {
    expect(press('d', { mod: true })).toBe(Command.Duplicate);
    expect(press('D', { mod: true, shift: true })).toBe(Command.Split);
  });

  it('cmd+z undoes, shift+cmd+z redoes', () => {
    expect(press('z', { mod: true })).toBe(Command.Undo);
    expect(press('Z', { mod: true, shift: true })).toBe(Command.Redo);
  });

  it('Delete and Backspace delete', () => {
    expect(press('Delete')).toBe(Command.Delete);
    expect(press('Backspace')).toBe(Command.Delete);
  });
});

describe('layer keys', () => {
  it('[ and ] move the clip to the playhead, alt trims it', () => {
    expect(press('[')).toBe(Command.StartHere);
    expect(press(']')).toBe(Command.EndHere);
    expect(press('“', { alt: true, code: 'BracketLeft' })).toBe(Command.TrimIn);
    expect(press('‘', { alt: true, code: 'BracketRight' })).toBe(Command.TrimOut);
  });

  it('P S R T U reveal position, scale, rotation, opacity and animated lanes', () => {
    expect(press('p')).toBe(Command.RevealPosition);
    expect(press('s')).toBe(Command.RevealScale);
    expect(press('r')).toBe(Command.RevealRotation);
    expect(press('t')).toBe(Command.RevealOpacity);
    expect(press('u')).toBe(Command.RevealAnimated);
  });

  it('alt+arrows nudge, with shift ten frames', () => {
    expect(press('ArrowLeft', { alt: true })).toBe(Command.NudgeBack);
    expect(press('ArrowRight', { alt: true, shift: true })).toBe(Command.NudgeForwardMore);
  });
});

describe('view keys', () => {
  it('+ and - zoom the timeline', () => {
    expect(press('=')).toBe(Command.ZoomIn);
    expect(press('+', { shift: true })).toBe(Command.ZoomIn);
    expect(press('-')).toBe(Command.ZoomOut);
  });

  it('cmd+B toggles the agent, cmd+alt+B the properties, read from the physical key', () => {
    expect(press('b', { mod: true, code: 'KeyB' })).toBe(Command.ToggleChat);
    expect(press('∫', { mod: true, alt: true, code: 'KeyB' })).toBe(Command.ToggleInspector);
  });

  it('? opens the shortcut list', () => {
    expect(press('?', { shift: true, code: 'Slash' })).toBe(Command.Help);
  });

  it('an unbound key does nothing', () => {
    expect(press('q')).toBeNull();
  });
});

describe('the table', () => {
  it('binds every key combination once', () => {
    const combos = SHORTCUTS.map((b) => `${b.key}|${Boolean(b.mod)}|${Boolean(b.shift)}|${Boolean(b.alt)}`);
    expect(new Set(combos).size).toBe(combos.length);
  });

  it('the help lists every command once, grouped, with all its keys', () => {
    const help = shortcutHelp();
    const commands = new Set(SHORTCUTS.map((b) => b.does));

    expect(help.map((s) => s.group)).toEqual(Object.values(ShortcutGroup));
    expect(help.flatMap((s) => s.rows).length).toBe(commands.size);
    expect(help.flatMap((s) => s.rows).find((r) => r.does === 'Delete')?.keys).toEqual(['Del', '⌫']);
  });
});

describe('typing', () => {
  const field = (matches: boolean, editable = false) => ({ isContentEditable: editable, closest: () => (matches ? {} : null) });

  it('a key typed in an input or a contenteditable is not a shortcut', () => {
    expect(isTyping(field(true))).toBe(true);
    expect(isTyping(field(false, true))).toBe(true);
  });

  it('a key pressed elsewhere is', () => {
    expect(isTyping(field(false))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });

  it('shift+cmd+c precomposes the selection, cmd+c still copies', () => {
    expect(press('c', { mod: true, shift: true })).toBe(Command.Precompose);
    expect(press('c', { mod: true })).toBe(Command.Copy);
  });
});

describe('preview zoom keys', () => {
  it('⌘= / ⌘+ zoom in, ⌘- out, ⌘0 fits, ⌘1 is 100%; plain + and - stay on the timeline', () => {
    expect(press('=', { mod: true })).toBe(Command.PreviewZoomIn);
    expect(press('+', { mod: true, shift: true })).toBe(Command.PreviewZoomIn);
    expect(press('-', { mod: true })).toBe(Command.PreviewZoomOut);
    expect(press('0', { mod: true })).toBe(Command.PreviewFit);
    expect(press('1', { mod: true })).toBe(Command.PreviewActual);
    expect(press('=')).toBe(Command.ZoomIn);
    expect(press('-')).toBe(Command.ZoomOut);
  });
});

