import type { Component } from 'svelte';
import PenTool from '@lucide/svelte/icons/pen-tool';
import Diamond from '@lucide/svelte/icons/diamond';
import Play from '@lucide/svelte/icons/play';
import CodeXml from '@lucide/svelte/icons/code-xml';
import { EditMode } from '$lib/motion/edit-mode';

export enum EditorMode {
  Design = 'design',
  Motion = 'motion',
  Play = 'play',
  Code = 'code'
}

export enum ModeInspector {
  Properties = 'properties',
  Code = 'code',
  Soon = 'soon'
}

type ModeSpec = {
  label: string;
  icon: Component;
  edit: EditMode;
  inspector: ModeInspector;
  onMotionKey: EditorMode;
  onCodeKey: EditorMode;
};

export const MODES: Record<EditorMode, ModeSpec> = {
  [EditorMode.Design]: { label: 'Design', icon: PenTool, edit: EditMode.Design, inspector: ModeInspector.Properties, onMotionKey: EditorMode.Motion, onCodeKey: EditorMode.Code },
  [EditorMode.Motion]: { label: 'Motion', icon: Diamond, edit: EditMode.Motion, inspector: ModeInspector.Properties, onMotionKey: EditorMode.Design, onCodeKey: EditorMode.Code },
  [EditorMode.Play]: { label: 'Play', icon: Play, edit: EditMode.Design, inspector: ModeInspector.Soon, onMotionKey: EditorMode.Design, onCodeKey: EditorMode.Code },
  [EditorMode.Code]: { label: 'Code', icon: CodeXml, edit: EditMode.Design, inspector: ModeInspector.Code, onMotionKey: EditorMode.Design, onCodeKey: EditorMode.Design }
};

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

  constructor(private readonly store: ModeStore | null) {
    this.current = readEditorMode(recalled(store));
  }

  get spec(): ModeSpec {
    return MODES[this.current];
  }

  set(mode: EditorMode) {
    this.current = mode;
    remember(this.store, mode);
  }

  toggleMotion() {
    this.set(this.spec.onMotionKey);
  }

  toggleCode() {
    this.set(this.spec.onCodeKey);
  }
}

export const editorMode = new EditorModeState(typeof localStorage === 'undefined' ? null : localStorage);
