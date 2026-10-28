import { isTypingTarget } from '$lib/shortcuts';
import { CANVAS_ADD_BAR, ADDABLE_LABEL, type Addable } from './addable';
import { DrawTool } from '$lib/motion/draw-tool';
import { Command, commandFor } from '$lib/motion/shortcuts';
import { Edge } from '$lib/motion/space';
import { FrameView } from './frame-view';

export const NUDGE_STEP = 1;
export const NUDGE_STEP_BIG = 10;

export type CanvasCommandId =
  | 'delete'
  | 'deselect'
  | 'select-all'
  | 'add'
  | 'fit'
  | 'zoom-actual'
  | 'zoom-selection'
  | 'zoom-in'
  | 'zoom-out'
  | 'nudge'
  | 'align'
  | 'tidy'
  | 'stack'
  | 'edit-mode'
  | 'section'
  | 'delete-keep'
  | 'enter'
  | 'select-next'
  | 'select-previous'
  | 'duplicate'
  | 'copy'
  | 'paste'
  | 'undo'
  | 'redo'
  | 'group'
  | 'ungroup'
  | 'tool'
  | 'comment'
  | 'bring-front'
  | 'send-back'
  | 'help'
  | 'view';

export type CanvasCommand =
  | { id: 'add'; what: Addable }
  | { id: 'nudge'; dx: number; dy: number }
  | { id: 'tool'; tool: DrawTool }
  | { id: 'align'; edge: Edge }
  | { id: 'view'; view: FrameView }
  | { id: Exclude<CanvasCommandId, 'add' | 'nudge' | 'tool' | 'align' | 'view'> };

const TOOL_OF_COMMAND: Partial<Record<Command, DrawTool>> = {
  [Command.ToolSelect]: DrawTool.Select,
  [Command.ToolText]: DrawTool.Text,
  [Command.ToolRectangle]: DrawTool.Rectangle,
  [Command.ToolEllipse]: DrawTool.Ellipse,
  [Command.ToolPolygon]: DrawTool.Polygon,
  [Command.ToolStar]: DrawTool.Star,
  [Command.ToolLine]: DrawTool.Line,
  [Command.ToolArrow]: DrawTool.Arrow,
  [Command.ToolPen]: DrawTool.Pen,
  [Command.ToolPencil]: DrawTool.Pencil,
  [Command.ToolShapeBuilder]: DrawTool.ShapeBuilder
};

const VIEW_OF_COMMAND: Partial<Record<Command, FrameView>> = {
  [Command.TogglePixelGrid]: FrameView.PixelGrid,
  [Command.ToggleLayoutGuides]: FrameView.Guides,
  [Command.ToggleRulers]: FrameView.Rulers,
  [Command.ToggleOutlines]: FrameView.Outlines,
  [Command.ToggleDevMode]: FrameView.Dev,
  [Command.TogglePivot]: FrameView.Pivot
};

function viewFor(e: KeyboardEvent): FrameView | null {
  const command = commandFor({ key: e.key, mod: e.metaKey || e.ctrlKey, shift: e.shiftKey });
  return command ? (VIEW_OF_COMMAND[command] ?? null) : null;
}

function sectionFor(e: KeyboardEvent): boolean {
  return commandFor({ key: e.key, mod: false, shift: e.shiftKey }) === Command.Section;
}

function stackFor(e: KeyboardEvent): boolean {
  return commandFor({ key: e.key, mod: false, shift: e.shiftKey }) === Command.AutoLayout;
}

function editModeFor(e: KeyboardEvent): boolean {
  return commandFor({ key: e.key, mod: e.metaKey || e.ctrlKey, shift: e.shiftKey }) === Command.ToggleEditMode;
}

function toolFor(e: KeyboardEvent): DrawTool | null {
  const command = commandFor({ key: e.key, mod: false, shift: e.shiftKey });
  return command ? (TOOL_OF_COMMAND[command] ?? null) : null;
}

const nudgeBy = (dx: number, dy: number, step: number): CanvasCommand => ({ id: 'nudge', dx: dx * step, dy: dy * step });

