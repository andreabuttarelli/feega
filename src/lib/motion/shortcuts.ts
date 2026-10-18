import { EditMode } from './edit-mode';
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
  SelectChild = 'select-child',
  SelectParent = 'select-parent',
  SelectNext = 'select-next',
  SelectPrevious = 'select-previous',
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
  PreviewZoomIn = 'preview-zoom-in',
  PreviewZoomOut = 'preview-zoom-out',
  PreviewFit = 'preview-fit',
  PreviewActual = 'preview-actual',
  PreviewSelection = 'preview-selection',
  ToggleChat = 'toggle-chat',
  ToggleInspector = 'toggle-inspector',
  ToggleTimeline = 'toggle-timeline',
  Help = 'help',
  Precompose = 'precompose',
  Group = 'group',
  Ungroup = 'ungroup',
  AutoLayout = 'auto-layout',
  UseAsMask = 'use-as-mask',
  RemoveMask = 'remove-mask',
  SelectMatching = 'select-matching',
  BringForward = 'bring-forward',
  SendBackward = 'send-backward',
  BringToFront = 'bring-to-front',
  SendToBack = 'send-to-back',
  Union = 'union',
  Subtract = 'subtract',
  Intersect = 'intersect',
  Exclude = 'exclude',
  AlignLeft = 'align-left',
  AlignCenter = 'align-center',
  AlignRight = 'align-right',
  AlignTop = 'align-top',
  AlignMiddle = 'align-middle',
  AlignBottom = 'align-bottom',
  TidyUp = 'tidy-up',
  FlipHorizontal = 'flip-horizontal',
  FlipVertical = 'flip-vertical',
  ToolSelect = 'tool-select',
  ToolText = 'tool-text',
  ToolRectangle = 'tool-rectangle',
  ToolEllipse = 'tool-ellipse',
  ToolPen = 'tool-pen',
  ToggleEditMode = 'toggle-edit-mode',
  MoveLeft = 'move-left',
  MoveRight = 'move-right',
  MoveUp = 'move-up',
  MoveDown = 'move-down',
  MoveLeftMore = 'move-left-more',
  MoveRightMore = 'move-right-more',
  MoveUpMore = 'move-up-more',
  MoveDownMore = 'move-down-more'
}

export enum ShortcutGroup {
  Playback = 'Playback',
  Time = 'Time',
  Editing = 'Editing',
  Layers = 'Layers',
  Draw = 'Draw',
  View = 'View'
}

export type KeyPress = { key: string; code?: string; mod: boolean; shift: boolean; alt?: boolean; ctrlCmd?: boolean };

type Binding = { key: string; mod?: boolean; shift?: boolean; alt?: boolean; ctrlCmd?: boolean; mode?: EditMode; command: Command; label: string; does: string; group: ShortcutGroup };

