import { describe, it, expect } from 'vitest';
import { Family, buildCatalogue } from './edit-catalogue';
import { runEdit, type EditPorts } from './run-edit';
import type { Answer } from './runners';

const OK: Answer = { status: 200, body: { ok: true } };

const KEYS: Record<string, string[]> = { move_node: ['nodeId', 'x', 'y'], move_frame_element: ['frameId', 'elementId', 'x', 'y'], set_props: ['clip_id', 'props'], remove_clip: ['clip_ids'], add_shape: ['kind'] };

function ports(overrides: Partial<EditPorts> = {}) {
  const seen: { canvas: unknown[]; frame: unknown[]; editor: unknown[] } = { canvas: [], frame: [], editor: [] };
  const made: EditPorts = {
    catalogue: buildCatalogue({ [Family.Canvas]: ['move_node', 'move_frame_element', 'create_node'], [Family.Frame]: ['set_props', 'remove_clip', 'add_shape'], [Family.Editor]: ['save_doc'] }),
    inputKeys: async (op) => KEYS[op.source] ?? [],
    projectOf: async (nodeId) => (nodeId === 'n1' ? 'p1' : null),
    canvas: async (ask) => (seen.canvas.push(ask), OK),
    frame: async (ask) => (seen.frame.push(ask), { status: 200, body: { tool: ask.tool, version: 7, saved: true, output: ask.tool === 'batch' ? { results: (ask.input as { ops: unknown[] }).ops.map(() => ({ ok: true })) } : { ok: true } } }),
    editor: async (ask) => (seen.editor.push(ask), OK),
    ...overrides
  };
  return { made, seen };
}

describe('the edit tool routes by op name, the agent never picks an endpoint', () => {
  it('a canvas op reaches the canvas runner with the project found from its target', async () => {
    const { made, seen } = ports();

    const answer = await runEdit(made, { steps: [{ op: 'move_node', target: 'n1', input: { x: 1, y: 2 } }] });

    expect(answer.status).toBe(200);
    expect(seen.canvas).toEqual([{ projectId: 'p1', op: 'move_node', input: { x: 1, y: 2, nodeId: 'n1' } }]);
  });

  it('a frame op reaches the frame runner on the target frame, under its own tool name', async () => {
    const { made, seen } = ports();

    await runEdit(made, { steps: [{ op: 'add_shape', target: 'f1', input: { kind: 'rect' }, version: 3 }] });

    expect(seen.frame).toEqual([{ nodeId: 'f1', tool: 'add_shape', input: { kind: 'rect' }, version: 3 }]);
  });

  it('an element is put where the op names its element: frame and element for a canvas op, clip for a frame op', async () => {
    const { made, seen } = ports();

    await runEdit(made, { steps: [{ op: 'move_frame_element', target: 'f1', element: 'e1', input: { x: 5 } }], projectId: 'p1' });
    await runEdit(made, { steps: [{ op: 'set_props', target: 'f1', element: 'e1', input: { props: { opacity: 1 } } }] });
    await runEdit(made, { steps: [{ op: 'remove_clip', target: 'f1', element: 'e1' }] });

    expect(seen.canvas[0]).toMatchObject({ input: { frameId: 'f1', elementId: 'e1', x: 5 } });
    expect(seen.frame[0]).toMatchObject({ input: { clip_id: 'e1', props: { opacity: 1 } } });
    expect(seen.frame[1]).toMatchObject({ input: { clip_ids: ['e1'] } });
  });

  it('what the caller wrote in the input wins over the target', async () => {
    const { made, seen } = ports();

    await runEdit(made, { steps: [{ op: 'move_node', target: 'n1', input: { nodeId: 'other' } }] });

    expect(seen.canvas[0]).toMatchObject({ input: { nodeId: 'other' } });
  });

  it('refuses an unknown op with the list, a frame op without a target, a canvas op without a project', async () => {
    const { made } = ports();

    expect(await runEdit(made, { steps: [{ op: 'nope' }] })).toMatchObject({ status: 400, body: { error: 'unknown_op' } });
    expect(await runEdit(made, { steps: [{ op: 'add_shape' }] })).toMatchObject({ status: 400, body: { error: 'target_required' } });
    expect(await runEdit(made, { steps: [{ op: 'create_node', input: {} }] })).toMatchObject({ status: 400, body: { error: 'project_required' } });
  });
});