export const CANVAS_COMMAND_OF: Partial<Record<Command, CanvasCommand>> = {
  [Command.Delete]: { id: 'delete' },
  [Command.Duplicate]: { id: 'duplicate' },
  [Command.Undo]: { id: 'undo' },
  [Command.Redo]: { id: 'redo' },
  [Command.Copy]: { id: 'copy' },
  [Command.Group]: { id: 'group' },
  [Command.Ungroup]: { id: 'ungroup' },
  [Command.SelectAll]: { id: 'select-all' },
  [Command.Deselect]: { id: 'deselect' },
  [Command.SelectChild]: { id: 'enter' },
  [Command.SelectNext]: { id: 'select-next' },
  [Command.SelectPrevious]: { id: 'select-previous' },
  [Command.BringToFront]: { id: 'bring-front' },
  [Command.SendToBack]: { id: 'send-back' },
  [Command.PreviewZoomIn]: { id: 'zoom-in' },
  [Command.PreviewZoomOut]: { id: 'zoom-out' },
  [Command.PreviewFit]: { id: 'fit' },
  [Command.PreviewActual]: { id: 'zoom-actual' },
  [Command.PreviewSelection]: { id: 'zoom-selection' },
  [Command.Help]: { id: 'help' },
  [Command.TidyUp]: { id: 'tidy' },
  [Command.AutoLayout]: { id: 'stack' },
  [Command.ToggleEditMode]: { id: 'edit-mode' },
  [Command.Section]: { id: 'section' },
  [Command.AlignLeft]: { id: 'align', edge: Edge.Left },
  [Command.AlignCenter]: { id: 'align', edge: Edge.Center },
  [Command.AlignRight]: { id: 'align', edge: Edge.Right },
  [Command.AlignTop]: { id: 'align', edge: Edge.Top },
  [Command.AlignMiddle]: { id: 'align', edge: Edge.Middle },
  [Command.AlignBottom]: { id: 'align', edge: Edge.Bottom },
  [Command.ToolSelect]: { id: 'tool', tool: DrawTool.Select },
  [Command.ToolText]: { id: 'tool', tool: DrawTool.Text },
  [Command.ToolRectangle]: { id: 'tool', tool: DrawTool.Rectangle },
  [Command.ToolEllipse]: { id: 'tool', tool: DrawTool.Ellipse },
  [Command.ToolPen]: { id: 'tool', tool: DrawTool.Pen },
  [Command.ToolPencil]: { id: 'tool', tool: DrawTool.Pencil },
  [Command.ToolShapeBuilder]: { id: 'tool', tool: DrawTool.ShapeBuilder },
  [Command.TogglePixelGrid]: { id: 'view', view: FrameView.PixelGrid },
  [Command.ToggleLayoutGuides]: { id: 'view', view: FrameView.Guides },
  [Command.ToggleRulers]: { id: 'view', view: FrameView.Rulers },
  [Command.ToggleOutlines]: { id: 'view', view: FrameView.Outlines },
  [Command.ToggleDevMode]: { id: 'view', view: FrameView.Dev },
  [Command.TogglePivot]: { id: 'view', view: FrameView.Pivot },
  [Command.MoveLeft]: nudgeBy(-1, 0, NUDGE_STEP),
  [Command.MoveRight]: nudgeBy(1, 0, NUDGE_STEP),
  [Command.MoveUp]: nudgeBy(0, -1, NUDGE_STEP),
  [Command.MoveDown]: nudgeBy(0, 1, NUDGE_STEP),
  [Command.MoveLeftMore]: nudgeBy(-1, 0, NUDGE_STEP_BIG),
  [Command.MoveRightMore]: nudgeBy(1, 0, NUDGE_STEP_BIG),
  [Command.MoveUpMore]: nudgeBy(0, -1, NUDGE_STEP_BIG),
  [Command.MoveDownMore]: nudgeBy(0, 1, NUDGE_STEP_BIG)
};

const PASTE_MOD_KEYS:Record<string, 'duplicate' | 'copy' | 'paste' | 'bring-front' | 'send-back'> = { d: 'duplicate', c: 'copy', v: 'paste', ']': 'bring-front', '[': 'send-back' };

export function addableOf(c: CanvasCommand): Addable | null {
  return c.id === 'add' ? c.what : null;
}

export function nudgeOf(c: CanvasCommand): { dx: number; dy: number } | null {
  return c.id === 'nudge' ? { dx: c.dx, dy: c.dy } : null;
}

const ARROWS: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 }
};

const ZOOM_IN_KEYS = ['+', '='];

const HELP_KEY = '?';
const COMMENT_KEY = 'c';
const MOD_KEY = 'mod';

const SHIFT_DIGIT_ZOOM: Record<string, 'zoom-actual' | 'fit' | 'zoom-selection'> = { Digit0: 'zoom-actual', Digit1: 'fit', Digit2: 'zoom-selection' };

const ALT_ALIGN: Record<string, Edge> = { KeyA: Edge.Left, KeyH: Edge.Center, KeyD: Edge.Right, KeyW: Edge.Top, KeyV: Edge.Middle, KeyS: Edge.Bottom };

