import type { Policy } from './permission-policy';

export enum ToolStatus {
  Pending = 'pending',
  Running = 'running',
  Done = 'done',
  Failed = 'failed'
}

export enum AgentEventKind {
  Text = 'text',
  Thought = 'thought',
  Tool = 'tool',
  Plan = 'plan',
  Permission = 'permission',
  Modes = 'modes',
  Config = 'config',
  Done = 'done',
  Failed = 'failed'
}

export type DiffView = { path: string; before: string | null; after: string };

export type ToolView = { id: string; title: string; kind: string; status: ToolStatus; diffs: DiffView[] };

export type PlanEntryView = { content: string; status: string };

export type ModeView = { id: string; name: string; description: string };

export enum ConfigCategory {
  Model = 'model',
  Effort = 'thought_level'
}

export type ConfigView = { id: string; name: string; category: ConfigCategory; current: string; values: ModeView[] };

export type OptionView = { id: string; name: string; allows: boolean };

export type AgentEvent =
  | { kind: AgentEventKind.Text; text: string }
  | { kind: AgentEventKind.Thought; text: string }
  | { kind: AgentEventKind.Tool; tool: ToolView }
  | { kind: AgentEventKind.Plan; entries: PlanEntryView[] }
  | { kind: AgentEventKind.Permission; id: string; tool: ToolView; options: OptionView[] }
  | { kind: AgentEventKind.Modes; available: ModeView[]; current: string }
  | { kind: AgentEventKind.Config; options: ConfigView[] }
  | { kind: AgentEventKind.Done; reason: string }
  | { kind: AgentEventKind.Failed; reason: string };

export type AgentSession = {
  id: string;
  resumed: boolean;
  send: (prompt: string) => Promise<void>;
  cancel: () => Promise<void>;
  answer: (id: string, optionId: string | null) => void;
  setMode: (id: string) => Promise<void>;
  setConfig: (id: string, value: string) => Promise<void>;
  close: () => void;
};

export type AgentFiles = {
  read: (path: string, from?: number, count?: number) => Promise<string>;
  write: (path: string, content: string) => Promise<void>;
};

export type Launch = { command: string; args: string[] };

export type AgentDeps = { cwd: string; resume: string | null; preferred: Record<string, string>; files: AgentFiles; policy: () => Policy; emit: (event: AgentEvent) => void };

export type OpenAgent = (launch: Launch, deps: AgentDeps) => Promise<AgentSession>;
