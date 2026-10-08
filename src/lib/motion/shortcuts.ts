export enum Command {
  TogglePlay = 'toggle-play',
  Play = 'play',
  Pause = 'pause',
  Rewind = 'rewind',
  GoStart = 'go-start',
  GoEnd = 'go-end',
  StepBack = 'step-back',
  StepForward = 'step-forward',
  StepBackMore = 'step-back-more',
  StepForwardMore = 'step-forward-more',
  PrevKeyframe = 'prev-keyframe',
  NextKeyframe = 'next-keyframe',
  WorkIn = 'work-in',
  WorkOut = 'work-out',
  AddMarker = 'add-marker',
  Delete = 'delete',
  Split = 'split',
  Duplicate = 'duplicate',
  Undo = 'undo',
  Redo = 'redo',
  Copy = 'copy',
  Paste = 'paste',
  SelectAll = 'select-all',
  Deselect = 'deselect',
  StartHere = 'start-here',
  EndHere = 'end-here',
  TrimIn = 'trim-in',
  TrimOut = 'trim-out',
  NudgeBack = 'nudge-back',
  NudgeForward = 'nudge-forward',
  NudgeBackMore = 'nudge-back-more',
  NudgeForwardMore = 'nudge-forward-more',
  RevealPosition = 'reveal-position',
  RevealScale = 'reveal-scale',
  RevealRotation = 'reveal-rotation',
  RevealOpacity = 'reveal-opacity',
  RevealAnimated = 'reveal-animated',
  ZoomIn = 'zoom-in',
  ZoomOut = 'zoom-out',
  ToggleChat = 'toggle-chat',
  ToggleInspector = 'toggle-inspector',
  Help = 'help',
  Precompose = 'precompose'
}

export enum ShortcutGroup {
  Playback = 'Playback',
  Time = 'Time',
  Editing = 'Editing',
  Layers = 'Layers',
  View = 'View'
}

export type KeyPress = { key: string; code?: string; mod: boolean; shift: boolean; alt?: boolean };

type Binding = { key: string; mod?: boolean; shift?: boolean; alt?: boolean; command: Command; label: string; does: string; group: ShortcutGroup };

