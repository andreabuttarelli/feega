import { describe, expect, it } from 'vitest';
import { TOOL_STATUS, canvasLinkOf, failureOfStatus, keyboardInset, speakerStarts, toolStatusOf } from './chat-view';

describe('toolStatusOf', () => {
  it('treats a call without a status as still running', () => {
    expect(toolStatusOf({ toolName: 'list_nodes' })).toBe('running');
  });

  it('reports a streamed error as failed', () => {
    expect(toolStatusOf({ toolName: 'run_node', status: 'error' })).toBe('error');
  });

  it('reports a finished call whose output refused as failed', () => {
    expect(toolStatusOf({ toolName: 'update_node', status: 'done', output: { outcome: 'conflict' } })).toBe('error');
    expect(toolStatusOf({ toolName: 'move_node', status: 'done', output: { error: 'node_not_found' } })).toBe('error');
  });

  it('reports a clean finish as done', () => {
    expect(toolStatusOf({ toolName: 'create_node', status: 'done', output: { node: {} } })).toBe('done');
  });

  it('has one row per status', () => {
    expect(Object.keys(TOOL_STATUS).sort()).toEqual(['done', 'error', 'running']);
  });
});

describe('canvasLinkOf', () => {
  it('links a created node to its canvas', () => {
    const link = canvasLinkOf(
      { toolName: 'create_node', output: { node: { id: 'n1', canvasId: 'c1', type: 'image', displayName: 'Hero' } } },
      'p1'
    );
    expect(link).toEqual({ href: '/p/p1/c/c1', label: 'Hero' });
  });

  it('falls back to the node type when it has no name', () => {
    const link = canvasLinkOf({ toolName: 'update_node', output: { node: { canvasId: 'c1', type: 'text' } } }, 'p1');
    expect(link?.label).toBe('text');
  });

  it('links a connection to its canvas', () => {
    const link = canvasLinkOf({ toolName: 'connect_nodes', output: { connection: { canvasId: 'c2' } } }, 'p1');
    expect(link?.href).toBe('/p/p1/c/c2');
  });

  it('has nothing to link for reads or failures', () => {
    expect(canvasLinkOf({ toolName: 'list_nodes', output: { nodes: [] } }, 'p1')).toBeNull();
    expect(canvasLinkOf({ toolName: 'create_node' }, 'p1')).toBeNull();
  });
});

describe('failureOfStatus', () => {
  it('names exhausted credits apart from a generic failure', () => {
    expect(failureOfStatus(402)).toBe('credits');
    expect(failureOfStatus(500)).toBe('send');
  });
});

describe('speakerStarts', () => {
  it('marks where a new speaker takes the turn', () => {
    expect(speakerStarts([{ role: 'user' }, { role: 'assistant' }, { role: 'assistant' }, { role: 'user' }])).toEqual([
      true,
      true,
      false,
      true
    ]);
  });
});

describe('keyboardInset', () => {
  it('lifts the composer by the keyboard minus what the tab bar already reserves', () => {
    expect(keyboardInset({ innerHeight: 800, viewportHeight: 460, offsetTop: 0, reservedBelow: 90 })).toBe(250);
  });

  it('never goes negative without a keyboard', () => {
    expect(keyboardInset({ innerHeight: 800, viewportHeight: 800, offsetTop: 0, reservedBelow: 90 })).toBe(0);
  });
});