export const SHORTCUTS: readonly Binding[] = [
  { key: 't', mode: EditMode.Design, command: Command.ToolText, label: 'T', does: 'Text tool: drag in the frame', group: ShortcutGroup.Draw },
  { key: 'r', mode: EditMode.Design, command: Command.ToolRectangle, label: 'R', does: 'Rectangle tool', group: ShortcutGroup.Draw },
  { key: 'o', mode: EditMode.Design, command: Command.ToolEllipse, label: 'O', does: 'Ellipse tool', group: ShortcutGroup.Draw },
  { key: 'p', mode: EditMode.Design, command: Command.ToolPen, label: 'P', does: 'Pen tool: click points, drag for curves', group: ShortcutGroup.Draw },
  { key: ' ', command: Command.TogglePlay, label: 'Space', does: 'Play / pause', group: ShortcutGroup.Playback },
  { key: 'l', command: Command.Play, label: 'L', does: 'Play', group: ShortcutGroup.Playback },
  { key: 'k', command: Command.Pause, label: 'K', does: 'Pause', group: ShortcutGroup.Playback },
  { key: 'j', command: Command.Rewind, label: 'J', does: 'Pause and go back one second', group: ShortcutGroup.Playback },

  { key: 'Home', command: Command.GoStart, label: 'Home', does: 'Go to the start', group: ShortcutGroup.Time },
  { key: 'End', command: Command.GoEnd, label: 'End', does: 'Go to the end', group: ShortcutGroup.Time },
  { key: 'ArrowLeft', mode: EditMode.Motion, command: Command.StepBack, label: '←', does: 'Previous frame (Motion)', group: ShortcutGroup.Time },
  { key: 'ArrowRight', mode: EditMode.Motion, command: Command.StepForward, label: '→', does: 'Next frame (Motion)', group: ShortcutGroup.Time },
  { key: 'ArrowLeft', shift: true, mode: EditMode.Motion, command: Command.StepBackMore, label: '⇧←', does: 'Back 10 frames (Motion)', group: ShortcutGroup.Time },
  { key: 'ArrowRight', shift: true, mode: EditMode.Motion, command: Command.StepForwardMore, label: '⇧→', does: 'Forward 10 frames (Motion)', group: ShortcutGroup.Time },
  { key: 'ArrowLeft', mode: EditMode.Design, command: Command.MoveLeft, label: '←', does: 'Move the selection 1 px (Design)', group: ShortcutGroup.Layers },
  { key: 'ArrowRight', mode: EditMode.Design, command: Command.MoveRight, label: '→', does: 'Move the selection 1 px (Design)', group: ShortcutGroup.Layers },
  { key: 'ArrowUp', mode: EditMode.Design, command: Command.MoveUp, label: '↑', does: 'Move the selection 1 px (Design)', group: ShortcutGroup.Layers },
  { key: 'ArrowDown', mode: EditMode.Design, command: Command.MoveDown, label: '↓', does: 'Move the selection 1 px (Design)', group: ShortcutGroup.Layers },
  { key: 'ArrowLeft', shift: true, mode: EditMode.Design, command: Command.MoveLeftMore, label: '⇧←', does: 'Move the selection 10 px (Design)', group: ShortcutGroup.Layers },
  { key: 'ArrowRight', shift: true, mode: EditMode.Design, command: Command.MoveRightMore, label: '⇧→', does: 'Move the selection 10 px (Design)', group: ShortcutGroup.Layers },
  { key: 'ArrowUp', shift: true, mode: EditMode.Design, command: Command.MoveUpMore, label: '⇧↑', does: 'Move the selection 10 px (Design)', group: ShortcutGroup.Layers },
  { key: 'ArrowDown', shift: true, mode: EditMode.Design, command: Command.MoveDownMore, label: '⇧↓', does: 'Move the selection 10 px (Design)', group: ShortcutGroup.Layers },
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
  { key: 'a', shift: true, command: Command.AutoLayout, label: '⇧A', does: 'Add auto layout to the selection', group: ShortcutGroup.Layers },
  { key: 'm', mod: true, ctrlCmd: true, command: Command.UseAsMask, label: '⌃⌘M', does: 'Use the bottom-most selected layer as mask', group: ShortcutGroup.Layers },
  { key: 'u', alt: true, shift: true, command: Command.Union, label: '⌥⇧U', does: 'Unite the selected shapes', group: ShortcutGroup.Layers },
  { key: 's', alt: true, shift: true, command: Command.Subtract, label: '⌥⇧S', does: 'Subtract the upper shapes from the bottom one', group: ShortcutGroup.Layers },
  { key: 'i', alt: true, shift: true, command: Command.Intersect, label: '⌥⇧I', does: 'Keep where the shapes overlap', group: ShortcutGroup.Layers },
  { key: 'e', alt: true, shift: true, command: Command.Exclude, label: '⌥⇧E', does: 'Keep where the shapes do not overlap', group: ShortcutGroup.Layers },
  { key: 'a', alt: true, command: Command.AlignLeft, label: '⌥A', does: 'Align left', group: ShortcutGroup.Layers },
  { key: 'h', alt: true, command: Command.AlignCenter, label: '⌥H', does: 'Align horizontal centres', group: ShortcutGroup.Layers },
  { key: 'd', alt: true, command: Command.AlignRight, label: '⌥D', does: 'Align right', group: ShortcutGroup.Layers },
  { key: 'w', alt: true, command: Command.AlignTop, label: '⌥W', does: 'Align top', group: ShortcutGroup.Layers },
  { key: 'v', alt: true, command: Command.AlignMiddle, label: '⌥V', does: 'Align vertical centres', group: ShortcutGroup.Layers },
  { key: 's', alt: true, command: Command.AlignBottom, label: '⌥S', does: 'Align bottom', group: ShortcutGroup.Layers },
  { key: 't', mod: true, alt: true, command: Command.TidyUp, label: '⌃⌥T', does: 'Tidy up', group: ShortcutGroup.Layers },
  { key: 'h', shift: true, command: Command.FlipHorizontal, label: '⇧H', does: 'Flip horizontally', group: ShortcutGroup.Layers },
  { key: 'v', shift: true, command: Command.FlipVertical, label: '⇧V', does: 'Flip vertically', group: ShortcutGroup.Layers },
  { key: 'g', mod: true, command: Command.Group, label: '⌘G', does: 'Group the selection', group: ShortcutGroup.Layers },
  { key: 'g', mod: true, shift: true, command: Command.Ungroup, label: '⇧⌘G', does: 'Ungroup', group: ShortcutGroup.Layers },
  { key: 'c', mod: true, shift: true, command: Command.Precompose, label: '⇧⌘C', does: 'Precompose the selection', group: ShortcutGroup.Layers },
  { key: 'c', mod: true, command: Command.Copy, label: '⌘C', does: 'Copy keyframes or elements', group: ShortcutGroup.Editing },
  { key: 'v', mod: true, command: Command.Paste, label: '⌘V', does: 'Paste keyframes or elements', group: ShortcutGroup.Editing },
  { key: 'a', mod: true, alt: true, command: Command.SelectMatching, label: '⌥⌘A', does: 'Select matching layers', group: ShortcutGroup.Editing },
  { key: 'a', mod: true, command: Command.SelectAll, label: '⌘A', does: 'Select all clips', group: ShortcutGroup.Editing },
  { key: 'Escape', command: Command.Deselect, label: 'Esc', does: 'Select the parent, then deselect', group: ShortcutGroup.Editing },
  { key: 'Enter', command: Command.SelectChild, label: '↵', does: 'Select inside', group: ShortcutGroup.Editing },
  { key: 'Tab', command: Command.SelectNext, label: 'Tab', does: 'Select the next layer', group: ShortcutGroup.Editing },
  { key: 'Tab', shift: true, command: Command.SelectPrevious, label: '⇧Tab', does: 'Select the previous layer', group: ShortcutGroup.Editing },
  { key: 'Enter', shift: true, command: Command.SelectParent, label: '⇧↵', does: 'Select the parent', group: ShortcutGroup.Editing },

  { key: ']', mod: true, command: Command.BringForward, label: '⌘]', does: 'Bring forward', group: ShortcutGroup.Layers },
  { key: '[', mod: true, command: Command.SendBackward, label: '⌘[', does: 'Send backward', group: ShortcutGroup.Layers },
  { key: ']', mod: true, alt: true, command: Command.BringToFront, label: '⌥⌘]', does: 'Bring to front', group: ShortcutGroup.Layers },
  { key: '[', mod: true, alt: true, command: Command.SendToBack, label: '⌥⌘[', does: 'Send to back', group: ShortcutGroup.Layers },
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
  { key: '=', mod: true, command: Command.PreviewZoomIn, label: '⌘+', does: 'Zoom the preview in', group: ShortcutGroup.View },
  { key: '+', mod: true, shift: true, command: Command.PreviewZoomIn, label: '⌘+', does: 'Zoom the preview in', group: ShortcutGroup.View },
  { key: '-', mod: true, command: Command.PreviewZoomOut, label: '⌘−', does: 'Zoom the preview out', group: ShortcutGroup.View },
  { key: '0', mod: true, command: Command.PreviewFit, label: '⌘0', does: 'Fit the preview', group: ShortcutGroup.View },
  { key: '1', mod: true, command: Command.PreviewActual, label: '⌘1', does: 'Preview at 100%', group: ShortcutGroup.View },
  { key: '0', shift: true, command: Command.PreviewActual, label: '⇧0', does: 'Preview at 100%', group: ShortcutGroup.View },
  { key: '1', shift: true, command: Command.PreviewFit, label: '⇧1', does: 'Fit the preview', group: ShortcutGroup.View },
  { key: '2', shift: true, command: Command.PreviewSelection, label: '⇧2', does: 'Zoom the preview to the selection', group: ShortcutGroup.View },
  { key: 'b', mod: true, command: Command.ToggleChat, label: '⌘B', does: 'Show / hide the agent', group: ShortcutGroup.View },
  { key: 'b', mod: true, alt: true, command: Command.ToggleInspector, label: '⌥⌘B', does: 'Show / hide properties', group: ShortcutGroup.View },
  { key: 'j', mod: true, command: Command.ToggleTimeline, label: '⌘J', does: 'Show / hide the timeline', group: ShortcutGroup.View },
  { key: 'v', command: Command.ToolSelect, label: 'V', does: 'Select tool', group: ShortcutGroup.Draw },
  { key: 't', shift: true, command: Command.ToolText, label: '⇧T', does: 'Text tool: drag in the frame', group: ShortcutGroup.Draw },
  { key: 'r', shift: true, command: Command.ToolRectangle, label: '⇧R', does: 'Rectangle tool', group: ShortcutGroup.Draw },
  { key: 'o', shift: true, command: Command.ToolEllipse, label: '⇧O', does: 'Ellipse tool', group: ShortcutGroup.Draw },
  { key: 'p', shift: true, command: Command.ToolPen, label: '⇧P', does: 'Pen tool: click points, drag for curves', group: ShortcutGroup.Draw },
  { key: 'e', command: Command.ToggleEditMode, label: 'E', does: 'Design / Motion: edit the base or key at the playhead', group: ShortcutGroup.View },
  { key: '?', shift: true, command: Command.Help, label: '?', does: 'Keyboard & gestures', group: ShortcutGroup.View }
];

const PHYSICAL_KEYS: Record<string, string> = { BracketLeft: '[', BracketRight: ']' };
const LETTER_CODE = /^Key([A-Z])$/;
const DIGIT_CODE = /^Digit([0-9])$/;

function keyOf(press: KeyPress): string {
  const letter = LETTER_CODE.exec(press.code ?? '')?.[1];
  if (letter) {
    return letter.toLowerCase();
  }
  const digit = DIGIT_CODE.exec(press.code ?? '')?.[1];
  if (digit) {
    return digit;
  }
  const physical = PHYSICAL_KEYS[press.code ?? ''];
  if (physical) {
    return physical;
  }
  return press.key.length === 1 ? press.key.toLowerCase() : press.key;
}

export function commandFor(press: KeyPress, mode: EditMode = EditMode.Motion): Command | null {
  const key = keyOf(press);
  const hit = SHORTCUTS.find((b) => b.key === key && Boolean(b.mod) === press.mod && Boolean(b.shift) === press.shift && Boolean(b.alt) === Boolean(press.alt) && Boolean(b.ctrlCmd) === Boolean(press.ctrlCmd) && (b.mode ?? mode) === mode);
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
