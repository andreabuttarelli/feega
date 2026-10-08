import type { Component } from 'svelte';
import Play from '@lucide/svelte/icons/play';
import Pause from '@lucide/svelte/icons/pause';
import Rewind from '@lucide/svelte/icons/rewind';
import SkipBack from '@lucide/svelte/icons/skip-back';
import SkipForward from '@lucide/svelte/icons/skip-forward';
import StepBack from '@lucide/svelte/icons/step-back';
import StepForward from '@lucide/svelte/icons/step-forward';
import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
import ArrowLeftToLine from '@lucide/svelte/icons/arrow-left-to-line';
import ArrowRightToLine from '@lucide/svelte/icons/arrow-right-to-line';
import ChevronFirst from '@lucide/svelte/icons/chevron-first';
import ChevronLast from '@lucide/svelte/icons/chevron-last';
import Bookmark from '@lucide/svelte/icons/bookmark';
import Trash from '@lucide/svelte/icons/trash-2';
import Scissors from '@lucide/svelte/icons/scissors';
import Copy from '@lucide/svelte/icons/copy';
import Undo from '@lucide/svelte/icons/undo-2';
import Redo from '@lucide/svelte/icons/redo-2';
import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
import ListChecks from '@lucide/svelte/icons/list-checks';
import X from '@lucide/svelte/icons/x';
import AlignStart from '@lucide/svelte/icons/align-start-vertical';
import AlignEnd from '@lucide/svelte/icons/align-end-vertical';
import ArrowRightFromLine from '@lucide/svelte/icons/arrow-right-from-line';
import ArrowLeftFromLine from '@lucide/svelte/icons/arrow-left-from-line';
import MoveLeft from '@lucide/svelte/icons/move-left';
import MoveRight from '@lucide/svelte/icons/move-right';
import Move from '@lucide/svelte/icons/move';
import Maximize2 from '@lucide/svelte/icons/maximize-2';
import RotateCw from '@lucide/svelte/icons/rotate-cw';
import Blend from '@lucide/svelte/icons/blend';
import Diamond from '@lucide/svelte/icons/diamond';
import ZoomIn from '@lucide/svelte/icons/zoom-in';
import ZoomOut from '@lucide/svelte/icons/zoom-out';
import BotMessageSquare from '@lucide/svelte/icons/bot-message-square';
import PanelRight from '@lucide/svelte/icons/panel-right';
import Keyboard from '@lucide/svelte/icons/keyboard';
import ArrowLeft from '@lucide/svelte/icons/arrow-left';
import Ellipsis from '@lucide/svelte/icons/ellipsis';
import Magnet from '@lucide/svelte/icons/magnet';
import Brackets from '@lucide/svelte/icons/brackets';
import Maximize from '@lucide/svelte/icons/maximize';
import Ghost from '@lucide/svelte/icons/ghost';
import Eye from '@lucide/svelte/icons/eye';
import EyeOff from '@lucide/svelte/icons/eye-off';
import Lock from '@lucide/svelte/icons/lock';
import LockOpen from '@lucide/svelte/icons/lock-open';
import Headphones from '@lucide/svelte/icons/headphones';
import ChevronUp from '@lucide/svelte/icons/chevron-up';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import Link2 from '@lucide/svelte/icons/link-2';
import Scan from '@lucide/svelte/icons/scan';
import SquareDashed from '@lucide/svelte/icons/square-dashed';
import Shuffle from '@lucide/svelte/icons/shuffle';
import ArrowRight from '@lucide/svelte/icons/arrow-right';
import CircleDashed from '@lucide/svelte/icons/circle-dashed';
import Group from '@lucide/svelte/icons/group';
import FolderOpen from '@lucide/svelte/icons/folder-open';
import CopyCheck from '@lucide/svelte/icons/copy-check';
import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
import ChartSpline from '@lucide/svelte/icons/chart-spline';
import AudioWaveform from '@lucide/svelte/icons/audio-waveform';
import ScissorsLineDashed from '@lucide/svelte/icons/scissors-line-dashed';
import { Command, SHORTCUTS } from './shortcuts';

