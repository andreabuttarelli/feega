import { describe, expect, it } from 'vitest';
import { TOOL_STATUS, canvasLinkOf, failureOfStatus, keyboardInset, speakerStarts, toolStatusOf, viewedPicturesOf } from './chat-view';

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

describe('pictures the agent looked at', () => {
  const call = (images: unknown[]) => ({ toolName: 'view_images', status: 'done' as const, output: { ok: true, images } });

  it('links each stored picture through the canvas, never the source url', () => {
    const out = viewedPicturesOf(call([{ url: 'https://a.example/x.png', path: 'org-1/p1/web-views/v1/0.jpg' }, { url: 'https://a.example/y.png', error: 'refused' }]), 'p1', 'c1');

    expect(out).toEqual([{ href: '/p/p1/c/c1/web-views/v1/0.jpg', source: 'https://a.example/x.png' }]);
  });

  it('shows the cover and frames of a video the agent watched', () => {
    const watched = { toolName: 'view_video_frames', status: 'done' as const, output: { ok: true, images: [{ url: 'https://v.example/c.jpg', path: 'o/p1/web-views/f1/cover.jpg' }, { url: 'https://v.example/v.mp4', path: 'o/p1/web-views/f1/50.jpg' }] } };

    expect(viewedPicturesOf(watched, 'p1', 'c1').map((p) => p.href)).toEqual(['/p/p1/c/c1/web-views/f1/cover.jpg', '/p/p1/c/c1/web-views/f1/50.jpg']);
  });

  it('shows nothing without a canvas or for other tools', () => {
    expect(viewedPicturesOf(call([{ url: 'u', path: 'o/p/web-views/v/0.jpg' }]), 'p1', '')).toEqual([]);
    expect(viewedPicturesOf({ toolName: 'read_page', output: { images: [{ path: 'o/p/web-views/v/0.jpg' }] } }, 'p1', 'c1')).toEqual([]);
  });
});
