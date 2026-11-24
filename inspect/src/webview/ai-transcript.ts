import { AgentEventKind, type AgentEvent, type OptionView, type PlanEntryView, type ToolView } from '../host/ai/agent-session';

export enum ItemKind {
  User = 'user',
  Agent = 'agent',
  Thought = 'thought',
  Tool = 'tool',
  Plan = 'plan',
  Permission = 'permission',
  Error = 'error',
  Note = 'note'
}

export type Item =
  | { kind: ItemKind.User; text: string; context: string | null }
  | { kind: ItemKind.Agent; text: string }
  | { kind: ItemKind.Thought; text: string }
  | { kind: ItemKind.Tool; tool: ToolView }
  | { kind: ItemKind.Plan; entries: PlanEntryView[] }
  | { kind: ItemKind.Permission; id: string; tool: ToolView; options: OptionView[]; answer?: string }
  | { kind: ItemKind.Error; text: string }
  | { kind: ItemKind.Note; text: string };

const CANCELLED = 'cancelled';
const STOPPED = 'Stopped';

const grown = (items: Item[], kind: ItemKind.Agent | ItemKind.Thought, text: string): Item[] => {
  const last = items.at(-1);
  return last?.kind === kind ? [...items.slice(0, -1), { kind, text: last.text + text }] : [...items, { kind, text }];
};

const replaced = (items: Item[], same: (item: Item) => boolean, next: Item): Item[] => (items.some(same) ? items.map((item) => (same(item) ? next : item)) : [...items, next]);

export const said = (items: Item[], text: string, context: string | null): Item[] => [...items, { kind: ItemKind.User, text, context }];

export const heard = (items: Item[], event: AgentEvent): Item[] => {
  switch (event.kind) {
    case AgentEventKind.Text:
      return grown(items, ItemKind.Agent, event.text);
    case AgentEventKind.Thought:
      return grown(items, ItemKind.Thought, event.text);
    case AgentEventKind.Tool:
      return replaced(items, (i) => i.kind === ItemKind.Tool && i.tool.id === event.tool.id, { kind: ItemKind.Tool, tool: event.tool });
    case AgentEventKind.Plan:
      return replaced(items, (i) => i.kind === ItemKind.Plan, { kind: ItemKind.Plan, entries: event.entries });
    case AgentEventKind.Permission:
      return [...items.filter((i) => !(i.kind === ItemKind.Tool && i.tool.id === event.tool.id)), { kind: ItemKind.Permission, id: event.id, tool: event.tool, options: event.options }];
    case AgentEventKind.Modes:
      return items;
    case AgentEventKind.Failed:
      return [...items, { kind: ItemKind.Error, text: event.reason }];
    case AgentEventKind.Done:
      return event.reason === CANCELLED ? [...items, { kind: ItemKind.Note, text: STOPPED }] : items;
  }
};

export const answered = (items: Item[], id: string, answer: string): Item[] => items.map((item) => (item.kind === ItemKind.Permission && item.id === id ? { ...item, answer } : item));
