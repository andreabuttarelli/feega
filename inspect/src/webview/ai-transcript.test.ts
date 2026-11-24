import { describe, expect, it } from 'vitest';
import { AgentEventKind, ToolStatus, type ToolView } from '../host/ai/agent-session';
import { ItemKind, answered, heard, said, type Item } from './ai-transcript';

const tool = (status: ToolStatus, title = 'Edit a.ts'): ToolView => ({ id: 't1', title, kind: 'edit', status, diffs: [] });

describe('the chat transcript', () => {
  it('joins streamed text chunks into one agent message', () => {
    const items = [{ kind: AgentEventKind.Text, text: 'Hel' }, { kind: AgentEventKind.Text, text: 'lo' }].reduce<Item[]>((all, event) => heard(all, event as never), []);

    expect(items).toEqual([{ kind: ItemKind.Agent, text: 'Hello' }]);
  });

  it('starts a new message after a tool call', () => {
    let items = heard([], { kind: AgentEventKind.Text, text: 'a' });
    items = heard(items, { kind: AgentEventKind.Tool, tool: tool(ToolStatus.Running) });
    items = heard(items, { kind: AgentEventKind.Text, text: 'b' });

    expect(items.map((i) => i.kind)).toEqual([ItemKind.Agent, ItemKind.Tool, ItemKind.Agent]);
  });

  it('updates a tool card in place instead of adding one', () => {
    let items = heard([], { kind: AgentEventKind.Tool, tool: tool(ToolStatus.Running) });
    items = heard(items, { kind: AgentEventKind.Tool, tool: tool(ToolStatus.Done) });

    expect(items).toEqual([{ kind: ItemKind.Tool, tool: tool(ToolStatus.Done) }]);
  });

  it('keeps one plan and replaces it as it changes', () => {
    let items = heard([], { kind: AgentEventKind.Plan, entries: [{ content: 'a', status: 'pending' }] });
    items = heard(items, { kind: AgentEventKind.Plan, entries: [{ content: 'a', status: 'completed' }] });

    expect(items).toEqual([{ kind: ItemKind.Plan, entries: [{ content: 'a', status: 'completed' }] }]);
  });

  it('records a permission request and marks which option answered it', () => {
    let items = heard([], { kind: AgentEventKind.Permission, id: '1', tool: tool(ToolStatus.Pending), options: [{ id: 'allow', name: 'Allow', allows: true }] });
    items = answered(items, '1', 'Allow');

    expect(items[0]).toMatchObject({ kind: ItemKind.Permission, id: '1', answer: 'Allow' });
  });

  it('folds the tool card into its permission request', () => {
    let items = heard([], { kind: AgentEventKind.Tool, tool: tool(ToolStatus.Pending) });
    items = heard(items, { kind: AgentEventKind.Permission, id: '1', tool: tool(ToolStatus.Pending), options: [] });

    expect(items.map((i) => i.kind)).toEqual([ItemKind.Permission]);
  });

  it('shows a failure as an error line', () => {
    expect(heard([], { kind: AgentEventKind.Failed, reason: 'boom' })).toEqual([{ kind: ItemKind.Error, text: 'boom' }]);
  });

  it('notes a cancelled turn and ignores a normal end', () => {
    expect(heard([], { kind: AgentEventKind.Done, reason: 'end_turn' })).toEqual([]);
    expect(heard([], { kind: AgentEventKind.Done, reason: 'cancelled' })).toEqual([{ kind: ItemKind.Note, text: 'Stopped' }]);
  });

  it('adds what the user said with the context it carried', () => {
    expect(said([], 'fix it', 'src/a.ts:1:1')).toEqual([{ kind: ItemKind.User, text: 'fix it', context: 'src/a.ts:1:1' }]);
  });
});
