import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { describeOps } from './ops-description';

const registry = {
  draw_frame: { access: 'write', input: z.object({ canvasId: z.string(), w: z.number().positive() }).strict().refine((i) => i.w > 0) },
  list_nodes: { access: 'read', input: z.object({ canvasId: z.string() }).strict() }
};
const summaries = { draw_frame: 'Draw an empty frame.', list_nodes: 'List the nodes of a canvas.' };

describe('describeOps answers an agent in one call', () => {
  it('with no op: every op with its access and one line', () => {
    expect(describeOps(registry, summaries, undefined)).toEqual({
      ops: [
        { name: 'draw_frame', access: 'write', summary: 'Draw an empty frame.' },
        { name: 'list_nodes', access: 'read', summary: 'List the nodes of a canvas.' }
      ]
    });
  });

  it('with an op: its strict JSON schema', () => {
    const out = describeOps(registry, summaries, 'draw_frame') as { op: string; input_schema: { required: string[]; additionalProperties: boolean } };

    expect(out.op).toBe('draw_frame');
    expect(out.input_schema.required).toEqual(['canvasId', 'w']);
    expect(out.input_schema.additionalProperties).toBe(false);
  });

  it('an unknown op names the fix', () => {
    expect(describeOps(registry, summaries, 'nope')).toMatchObject({ error: 'unknown_op', fix: expect.stringContaining('describe'), ops: ['draw_frame', 'list_nodes'] });
  });
});
