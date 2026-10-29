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
  Play = 'play'
}

export enum CanvasLines {
  Nodes = 'nodes',
  Prototype = 'prototype'
}

type ModeSpec = {
  label: string;
  edit: EditMode;
  inspector: ModeInspector;
  lines: CanvasLines;
  onMotionKey: EditorMode;
  onCodeKey: EditorMode;
};

export const MODES: Record<EditorMode, ModeSpec> = {
  [EditorMode.Design]: { label: 'Design', edit: EditMode.Design, inspector: ModeInspector.Properties, lines: CanvasLines.Nodes, onMotionKey: EditorMode.Motion, onCodeKey: EditorMode.Code },
  [EditorMode.Motion]: { label: 'Motion', edit: EditMode.Motion, inspector: ModeInspector.Properties, lines: CanvasLines.Nodes, onMotionKey: EditorMode.Design, onCodeKey: EditorMode.Code },
  [EditorMode.Play]: { label: 'Play', edit: EditMode.Design, inspector: ModeInspector.Play, lines: CanvasLines.Prototype, onMotionKey: EditorMode.Design, onCodeKey: EditorMode.Code },
  [EditorMode.Code]: { label: 'Code', edit: EditMode.Design, inspector: ModeInspector.Code, lines: CanvasLines.Nodes, onMotionKey: EditorMode.Design, onCodeKey: EditorMode.Design }
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
