export type Source = { file: string; line: number; col: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type Css = Record<string, string>;

export type Selection = {
  source: Source;
  component: Source | null;
  tag: string;
  name: string;
  classes: string;
  rect: Rect;
  styles: Css;
  attributes: { name: string; value: string }[];
};

export type ProjectInfo = { typescript: boolean; publicDir: string; packages: Record<string, string> };

export enum OpKind {
  Style = 'style',
  Insert = 'insert',
  Attributes = 'attributes',
  Dependency = 'dependency',
  Asset = 'asset'
}

export enum Place {
  Auto = 'auto',
  Child = 'child',
  After = 'after',
  Before = 'before'
}

export type SupportFile = { file: string; source: string };

export type ComponentFile = { name: string; file: string; source: string; attributes?: string };

export type Op =
  | { kind: OpKind.Style; at: string; css: Css }
  | { kind: OpKind.Insert; at: string; place: Place; component: ComponentFile; support?: SupportFile[] }
  | { kind: OpKind.Attributes; at?: string; tag?: string; set: Record<string, string>; numbers?: Record<string, number> }
  | { kind: OpKind.Dependency; name: string; version: string; dev?: boolean }
  | { kind: OpKind.Asset; file: string; base64: string };

export type Proposal = { label: string; ops: Op[] };

export type Outcome = { ok: true } | { ok: false; reason: string };

export enum Call {
  Selection = 'selection',
  Project = 'project',
  SourceText = 'source-text',
  Propose = 'propose',
  Preview = 'preview',
  Fetch = 'fetch',
  PickFile = 'pick-file',
  Notify = 'notify',
  Render = 'render',
  Overlay = 'overlay'
}

export enum Control {
  Slider = 'slider',
  Colour = 'colour',
  Toggle = 'toggle',
  Select = 'select',
  Button = 'button',
  List = 'list',
  Note = 'note'
}

export type UiNode =
  | { type: Control.Slider; id: string; label: string; min: number; max: number; step: number; value: number }
  | { type: Control.Colour; id: string; label: string; value: string }
  | { type: Control.Toggle; id: string; label: string; value: boolean }
  | { type: Control.Select; id: string; label: string; value: string; options: { value: string; label: string }[] }
  | { type: Control.Button; id: string; label: string }
  | { type: Control.List; id: string; label: string; selected: string | null; items: { id: string; label: string; swatch?: string }[] }
  | { type: Control.Note; text: string };

export type Handle = { id: string; x: number; y: number; color: string; selected: boolean };

export type Fetched = { status: number; text: string };

export type Picked = { name: string; base64: string };

export type CallArgs = {
  [Call.Selection]: undefined;
  [Call.Project]: undefined;
  [Call.SourceText]: undefined;
  [Call.Propose]: Proposal;
  [Call.Preview]: { at: string; css: Css | null };
  [Call.Fetch]: { url: string };
  [Call.PickFile]: { accept: string[] };
  [Call.Notify]: { text: string };
  [Call.Render]: { contribution: string; tree: UiNode[] };
  [Call.Overlay]: { contribution: string; handles: Handle[] };
};

export type CallResult = {
  [Call.Selection]: Selection | null;
  [Call.Project]: ProjectInfo;
  [Call.SourceText]: string | null;
  [Call.Propose]: Outcome;
  [Call.Preview]: null;
  [Call.Fetch]: Fetched;
  [Call.PickFile]: Picked | null;
  [Call.Notify]: null;
  [Call.Render]: null;
  [Call.Overlay]: null;
};

export type PluginMessage = { type: 'call'; id: number; call: Call; args: unknown };

export enum Signal {
  Selection = 'selection',
  Control = 'control',
  Handle = 'handle',
  Menu = 'menu',
  Command = 'command',
  Action = 'action'
}

export enum HandlePhase {
  Press = 'press',
  Move = 'move',
  Release = 'release'
}

export type Signals = {
  [Signal.Selection]: { selection: Selection | null };
  [Signal.Control]: { contribution: string; id: string; value: string | number | boolean; live: boolean };
  [Signal.Handle]: { contribution: string; id: string; phase: HandlePhase; x: number; y: number };
  [Signal.Menu]: { item: string; target: Source | null; place: Place | null };
  [Signal.Command]: { command: string };
  [Signal.Action]: { action: string };
};

export type HostMessage =
  | { type: 'result'; id: number; ok: true; value: unknown }
  | { type: 'result'; id: number; ok: false; reason: string }
  | { type: 'signal'; signal: Signal; payload: unknown };

export enum Framework {
  Svelte = 'svelte',
  Vue = 'vue',
  Astro = 'astro',
  React = 'react'
}

const FRAMEWORK_BY_EXTENSION: Record<string, Framework> = {
  svelte: Framework.Svelte,
  vue: Framework.Vue,
  astro: Framework.Astro,
  tsx: Framework.React,
  jsx: Framework.React
};

export const frameworkOf = (file: string): Framework | null => FRAMEWORK_BY_EXTENSION[file.slice(file.lastIndexOf('.') + 1)] ?? null;
