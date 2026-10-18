import { EditMode } from './edit-mode';
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
    const combos = SHORTCUTS.map((b) => `${b.key}|${Boolean(b.mod)}|${Boolean(b.shift)}|${Boolean(b.alt)}|${b.mode ?? 'any'}`);
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

  it('cmd+g groups the selection, shift+cmd+g ungroups it', () => {
    expect(press('g', { mod: true })).toBe(Command.Group);
    expect(press('g', { mod: true, shift: true })).toBe(Command.Ungroup);
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

  it('zoom keys: ⇧0 is 100%, ⇧1 fits, ⇧2 zooms to the selection, whatever the layout prints', () => {
    expect(press(')', { shift: true, code: 'Digit0' })).toBe(Command.PreviewActual);
    expect(press('!', { shift: true, code: 'Digit1' })).toBe(Command.PreviewFit);
    expect(press('@', { shift: true, code: 'Digit2' })).toBe(Command.PreviewSelection);
    expect(press('"', { shift: true, code: 'Digit2' })).toBe(Command.PreviewSelection);
  });
});


describe('drawing tool keys', () => {
  it('V selects; shift with T, R, O, P picks text, rectangle, ellipse, pen, leaving the plain keys to the timeline', () => {
    expect(press('v')).toBe(Command.ToolSelect);
    expect(press('T', { shift: true, code: 'KeyT' })).toBe(Command.ToolText);
    expect(press('R', { shift: true, code: 'KeyR' })).toBe(Command.ToolRectangle);
    expect(press('O', { shift: true, code: 'KeyO' })).toBe(Command.ToolEllipse);
    expect(press('P', { shift: true, code: 'KeyP' })).toBe(Command.ToolPen);
    expect(press('t')).toBe(Command.RevealOpacity);
  });
});

describe('the Design and Motion switch', () => {
  it('E flips between Design and Motion', () => {
    expect(press('e')).toBe(Command.ToggleEditMode);
  });
});

describe('arrows by edit mode', () => {
  const inMode = (mode: EditMode, key: string, shift = false) => commandFor({ key, mod: false, shift }, mode);

  it('in Motion the arrows step frames, as before', () => {
    expect(inMode(EditMode.Motion, 'ArrowLeft')).toBe(Command.StepBack);
    expect(inMode(EditMode.Motion, 'ArrowRight', true)).toBe(Command.StepForwardMore);
    expect(inMode(EditMode.Motion, 'ArrowUp')).toBeNull();
  });

  it('in Design the arrows move the selection, shift by ten', () => {
    expect(inMode(EditMode.Design, 'ArrowLeft')).toBe(Command.MoveLeft);
    expect(inMode(EditMode.Design, 'ArrowRight')).toBe(Command.MoveRight);
    expect(inMode(EditMode.Design, 'ArrowUp')).toBe(Command.MoveUp);
    expect(inMode(EditMode.Design, 'ArrowDown', true)).toBe(Command.MoveDownMore);
  });

  it('a binding without a mode works in both', () => {
    expect(inMode(EditMode.Design, ' ')).toBe(Command.TogglePlay);
  });
});

describe('mask keys', () => {
  it('control-command-M uses the selection as mask, command-M alone does not', () => {
    expect(commandFor({ key: 'm', code: 'KeyM', mod: true, shift: false, ctrlCmd: true })).toBe(Command.UseAsMask);
    expect(commandFor({ key: 'm', code: 'KeyM', mod: true, shift: false })).toBeNull();
    expect(press('m')).toBe(Command.AddMarker);
  });
});

describe('outline view key', () => {
  it('⌘Y switches the frame to outlines and back', () => {
    expect(press('y', { mod: true, code: 'KeyY' })).toBe(Command.ToggleOutlines);
  });
});

describe('select matching key', () => {
  it('⌥⌘A selects every layer like the selected ones', () => {
    expect(press('å', { mod: true, alt: true, code: 'KeyA' })).toBe(Command.SelectMatching);
    expect(press('a', { mod: true, code: 'KeyA' })).toBe(Command.SelectAll);
  });
});

