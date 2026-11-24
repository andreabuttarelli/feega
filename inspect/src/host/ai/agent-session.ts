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
  Done = 'done',
  Failed = 'failed'
}

export type DiffView = { path: string; before: string | null; after: string };

export type ToolView = { id: string; title: string; kind: string; status: ToolStatus; diffs: DiffView[] };

export type PlanEntryView = { content: string; status: string };

export type OptionView = { id: string; name: string; allows: boolean };

export type AgentEvent =
  | { kind: AgentEventKind.Text; text: string }
  | { kind: AgentEventKind.Thought; text: string }
  | { kind: AgentEventKind.Tool; tool: ToolView }
  | { kind: AgentEventKind.Plan; entries: PlanEntryView[] }
  | { kind: AgentEventKind.Permission; id: string; tool: ToolView; options: OptionView[] }
  | { kind: AgentEventKind.Done; reason: string }
  | { kind: AgentEventKind.Failed; reason: string };

export type AgentSession = {
  send: (prompt: string) => Promise<void>;
  cancel: () => Promise<void>;
  answer: (id: string, optionId: string | null) => void;
  close: () => void;
};

export type AgentFiles = {
  read: (path: string, from?: number, count?: number) => Promise<string>;
  write: (path: string, content: string) => Promise<void>;
};

export type Launch = { command: string; args: string[] };

export type AgentDeps = { cwd: string; files: AgentFiles; emit: (event: AgentEvent) => void };

export type OpenAgent = (launch: Launch, deps: AgentDeps) => Promise<AgentSession>;
