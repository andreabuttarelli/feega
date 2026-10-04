export enum Command {
  TogglePlay = 'toggle-play',
  Delete = 'delete',
  Split = 'split',
  Duplicate = 'duplicate',
  Undo = 'undo',
  Redo = 'redo',
  StepBack = 'step-back',
  StepForward = 'step-forward',
  SecondBack = 'second-back',
  SecondForward = 'second-forward',
  ZoomIn = 'zoom-in',
  ZoomOut = 'zoom-out',
  SelectAll = 'select-all',
  Deselect = 'deselect',
  PrevKeyframe = 'prev-keyframe',
  NextKeyframe = 'next-keyframe',
  Copy = 'copy',
  Paste = 'paste',
  AddMarker = 'add-marker',
  WorkIn = 'work-in',
  WorkOut = 'work-out',
  NudgeBack = 'nudge-back',
  NudgeForward = 'nudge-forward',
  NudgeBackMore = 'nudge-back-more',
  NudgeForwardMore = 'nudge-forward-more'
}

export type KeyPress = { key: string; mod: boolean; shift: boolean };

type Binding = { key: string; mod?: boolean; shift?: boolean; command: Command; label: string };

export const SHORTCUTS: readonly Binding[] = [
  { key: ' ', command: Command.TogglePlay, label: 'Space' },
  { key: 'Delete', command: Command.Delete, label: 'Del' },
  { key: 'Backspace', command: Command.Delete, label: '⌫' },
  { key: 's', command: Command.Split, label: 'S' },
  { key: 'd', mod: true, command: Command.Duplicate, label: '⌘D' },
  { key: 'z', mod: true, shift: true, command: Command.Redo, label: '⇧⌘Z' },
  { key: 'z', mod: true, command: Command.Undo, label: '⌘Z' },
  { key: 'ArrowLeft', shift: true, command: Command.SecondBack, label: '⇧←' },
  { key: 'ArrowRight', shift: true, command: Command.SecondForward, label: '⇧→' },
  { key: 'ArrowLeft', command: Command.StepBack, label: '←' },
  { key: 'ArrowRight', command: Command.StepForward, label: '→' },
  { key: '=', command: Command.ZoomIn, label: '+' },
  { key: '+', command: Command.ZoomIn, label: '+' },
  { key: '-', command: Command.ZoomOut, label: '−' },
  { key: 'a', mod: true, command: Command.SelectAll, label: '⌘A' },
  { key: 'Escape', command: Command.Deselect, label: 'Esc' },
  { key: 'j', command: Command.PrevKeyframe, label: 'J' },
  { key: 'k', command: Command.NextKeyframe, label: 'K' },
  { key: 'c', mod: true, command: Command.Copy, label: '⌘C' },
  { key: 'v', mod: true, command: Command.Paste, label: '⌘V' },
  { key: 'm', command: Command.AddMarker, label: 'M' },
  { key: 'b', command: Command.WorkIn, label: 'B' },
  { key: 'n', command: Command.WorkOut, label: 'N' },
  { key: '[', command: Command.NudgeBack, label: '[' },
  { key: ']', command: Command.NudgeForward, label: ']' },
  { key: '{', shift: true, command: Command.NudgeBackMore, label: '⇧[' },
  { key: '}', shift: true, command: Command.NudgeForwardMore, label: '⇧]' }
];

export function commandFor(press: KeyPress): Command | null {
  const key = press.key.length === 1 ? press.key.toLowerCase() : press.key;
  const hit = SHORTCUTS.find((b) => b.key === key && Boolean(b.mod) === press.mod && Boolean(b.shift) === press.shift);
  return hit?.command ?? null;
}