function altCommand(e: KeyboardEvent): CanvasCommand | null {
  if (isTypingTarget(e.target)) return null;
  if (e.shiftKey) return e.code === 'KeyR' ? { id: 'view', view: FrameView.Rulers } : null;
  const mod = e.metaKey || e.ctrlKey;
  if (mod) return e.code === 'KeyT' ? { id: 'tidy' } : null;
  if (e.code === 'KeyR') return { id: 'view', view: FrameView.Pivot };
  const edge = ALT_ALIGN[e.code];
  return edge ? { id: 'align', edge } : null;
}

const ACTIVATION_KEYS = new Set(['Enter', ' ']);
const CONTROL_TAGS = new Set(['button', 'select', 'summary', 'input', 'textarea']);
const CONTROL_ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'switch', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'tab', 'combobox']);

function isControl(target: EventTarget | null): boolean {
  const el = target as (Partial<HTMLElement> & { tagName?: string }) | null;
  if (!el?.tagName) return false;
  const tag = el.tagName.toLowerCase();
  const attr = (name: string) => el.getAttribute?.(name) ?? null;
  if (CONTROL_TAGS.has(tag) || el.isContentEditable === true) return true;
  if (tag === 'a' && attr('href') !== null) return true;
  return CONTROL_ROLES.has(attr('role') ?? '');
}

const ownsKey = (e: KeyboardEvent): boolean => isTypingTarget(e.target) || (ACTIVATION_KEYS.has(e.key) && isControl(e.target));

export function matchCanvasShortcut(e: KeyboardEvent): CanvasCommand | null {
  if (e.altKey) return altCommand(e);

  if (ownsKey(e)) return null;

  const mod = e.metaKey || e.ctrlKey;
  const key = e.key;

  const view = viewFor(e);
  if (view) return { id: 'view', view };

  if (mod) {
    if (key.toLowerCase() === 'z') return { id: e.shiftKey ? 'redo' : 'undo' };
    if (key.toLowerCase() === 'g') return { id: e.shiftKey ? 'ungroup' : 'group' };
    if (key === 'Backspace' || key === 'Delete') return { id: 'delete-keep' };
    if (e.shiftKey) return null;
    if (key.toLowerCase() === 'a') return { id: 'select-all' };
    const command = PASTE_MOD_KEYS[key.toLowerCase()];
    if (command) return { id: command };
    return null;
  }

  if (key === HELP_KEY) return { id: 'help' };
  if (key === COMMENT_KEY) return { id: 'comment' };

  if (stackFor(e)) return { id: 'stack' };
  if (editModeFor(e)) return { id: 'edit-mode' };
  if (sectionFor(e)) return { id: 'section' };

  const tool = toolFor(e);
  if (tool) return { id: 'tool', tool };

  if (key === 'Backspace' || key === 'Delete') return { id: 'delete' };
  if (key === 'Escape') return { id: 'deselect' };
  if (key === 'Enter' && !e.shiftKey) return { id: 'enter' };
  if (key === 'Tab') return { id: e.shiftKey ? 'select-previous' : 'select-next' };

  const arrow = ARROWS[key];
  if (arrow) {
    const step = e.shiftKey ? NUDGE_STEP_BIG : NUDGE_STEP;
    return { id: 'nudge', dx: arrow.dx * step, dy: arrow.dy * step };
  }

  const shiftZoom = e.shiftKey ? SHIFT_DIGIT_ZOOM[e.code] : undefined;
  if (shiftZoom) return { id: shiftZoom };
  if (key === '0') return { id: 'fit' };
  if (ZOOM_IN_KEYS.includes(key)) return { id: 'zoom-in' };
  if (key === '-') return { id: 'zoom-out' };

  const slot = Number(key);
  if (Number.isInteger(slot) && slot >= 1 && slot <= CANVAS_ADD_BAR.length) {
    return { id: 'add', what: CANVAS_ADD_BAR[slot - 1] };
  }

  return null;
}

export function preventable(c: CanvasCommand): boolean {
  return c.id !== 'deselect';
}

export type CanvasShortcutRow = { id: CanvasCommandId; keys: string[]; label: string };

