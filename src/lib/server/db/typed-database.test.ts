import { describe, expect, it } from 'vitest';
import type { NarrowedDatabase } from './typed-database';

type NodeInsert = NarrowedDatabase['public']['Tables']['nodes']['Insert'];
type CanvasesInsert = NarrowedDatabase['public']['Tables']['canvases']['Insert'];

describe('NarrowedDatabase rejects a wrong jsonb shape at compile time', () => {
  it('a node of type "image" requires the image schema, not the text schema', () => {
    const valid: NodeInsert = {
      org_id: 'org_1',
      canvas_id: 'canvas_1',
      project_id: 'project_1',
      type: 'image',
      x: 0,
      y: 0,
      data: { prompt: 'a red bicycle' }
    };

    const mismatched: NodeInsert = {
      org_id: 'org_1',
      canvas_id: 'canvas_1',
      project_id: 'project_1',
      type: 'image',
      x: 0,
      y: 0,
      // @ts-expect-error data.content belongs to the doc schema, not to image
      data: { content: 'a red bicycle' }
    };

    expect(valid.type).toBe('image');
    expect(mismatched.type).toBe('image');
  });

  it('a node of type "image" cannot be missing the required prompt', () => {
    // @ts-expect-error prompt is required by the image schema
    const missingPrompt: NodeInsert = {
      org_id: 'org_1',
      canvas_id: 'canvas_1',
      project_id: 'project_1',
      type: 'image',
      x: 0,
      y: 0,
      data: {}
    };

    expect(missingPrompt.type).toBe('image');
  });

  it('canvases.viewport requires x, y and zoom as numbers', () => {
    const wrongViewport: CanvasesInsert = {
      org_id: 'org_1',
      project_id: 'project_1',
      name: 'canvas',
      // @ts-expect-error zoom is required and must be a number
      viewport: { x: 0, y: 0 }
    };

    expect(wrongViewport.name).toBe('canvas');
  });
});