export enum Tool {
  Back = 'back',
  More = 'more',
  Close = 'close',
  Snap = 'snap',
  NullFromSelection = 'null-from-selection',
  ClearWorkArea = 'clear-work-area',
  CopyEase = 'copy-ease',
  PasteEase = 'paste-ease',
  FitGraph = 'fit-graph',
  HideShy = 'hide-shy',
  HideTrack = 'hide-track',
  ShowTrack = 'show-track',
  LockTrack = 'lock-track',
  UnlockTrack = 'unlock-track',
  SoloTrack = 'solo-track',
  ShyTrack = 'shy-track',
  TrackUp = 'track-up',
  TrackDown = 'track-down',
  ParentWhip = 'parent-whip',
  HideLayer = 'hide-layer',
  ShowLayer = 'show-layer',
  LockLayer = 'lock-layer',
  UnlockLayer = 'unlock-layer',
  ItemUp = 'item-up',
  ItemDown = 'item-down',
  Remove = 'remove',
  Shuffle = 'shuffle',
  InOrder = 'in-order',
  GraphMode = 'graph-mode',
  MarkBeats = 'mark-beats',
  CutToBeat = 'cut-to-beat',
  OpenComp = 'open-comp',
  ParentTo = 'parent-to',
  SelectSeveral = 'select-several',
  ClipProperties = 'clip-properties'
}

export const Action = { ...Command, ...Tool } as const;
export type ActionId = Command | Tool;

export enum Caption {
  Never = 'never',
  Wide = 'wide'
}

export enum GuideGroup {
  Playback = 'Playback',
  Edit = 'Edit',
  Timeline = 'Timeline',
  View = 'View'
}

export enum Place {
  Bar = 'the top bar',
  Transport = 'the transport',
  Toolbar = 'the timeline toolbar',
  Track = 'a track header',
  Layer = 'a layer row',
  Graph = 'the graph editor',
  Menu = 'the ⋯ menu',
  Clip = 'the clip bar or a long press on the clip'
}

export enum MenuSection {
  Layer = 'Layer',
  Time = 'Time',
  Keyframes = 'Keyframes',
  View = 'View'
}

type ActionSpec = { name: string; icon: Component; group?: GuideGroup; place?: Place; menu?: MenuSection; gesture?: string };

const PINCH = 'Pinch the timeline';
const DRAG_PLAYHEAD = 'Drag the playhead';
const PINCH_PREVIEW = 'Pinch the preview';
const DOUBLE_TAP_PREVIEW = 'Double-tap around the preview';