describe('layer order keys', () => {
  it('⌘] and ⌘[ step a layer, with ⌥ all the way', () => {
    expect(press(']', { mod: true, code: 'BracketRight' })).toBe(Command.BringForward);
    expect(press('[', { mod: true, code: 'BracketLeft' })).toBe(Command.SendBackward);
    expect(press(']', { mod: true, alt: true, code: 'BracketRight' })).toBe(Command.BringToFront);
    expect(press('[', { mod: true, alt: true, code: 'BracketLeft' })).toBe(Command.SendToBack);
    expect(press('[', { code: 'BracketLeft' })).toBe(Command.StartHere);
  });
});

describe('flip keys', () => {
  it('⇧H flips horizontally and ⇧V vertically', () => {
    expect(press('H', { shift: true, code: 'KeyH' })).toBe(Command.FlipHorizontal);
    expect(press('V', { shift: true, code: 'KeyV' })).toBe(Command.FlipVertical);
    expect(press('v', { code: 'KeyV' })).toBe(Command.ToolSelect);
  });
});

describe('boolean keys', () => {
  it('⌥⇧U unites, ⌥⇧S subtracts, ⌥⇧I intersects, ⌥⇧E excludes', () => {
    expect(press('U', { alt: true, shift: true, code: 'KeyU' })).toBe(Command.Union);
    expect(press('S', { alt: true, shift: true, code: 'KeyS' })).toBe(Command.Subtract);
    expect(press('I', { alt: true, shift: true, code: 'KeyI' })).toBe(Command.Intersect);
    expect(press('E', { alt: true, shift: true, code: 'KeyE' })).toBe(Command.Exclude);
    expect(press('s', { alt: true, code: 'KeyS' })).toBe(Command.AlignBottom);
  });
});

describe('sibling keys', () => {
  it('Tab selects the next layer and ⇧Tab the previous one', () => {
    expect(press('Tab')).toBe(Command.SelectNext);
    expect(press('Tab', { shift: true })).toBe(Command.SelectPrevious);
  });
});

describe('align keys', () => {
  it('⌥A ⌥H ⌥D ⌥W ⌥V ⌥S align, ⌃⌥T tidies up, by physical key', () => {
    expect(press('å', { alt: true, code: 'KeyA' })).toBe(Command.AlignLeft);
    expect(press('˙', { alt: true, code: 'KeyH' })).toBe(Command.AlignCenter);
    expect(press('∂', { alt: true, code: 'KeyD' })).toBe(Command.AlignRight);
    expect(press('∑', { alt: true, code: 'KeyW' })).toBe(Command.AlignTop);
    expect(press('√', { alt: true, code: 'KeyV' })).toBe(Command.AlignMiddle);
    expect(press('ß', { alt: true, code: 'KeyS' })).toBe(Command.AlignBottom);
    expect(press('†', { mod: true, alt: true, code: 'KeyT' })).toBe(Command.TidyUp);
  });
});

describe('plain-letter tools in Design mode', () => {
  const design = (key: string) => commandFor({ key, code: `Key${key.toUpperCase()}`, mod: false, shift: false }, EditMode.Design);
  const motion = (key: string) => commandFor({ key, code: `Key${key.toUpperCase()}`, mod: false, shift: false }, EditMode.Motion);

  it('T R O P pick text, rectangle, ellipse and pen', () => {
    expect(design('t')).toBe(Command.ToolText);
    expect(design('r')).toBe(Command.ToolRectangle);
    expect(design('o')).toBe(Command.ToolEllipse);
    expect(design('p')).toBe(Command.ToolPen);
  });

  it('in Motion the letters keep their timeline meaning', () => {
    expect(motion('o')).toBe(Command.WorkOut);
    expect(motion('t')).toBe(Command.RevealOpacity);
    expect(motion('p')).toBe(Command.RevealPosition);
  });
});