export const SHORTCUTS: readonly Binding[] = [
  { key: ' ', command: Command.TogglePlay, label: 'Space', does: 'Play / pause', group: ShortcutGroup.Playback },
  { key: 'l', command: Command.Play, label: 'L', does: 'Play', group: ShortcutGroup.Playback },
  { key: 'k', command: Command.Pause, label: 'K', does: 'Pause', group: ShortcutGroup.Playback },
  { key: 'j', command: Command.Rewind, label: 'J', does: 'Pause and go back one second', group: ShortcutGroup.Playback },

  { key: 'Home', command: Command.GoStart, label: 'Home', does: 'Go to the start', group: ShortcutGroup.Time },
  { key: 'End', command: Command.GoEnd, label: 'End', does: 'Go to the end', group: ShortcutGroup.Time },
  { key: 'ArrowLeft', command: Command.StepBack, label: '←', does: 'Previous frame', group: ShortcutGroup.Time },
  { key: 'ArrowRight', command: Command.StepForward, label: '→', does: 'Next frame', group: ShortcutGroup.Time },
  { key: 'ArrowLeft', shift: true, command: Command.StepBackMore, label: '⇧←', does: 'Back 10 frames', group: ShortcutGroup.Time },
  { key: 'ArrowRight', shift: true, command: Command.StepForwardMore, label: '⇧→', does: 'Forward 10 frames', group: ShortcutGroup.Time },
  { key: 'j', shift: true, command: Command.PrevKeyframe, label: '⇧J', does: 'Previous keyframe', group: ShortcutGroup.Time },
  { key: 'k', shift: true, command: Command.NextKeyframe, label: '⇧K', does: 'Next keyframe', group: ShortcutGroup.Time },
  { key: 'i', command: Command.WorkIn, label: 'I', does: 'Work area starts here', group: ShortcutGroup.Time },
  { key: 'o', command: Command.WorkOut, label: 'O', does: 'Work area ends here', group: ShortcutGroup.Time },
  { key: 'b', command: Command.WorkIn, label: 'B', does: 'Work area starts here', group: ShortcutGroup.Time },
  { key: 'n', command: Command.WorkOut, label: 'N', does: 'Work area ends here', group: ShortcutGroup.Time },
  { key: 'm', command: Command.AddMarker, label: 'M', does: 'Add a marker', group: ShortcutGroup.Time },

  { key: 'Delete', command: Command.Delete, label: 'Del', does: 'Delete', group: ShortcutGroup.Editing },
  { key: 'Backspace', command: Command.Delete, label: '⌫', does: 'Delete', group: ShortcutGroup.Editing },
  { key: 'd', mod: true, command: Command.Duplicate, label: '⌘D', does: 'Duplicate', group: ShortcutGroup.Editing },
  { key: 'd', mod: true, shift: true, command: Command.Split, label: '⇧⌘D', does: 'Split at the playhead', group: ShortcutGroup.Editing },
  { key: 'z', mod: true, command: Command.Undo, label: '⌘Z', does: 'Undo', group: ShortcutGroup.Editing },
  { key: 'z', mod: true, shift: true, command: Command.Redo, label: '⇧⌘Z', does: 'Redo', group: ShortcutGroup.Editing },
  { key: 'c', mod: true, shift: true, command: Command.Precompose, label: '⇧⌘C', does: 'Precompose the selection', group: ShortcutGroup.Layers },
  { key: 'c', mod: true, command: Command.Copy, label: '⌘C', does: 'Copy keyframes', group: ShortcutGroup.Editing },
  { key: 'v', mod: true, command: Command.Paste, label: '⌘V', does: 'Paste keyframes', group: ShortcutGroup.Editing },
  { key: 'a', mod: true, command: Command.SelectAll, label: '⌘A', does: 'Select all clips', group: ShortcutGroup.Editing },
  { key: 'Escape', command: Command.Deselect, label: 'Esc', does: 'Deselect', group: ShortcutGroup.Editing },

  { key: '[', command: Command.StartHere, label: '[', does: 'Move the clip to start here', group: ShortcutGroup.Layers },
  { key: ']', command: Command.EndHere, label: ']', does: 'Move the clip to end here', group: ShortcutGroup.Layers },
  { key: '[', alt: true, command: Command.TrimIn, label: '⌥[', does: 'Trim the clip start to here', group: ShortcutGroup.Layers },
  { key: ']', alt: true, command: Command.TrimOut, label: '⌥]', does: 'Trim the clip end to here', group: ShortcutGroup.Layers },
  { key: 'ArrowLeft', alt: true, command: Command.NudgeBack, label: '⌥←', does: 'Nudge one frame earlier', group: ShortcutGroup.Layers },
  { key: 'ArrowRight', alt: true, command: Command.NudgeForward, label: '⌥→', does: 'Nudge one frame later', group: ShortcutGroup.Layers },
  { key: 'ArrowLeft', alt: true, shift: true, command: Command.NudgeBackMore, label: '⌥⇧←', does: 'Nudge 10 frames earlier', group: ShortcutGroup.Layers },
  { key: 'ArrowRight', alt: true, shift: true, command: Command.NudgeForwardMore, label: '⌥⇧→', does: 'Nudge 10 frames later', group: ShortcutGroup.Layers },
  { key: 'p', command: Command.RevealPosition, label: 'P', does: 'Show position', group: ShortcutGroup.Layers },
  { key: 's', command: Command.RevealScale, label: 'S', does: 'Show scale', group: ShortcutGroup.Layers },
  { key: 'r', command: Command.RevealRotation, label: 'R', does: 'Show rotation', group: ShortcutGroup.Layers },
  { key: 't', command: Command.RevealOpacity, label: 'T', does: 'Show opacity', group: ShortcutGroup.Layers },
  { key: 'u', command: Command.RevealAnimated, label: 'U', does: 'Show animated properties', group: ShortcutGroup.Layers },

  { key: '=', command: Command.ZoomIn, label: '+', does: 'Zoom the timeline in', group: ShortcutGroup.View },
  { key: '+', command: Command.ZoomIn, label: '+', does: 'Zoom the timeline in', group: ShortcutGroup.View },
  { key: '+', shift: true, command: Command.ZoomIn, label: '+', does: 'Zoom the timeline in', group: ShortcutGroup.View },
  { key: '-', command: Command.ZoomOut, label: '−', does: 'Zoom the timeline out', group: ShortcutGroup.View },
  { key: 'b', mod: true, command: Command.ToggleChat, label: '⌘B', does: 'Show / hide the agent', group: ShortcutGroup.View },
  { key: 'b', mod: true, alt: true, command: Command.ToggleInspector, label: '⌥⌘B', does: 'Show / hide properties', group: ShortcutGroup.View },
  { key: '?', shift: true, command: Command.Help, label: '?', does: 'Keyboard & gestures', group: ShortcutGroup.View }
];

const PHYSICAL_KEYS: Record<string, string> = { BracketLeft: '[', BracketRight: ']' };
const LETTER_CODE = /^Key([A-Z])$/;

function keyOf(press: KeyPress): string {
  const letter = LETTER_CODE.exec(press.code ?? '')?.[1];
  if (letter) {
    return letter.toLowerCase();
  }
  const physical = PHYSICAL_KEYS[press.code ?? ''];
  if (physical) {
    return physical;
  }
  return press.key.length === 1 ? press.key.toLowerCase() : press.key;
}

export function commandFor(press: KeyPress): Command | null {
  const key = keyOf(press);
  const hit = SHORTCUTS.find((b) => b.key === key && Boolean(b.mod) === press.mod && Boolean(b.shift) === press.shift && Boolean(b.alt) === Boolean(press.alt));
  return hit?.command ?? null;
}

const TYPING = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

type Typed = { isContentEditable?: boolean; closest?: (selector: string) => unknown };

export function isTyping(target: Typed | null): boolean {
  if (!target) {
    return false;
  }
  return Boolean(target.isContentEditable) || Boolean(target.closest?.(TYPING));
}

export type HelpRow = { keys: string[]; does: string };
export type HelpSection = { group: ShortcutGroup; rows: HelpRow[] };

export function shortcutHelp(): HelpSection[] {
  return Object.values(ShortcutGroup).map((group) => {
    const rows: HelpRow[] = [];
    for (const binding of SHORTCUTS.filter((b) => b.group === group)) {
      const row = rows.find((r) => r.does === binding.does);
      if (!row) {
        rows.push({ keys: [binding.label], does: binding.does });
        continue;
      }
      if (!row.keys.includes(binding.label)) {
        row.keys.push(binding.label);
      }
    }
    return { group, rows };
  });
}