describe('a batch mixes canvas and frame ops', () => {
  it('runs steps in order, and folds consecutive ops on one frame into one all-or-none frame batch', async () => {
    const { made, seen } = ports();

    const answer = await runEdit(made, {
      projectId: 'p1',
      steps: [
        { op: 'add_shape', target: 'f1', input: { kind: 'rect' } },
        { op: 'set_props', target: 'f1', input: { clip_id: 'a', props: {} } },
        { op: 'move_node', target: 'n1', input: { x: 1, y: 1 } },
        { op: 'add_shape', target: 'f1', input: { kind: 'ellipse' } }
      ]
    });

    expect(answer.status).toBe(200);
    expect(seen.frame).toHaveLength(2);
    expect(seen.frame[0]).toMatchObject({ nodeId: 'f1', tool: 'batch', input: { ops: [{ tool: 'add_shape' }, { tool: 'set_props' }] } });
    expect(seen.frame[1]).toMatchObject({ tool: 'add_shape' });
    expect(seen.canvas).toHaveLength(1);
    expect(answer.body).toMatchObject({ applied: 4, results: [{ index: 0, op: 'add_shape' }, { index: 1 }, { index: 2, op: 'move_node' }, { index: 3 }] });
  });

  it('stops at the first failure and says how many steps were applied before it', async () => {
    const { made, seen } = ports({ canvas: async () => ({ status: 404, body: { error: 'node_not_found' } }) });

    const answer = await runEdit(made, {
      projectId: 'p1',
      steps: [
        { op: 'add_shape', target: 'f1', input: { kind: 'rect' } },
        { op: 'move_node', target: 'n9', input: { x: 1, y: 1 } },
        { op: 'add_shape', target: 'f1', input: { kind: 'ellipse' } }
      ]
    });

    expect(answer.status).toBe(404);
    expect(answer.body).toMatchObject({ applied: 1, failed: 1 });
    expect(seen.frame).toHaveLength(1);
  });

  it('a canvas op that answers 200 with an error body still stops the batch', async () => {
    const { made, seen } = ports({ canvas: async () => ({ status: 200, body: { error: 'node_not_found', message: 'No live node.' } }) });

    const answer = await runEdit(made, {
      projectId: 'p1',
      steps: [
        { op: 'move_node', target: 'n9', input: { x: 1, y: 1 } },
        { op: 'add_shape', target: 'f1', input: { kind: 'rect' } }
      ]
    });

    expect(answer.body).toMatchObject({ applied: 0, failed: 0 });
    expect(answer.status).toBe(422);
    expect(seen.frame).toHaveLength(0);
  });

  it('a canvas op that answers outcome invalid or conflict stops the batch too', async () => {
    for (const outcome of ['invalid', 'conflict']) {
      const { made } = ports({ canvas: async () => ({ status: 200, body: { outcome, message: 'no' } }) });

      const answer = await runEdit(made, { projectId: 'p1', steps: [{ op: 'create_node' }, { op: 'create_node' }] });

      expect(answer.body).toMatchObject({ applied: 0, failed: 0 });
    }
  });

  it('a refused frame group reports the op inside it that refused', async () => {
    const { made } = ports({ frame: async () => ({ status: 422, body: { error: 'tool_refused', index: 1, detail: 'no such clip' } }) });

    const answer = await runEdit(made, {
      steps: [
        { op: 'add_shape', target: 'f1' },
        { op: 'set_props', target: 'f1', input: { clip_id: 'x', props: {} } }
      ]
    });

    expect(answer.body).toMatchObject({ applied: 0, failed: 1 });
  });
});