export const ACTIONS: Record<ActionId, ActionSpec> = {
  [Command.TogglePlay]: { name: 'Play / pause', icon: Play, group: GuideGroup.Playback, place: Place.Transport },
  [Command.Play]: { name: 'Play', icon: Play, group: GuideGroup.Playback, place: Place.Transport },
  [Command.Pause]: { name: 'Pause', icon: Pause, group: GuideGroup.Playback, place: Place.Transport },
  [Command.Rewind]: { name: 'Back one second', icon: Rewind, group: GuideGroup.Playback, gesture: DRAG_PLAYHEAD, menu: MenuSection.Time },
  [Command.GoStart]: { name: 'Go to start', icon: SkipBack, group: GuideGroup.Playback, place: Place.Transport },
  [Command.GoEnd]: { name: 'Go to end', icon: SkipForward, group: GuideGroup.Playback, place: Place.Transport },
  [Command.StepBack]: { name: 'Previous frame', icon: StepBack, group: GuideGroup.Playback, place: Place.Transport },
  [Command.StepForward]: { name: 'Next frame', icon: StepForward, group: GuideGroup.Playback, place: Place.Transport },
  [Command.StepBackMore]: { name: 'Back 10 frames', icon: ChevronsLeft, group: GuideGroup.Playback, gesture: DRAG_PLAYHEAD, menu: MenuSection.Time },
  [Command.StepForwardMore]: { name: 'Forward 10 frames', icon: ChevronsRight, group: GuideGroup.Playback, gesture: DRAG_PLAYHEAD, menu: MenuSection.Time },
  [Command.PrevKeyframe]: { name: 'Previous keyframe', icon: ArrowLeftToLine, group: GuideGroup.Playback, menu: MenuSection.Time },
  [Command.NextKeyframe]: { name: 'Next keyframe', icon: ArrowRightToLine, group: GuideGroup.Playback, menu: MenuSection.Time },

  [Command.Split]: { name: 'Split clip', icon: Scissors, group: GuideGroup.Edit, place: Place.Toolbar },
  [Command.Duplicate]: { name: 'Duplicate', icon: Copy, group: GuideGroup.Edit, place: Place.Toolbar },
  [Command.Delete]: { name: 'Delete', icon: Trash, group: GuideGroup.Edit, place: Place.Toolbar },
  [Command.Undo]: { name: 'Undo', icon: Undo, group: GuideGroup.Edit, place: Place.Bar },
  [Command.Redo]: { name: 'Redo', icon: Redo, group: GuideGroup.Edit, place: Place.Bar },
  [Command.Copy]: { name: 'Copy keyframes', icon: ClipboardCopy, group: GuideGroup.Edit, menu: MenuSection.Keyframes },
  [Command.Paste]: { name: 'Paste keyframes', icon: ClipboardPaste, group: GuideGroup.Edit, menu: MenuSection.Keyframes },
  [Command.SelectAll]: { name: 'Select all clips', icon: ListChecks, group: GuideGroup.Edit, menu: MenuSection.Layer },
  [Command.Deselect]: { name: 'Deselect', icon: X, group: GuideGroup.Edit, gesture: 'Tap an empty lane', menu: MenuSection.Layer },
  [Command.Precompose]: { name: 'Precompose', icon: Group, group: GuideGroup.Edit, menu: MenuSection.Layer },
  [Tool.NullFromSelection]: { name: 'Null parent', icon: CircleDashed, group: GuideGroup.Edit, menu: MenuSection.Layer },
  [Command.StartHere]: { name: 'Move clip to start here', icon: AlignStart, group: GuideGroup.Edit, gesture: 'Drag the clip', menu: MenuSection.Layer },
  [Command.EndHere]: { name: 'Move clip to end here', icon: AlignEnd, group: GuideGroup.Edit, gesture: 'Drag the clip', menu: MenuSection.Layer },
  [Command.TrimIn]: { name: 'Trim start to here', icon: ArrowRightFromLine, group: GuideGroup.Edit, gesture: 'Drag the clip’s left edge', menu: MenuSection.Layer },
  [Command.TrimOut]: { name: 'Trim end to here', icon: ArrowLeftFromLine, group: GuideGroup.Edit, gesture: 'Drag the clip’s right edge', menu: MenuSection.Layer },
  [Command.NudgeBack]: { name: 'Nudge 1 frame earlier', icon: MoveLeft, group: GuideGroup.Edit, gesture: 'Drag the clip', menu: MenuSection.Layer },
  [Command.NudgeForward]: { name: 'Nudge 1 frame later', icon: MoveRight, group: GuideGroup.Edit, gesture: 'Drag the clip', menu: MenuSection.Layer },
  [Command.NudgeBackMore]: { name: 'Nudge 10 frames earlier', icon: ChevronsLeft, group: GuideGroup.Edit, gesture: 'Drag the clip', menu: MenuSection.Layer },
  [Command.NudgeForwardMore]: { name: 'Nudge 10 frames later', icon: ChevronsRight, group: GuideGroup.Edit, gesture: 'Drag the clip', menu: MenuSection.Layer },
  [Tool.CopyEase]: { name: 'Copy ease', icon: ClipboardCopy, group: GuideGroup.Edit, place: Place.Graph },
  [Tool.PasteEase]: { name: 'Paste ease', icon: ClipboardPaste, group: GuideGroup.Edit, place: Place.Graph },

  [Command.AddMarker]: { name: 'Add marker', icon: Bookmark, group: GuideGroup.Timeline, menu: MenuSection.Time },
  [Command.WorkIn]: { name: 'Work area starts here', icon: ChevronFirst, group: GuideGroup.Timeline, menu: MenuSection.Time },
  [Command.WorkOut]: { name: 'Work area ends here', icon: ChevronLast, group: GuideGroup.Timeline, menu: MenuSection.Time },
  [Tool.ClearWorkArea]: { name: 'Clear work area', icon: Brackets, group: GuideGroup.Timeline, menu: MenuSection.Time },
  [Tool.Snap]: { name: 'Snap', icon: Magnet, group: GuideGroup.Timeline, place: Place.Toolbar },
  [Command.ZoomIn]: { name: 'Zoom in', icon: ZoomIn, group: GuideGroup.Timeline, gesture: PINCH, menu: MenuSection.View },
  [Command.ZoomOut]: { name: 'Zoom out', icon: ZoomOut, group: GuideGroup.Timeline, gesture: PINCH, menu: MenuSection.View },
  [Command.RevealPosition]: { name: 'Show position', icon: Move, group: GuideGroup.Timeline, menu: MenuSection.View },
  [Command.RevealScale]: { name: 'Show scale', icon: Maximize2, group: GuideGroup.Timeline, menu: MenuSection.View },
  [Command.RevealRotation]: { name: 'Show rotation', icon: RotateCw, group: GuideGroup.Timeline, menu: MenuSection.View },
  [Command.RevealOpacity]: { name: 'Show opacity', icon: Blend, group: GuideGroup.Timeline, menu: MenuSection.View },
  [Command.RevealAnimated]: { name: 'Show animated properties', icon: Diamond, group: GuideGroup.Timeline, menu: MenuSection.View },
  [Tool.HideShy]: { name: 'Hide shy tracks', icon: Ghost, group: GuideGroup.Timeline, place: Place.Track },
  [Tool.HideTrack]: { name: 'Hide track', icon: Eye, group: GuideGroup.Timeline, place: Place.Track },
  [Tool.ShowTrack]: { name: 'Show track', icon: EyeOff, place: Place.Track },
  [Tool.LockTrack]: { name: 'Lock track', icon: LockOpen, group: GuideGroup.Timeline, place: Place.Track },
  [Tool.UnlockTrack]: { name: 'Unlock track', icon: Lock, place: Place.Track },
  [Tool.SoloTrack]: { name: 'Solo track', icon: Headphones, group: GuideGroup.Timeline, place: Place.Track },
  [Tool.ShyTrack]: { name: 'Mark track shy', icon: Ghost, group: GuideGroup.Timeline, place: Place.Track },
  [Tool.TrackUp]: { name: 'Move track up', icon: ChevronUp, group: GuideGroup.Timeline, place: Place.Track },
  [Tool.TrackDown]: { name: 'Move track down', icon: ChevronDown, group: GuideGroup.Timeline, place: Place.Track },
  [Tool.ParentWhip]: { name: 'Parent: drag onto a layer', icon: Link2, group: GuideGroup.Timeline, place: Place.Layer },
  [Tool.HideLayer]: { name: 'Hide layer', icon: Eye, group: GuideGroup.Timeline, place: Place.Layer },
  [Tool.ShowLayer]: { name: 'Show layer', icon: EyeOff, place: Place.Layer },
  [Tool.LockLayer]: { name: 'Lock layer', icon: LockOpen, group: GuideGroup.Timeline, place: Place.Layer },
  [Tool.UnlockLayer]: { name: 'Unlock layer', icon: Lock, place: Place.Layer },
  [Tool.FitGraph]: { name: 'Fit curves to view', icon: Maximize, group: GuideGroup.Timeline, place: Place.Graph },

  [Command.PreviewZoomIn]: { name: 'Zoom preview in', icon: ZoomIn, group: GuideGroup.View, menu: MenuSection.View, gesture: PINCH_PREVIEW },
  [Command.PreviewZoomOut]: { name: 'Zoom preview out', icon: ZoomOut, group: GuideGroup.View, menu: MenuSection.View, gesture: PINCH_PREVIEW },
  [Command.PreviewFit]: { name: 'Fit preview', icon: Scan, group: GuideGroup.View, menu: MenuSection.View, gesture: DOUBLE_TAP_PREVIEW },
  [Command.PreviewActual]: { name: 'Preview at 100%', icon: SquareDashed, group: GuideGroup.View, menu: MenuSection.View, gesture: DOUBLE_TAP_PREVIEW },
  [Command.ToggleInspector]: { name: 'Properties panel', icon: PanelRight, group: GuideGroup.View, place: Place.Bar },
  [Command.ToggleChat]: { name: 'Agent panel', icon: BotMessageSquare, group: GuideGroup.View, place: Place.Bar },
  [Command.Help]: { name: 'Keyboard & gestures', icon: Keyboard, group: GuideGroup.View, menu: MenuSection.View },
  [Tool.Back]: { name: 'Back to the canvas', icon: ArrowLeft },
  [Tool.More]: { name: 'More actions', icon: Ellipsis },
  [Tool.Close]: { name: 'Close', icon: X },
  [Tool.ItemUp]: { name: 'Move up', icon: ChevronUp },
  [Tool.ItemDown]: { name: 'Move down', icon: ChevronDown },
  [Tool.Remove]: { name: 'Remove', icon: X },
  [Tool.Shuffle]: { name: 'Shuffle the order', icon: Shuffle },
  [Tool.InOrder]: { name: 'Keep the order', icon: ArrowRight },
  [Tool.GraphMode]: { name: 'Graph editor', icon: ChartSpline, group: GuideGroup.Timeline, menu: MenuSection.View },
  [Tool.MarkBeats]: { name: 'Mark the beats', icon: AudioWaveform, group: GuideGroup.Timeline, menu: MenuSection.Time },
  [Tool.OpenComp]: { name: 'Open composition', icon: FolderOpen, group: GuideGroup.Edit, place: Place.Clip, gesture: 'Double-click the clip' },
  [Tool.ParentTo]: { name: 'Parent to…', icon: Link2, group: GuideGroup.Edit, place: Place.Clip },
  [Tool.SelectSeveral]: { name: 'Select several', icon: CopyCheck, group: GuideGroup.Edit, place: Place.Clip },
  [Tool.ClipProperties]: { name: 'Properties', icon: SlidersHorizontal, place: Place.Clip },
  [Tool.CutToBeat]: { name: 'Cut to the beat', icon: ScissorsLineDashed, group: GuideGroup.Edit, menu: MenuSection.Time }
};

