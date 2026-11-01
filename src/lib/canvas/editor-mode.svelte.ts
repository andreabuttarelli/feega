import type { Component } from 'svelte';
import PenTool from '@lucide/svelte/icons/pen-tool';
import Diamond from '@lucide/svelte/icons/diamond';
import Play from '@lucide/svelte/icons/play';
import CodeXml from '@lucide/svelte/icons/code-xml';
import { EditMode, timelineShown } from '$lib/motion/edit-mode';
import { DocAccess } from '$lib/motion/frame-edit-session.svelte';

export enum EditorMode {
  Design = 'design',
  Motion = 'motion',
  Play = 'play',
  Code = 'code'
}

export enum ModeInspector {
  Properties = 'properties',
  Code = 'code',
  Play = 'play'
}

export enum CanvasLines {
  Nodes = 'nodes',
  Prototype = 'prototype'
}

export enum ModeChrome {
  Plain = 'plain',
  Recording = 'recording'
}

export enum TimelineAccess {
  Hidden = 'hidden',
  Scrub = 'scrub',
  Edit = 'edit'
}

export enum SoundEntries {
  Hidden = 'hidden',
  Shown = 'shown'
}

type ModeAccent = { solid: string; light: string; dark: string };

type ModeSpec = {
  label: string;
  accent: ModeAccent;
  icon: Component;
  edit: EditMode;
  inspector: ModeInspector;
  lines: CanvasLines;
  access: DocAccess;
  onMotionKey: EditorMode;
  onCodeKey: EditorMode;
  chrome: ModeChrome;
  timeline: TimelineAccess;
  sounds: SoundEntries;
};

export const MODES: Record<EditorMode, ModeSpec> = {
  [EditorMode.Design]: { label: 'Design', accent: { solid: '#0b6bcb', light: '#0b6bcb', dark: '#3ab0ff' }, icon: PenTool, edit: EditMode.Design, access: DocAccess.Write, inspector: ModeInspector.Properties, lines: CanvasLines.Nodes, onMotionKey: EditorMode.Motion, onCodeKey: EditorMode.Code, chrome: ModeChrome.Plain, timeline: TimelineAccess.Scrub, sounds: SoundEntries.Hidden },
  [EditorMode.Motion]: { label: 'Motion', accent: { solid: '#c42b1c', light: '#c42b1c', dark: '#ff7366' }, icon: Diamond, edit: EditMode.Motion, access: DocAccess.Write, inspector: ModeInspector.Properties, lines: CanvasLines.Nodes, onMotionKey: EditorMode.Design, onCodeKey: EditorMode.Code, chrome: ModeChrome.Recording, timeline: TimelineAccess.Edit, sounds: SoundEntries.Shown },
  [EditorMode.Play]: { label: 'Play', accent: { solid: '#1a7f37', light: '#1a7f37', dark: '#3fb950' }, icon: Play, edit: EditMode.Design, access: DocAccess.Write, inspector: ModeInspector.Play, lines: CanvasLines.Prototype, onMotionKey: EditorMode.Design, onCodeKey: EditorMode.Code, chrome: ModeChrome.Plain, timeline: TimelineAccess.Hidden, sounds: SoundEntries.Hidden },
  [EditorMode.Code]: { label: 'Code', accent: { solid: '#9a6700', light: '#9a6700', dark: '#e3b341' }, icon: CodeXml, edit: EditMode.Design, access: DocAccess.Read, inspector: ModeInspector.Code, lines: CanvasLines.Nodes, onMotionKey: EditorMode.Design, onCodeKey: EditorMode.Design, chrome: ModeChrome.Plain, timeline: TimelineAccess.Hidden, sounds: SoundEntries.Hidden }
};

const FRAME_TIMELINE: Record<TimelineAccess, (kindHasTimeline: boolean, mode: EditMode) => boolean> = {
  [TimelineAccess.Hidden]: () => false,
  [TimelineAccess.Scrub]: (kindHasTimeline) => kindHasTimeline,
  [TimelineAccess.Edit]: timelineShown
};

export const frameTimeline = (access: TimelineAccess, kindHasTimeline: boolean, mode: EditMode): TimelineAccess => (FRAME_TIMELINE[access](kindHasTimeline, mode) ? access : TimelineAccess.Hidden);

export const accentTokens = (mode: EditorMode): Record<string, string> => ({
  '--ui-mode-solid': MODES[mode].accent.solid,
  '--ui-mode-text-light': MODES[mode].accent.light,
  '--ui-mode-text-dark': MODES[mode].accent.dark
});

function paint(mode: EditorMode): void {
  if (typeof document === 'undefined') {
    return;
  }

  for (const [name, value] of Object.entries(accentTokens(mode))) {
    document.documentElement.style.setProperty(name, value);
  }
}

export const EDITOR_MODE_KEY = 'feega.editor-mode';

type ModeStore = Pick<Storage, 'getItem' | 'setItem'>;

export const readEditorMode = (stored: string | null): EditorMode => (Object.values(EditorMode) as string[]).includes(stored ?? '') ? (stored as EditorMode) : EditorMode.Design;

function recalled(store: ModeStore | null): string | null {
  try {
    return store?.getItem(EDITOR_MODE_KEY) ?? null;
  } catch {
    return null;
  }
}

function remember(store: ModeStore | null, mode: EditorMode): void {
  try {
    store?.setItem(EDITOR_MODE_KEY, mode);
  } catch {
    return;
  }
}

export class EditorModeState {
  current = $state(EditorMode.Design);
  private opened = $state<Record<EditorMode, boolean>>({ [EditorMode.Design]: false, [EditorMode.Motion]: true, [EditorMode.Play]: false, [EditorMode.Code]: false });

  constructor(private readonly store: ModeStore | null) {
    this.current = readEditorMode(recalled(store));
    paint(this.current);
  }

  get spec(): ModeSpec {
    return MODES[this.current];
  }

  set(mode: EditorMode) {
    this.current = mode;
    paint(mode);
    remember(this.store, mode);
  }

  toggleMotion() {
    this.set(this.spec.onMotionKey);
  }

  toggleCode() {
    this.set(this.spec.onCodeKey);
  }

  get timeline(): TimelineAccess {
    return this.opened[this.current] ? this.spec.timeline : TimelineAccess.Hidden;
  }

  toggleTimeline() {
    this.opened[this.current] = !this.opened[this.current];
  }
}

export const editorMode = new EditorModeState(typeof localStorage === 'undefined' ? null : localStorage);