export const CANVAS_SHORTCUTS: readonly CanvasShortcutRow[] = [
  ...CANVAS_ADD_BAR.map((what, i) => ({
    id: 'add' as const,
    keys: [String(i + 1)],
    label: `Add: ${ADDABLE_LABEL[what]}`
  })),
  { id: 'delete', keys: ['⌫'], label: 'Delete selection' },
  { id: 'select-all', keys: ['mod', 'A'], label: 'Select all' },
  { id: 'deselect', keys: ['Esc'], label: 'Deselect' },
  { id: 'enter', keys: ['↵'], label: 'Select inside the frame' },
  { id: 'select-next', keys: ['Tab'], label: 'Select the next tile' },
  { id: 'select-previous', keys: ['⇧Tab'], label: 'Select the previous tile' },
  { id: 'undo', keys: ['mod', 'Z'], label: 'Undo' },
  { id: 'redo', keys: ['⇧', 'mod', 'Z'], label: 'Redo' },
  { id: 'duplicate', keys: ['mod', 'D'], label: 'Duplicate selection' },
  { id: 'tool', keys: ['V', '⇧T', '⇧R', '⇧O', '⇧P'], label: 'Select, text, box, ellipse, pen' },
  { id: 'group', keys: ['mod', 'G'], label: 'Group elements' },
  { id: 'ungroup', keys: ['⇧', 'mod', 'G'], label: 'Ungroup' },
  { id: 'bring-front', keys: ['mod', ']'], label: 'Bring to front' },
  { id: 'send-back', keys: ['mod', '['], label: 'Send to back' },
  { id: 'copy', keys: ['mod', 'C'], label: 'Copy selection' },
  { id: 'paste', keys: ['mod', 'V'], label: 'Paste' },
  { id: 'align', keys: ['⌥A', '⌥H', '⌥D', '⌥W', '⌥V', '⌥S'], label: 'Align left, centre, right, top, middle, bottom' },
  { id: 'tidy', keys: ['⌃⌥T'], label: 'Tidy up' },
  { id: 'stack', keys: ['⇧A'], label: 'Stack the selected tiles' },
  { id: 'edit-mode', keys: ['E'], label: 'Design or Animate: edit the resting state or key at the playhead' },
  { id: 'section', keys: ['⇧S'], label: 'Wrap the selection in a section' },
  { id: 'delete-keep', keys: ['mod', '⌫'], label: 'Delete a section, keep what is in it' },
  { id: 'view', keys: ["⇧'", '⇧G', 'mod Y'], label: 'Pixel grid, layout guides, outline view' },
  { id: 'nudge', keys: ['←', '↑', '↓', '→'], label: 'Move selection (⇧ for more)' },
  { id: 'fit', keys: ['0', '⇧1'], label: 'Zoom to fit' },
  { id: 'zoom-actual', keys: ['⇧0'], label: 'Zoom to 100%' },
  { id: 'zoom-selection', keys: ['⇧2'], label: 'Zoom to selection' },
  { id: 'zoom-in', keys: ['+'], label: 'Zoom in' },
  { id: 'zoom-out', keys: ['-'], label: 'Zoom out' },
  { id: 'comment', keys: ['C'], label: 'Comment mode' },
  { id: 'help', keys: [HELP_KEY], label: 'Keyboard shortcuts' }
];

export type CanvasGuideRow = { id: string; name: string; keys: string; gesture: string };

enum GuideGroup {
  Add = 'Add',
  Select = 'Select',
  Edit = 'Edit',
  View = 'View'
}

const GUIDE_GROUP: Record<CanvasCommandId, GuideGroup> = {
  add: GuideGroup.Add,
  delete: GuideGroup.Edit,
  'select-all': GuideGroup.Select,
  deselect: GuideGroup.Select,
  enter: GuideGroup.Select,
  'select-next': GuideGroup.Select,
  'select-previous': GuideGroup.Select,
  tool: GuideGroup.Select,
  comment: GuideGroup.Edit,
  undo: GuideGroup.Edit,
  redo: GuideGroup.Edit,
  duplicate: GuideGroup.Edit,
  copy: GuideGroup.Edit,
  paste: GuideGroup.Edit,
  group: GuideGroup.Edit,
  ungroup: GuideGroup.Edit,
  'bring-front': GuideGroup.Edit,
  'send-back': GuideGroup.Edit,
  align: GuideGroup.Edit,
  tidy: GuideGroup.Edit,
  stack: GuideGroup.Edit,
  'edit-mode': GuideGroup.Edit,
  section: GuideGroup.Edit,
  'delete-keep': GuideGroup.Edit,
  nudge: GuideGroup.Edit,
  fit: GuideGroup.View,
  'zoom-actual': GuideGroup.View,
  'zoom-selection': GuideGroup.View,
  'zoom-in': GuideGroup.View,
  'zoom-out': GuideGroup.View,
  help: GuideGroup.View,
  view: GuideGroup.View
};

export const canvasGuide = (mod: string): { group: string; rows: CanvasGuideRow[] }[] =>
  Object.values(GuideGroup).map((group) => ({
    group,
    rows: CANVAS_SHORTCUTS.flatMap((row, i) => (GUIDE_GROUP[row.id] === group ? [{ id: `${row.id}-${i}`, name: row.label, keys: row.keys.map((k) => (k === MOD_KEY ? mod : k)).join(' '), gesture: '' }] : []))
  }));