export function shortcutOf(id: ActionId): string {
  const labels = SHORTCUTS.filter((b) => b.command === id).map((b) => b.label);
  return [...new Set(labels)].join(' ');
}

export type TipText = { name: string; keys: string };

export const tipText = (id: ActionId, name = ACTIONS[id].name): TipText => ({ name, keys: shortcutOf(id) });

export const placeOf = (id: ActionId): Place | undefined => (ACTIONS[id].menu ? Place.Menu : ACTIONS[id].place);

function gestureOf(id: ActionId): string {
  const place = placeOf(id);
  if (ACTIONS[id].gesture) {
    return ACTIONS[id].gesture ?? '';
  }
  return place ? `Tap in ${place}` : '';
}

export type MenuGroup = { section: MenuSection; ids: ActionId[] };

export function menuSections(): MenuGroup[] {
  const ids = Object.keys(ACTIONS) as ActionId[];
  return Object.values(MenuSection).map((section) => ({ section, ids: ids.filter((id) => ACTIONS[id].menu === section) }));
}

export type GuideRow = { id: ActionId; name: string; icon: Component; keys: string; gesture: string };
export type GuideSection = { group: GuideGroup; rows: GuideRow[] };

export function guideSections(): GuideSection[] {
  const entries = Object.entries(ACTIONS) as [ActionId, ActionSpec][];
  return Object.values(GuideGroup).map((group) => ({
    group,
    rows: entries
      .filter(([, spec]) => spec.group === group)
      .map(([id, spec]) => ({ id, name: spec.name, icon: spec.icon, keys: shortcutOf(id), gesture: gestureOf(id) }))
  }));
}
