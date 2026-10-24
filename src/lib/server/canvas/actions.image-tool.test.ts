import { describe, expect, it, vi } from 'vitest';

const { runGenNode } = vi.hoisted(() => ({ runGenNode: vi.fn(async () => ({ kind: 'queued', run: { id: 'run-1' } })) }));

vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiActionForForm: async () => null }));
vi.mock('$lib/server/canvas/generate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/canvas/generate')>()),
  runGenNode
}));
import { actions } from '../../../routes/p/[projectId]/c/[canvasId]/+page.server';
import { fakeDb } from '$lib/server/db/fake-db';
import { IMAGE_TOOL_MODEL, ImageTool } from '$lib/image-tools';

const imageNode = { id: 'src', canvas_id: 'canvas', project_id: 'project', type: 'image', display_name: null, x: 10, y: 20, z: 0, width: 300, height: 200, data: { refId: 'asset-1' }, version: 2 };

function event(fields: Record<string, string>, nodes: Record<string, unknown>[] = [imageNode]) {
  const fake = fakeDb(
    {
      orgs_members: [{ role: 'owner', orgs: { id: 'org', name: 'Org', slug: 'org' } }],
      canvases: [{ id: 'canvas', project_id: 'project', name: 'Canvas', viewport: null }],
      nodes,
      nodes_connections: []
    },
    { store: true }
  );
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.set(key, value);
  }
  return {
    ...fake,
    request: new Request('http://localhost/c/canvas', { method: 'POST', body }),
    params: { canvasId: 'canvas' },
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'user' } }), db: async () => fake.db }
  };
}

describe('imageTool action', () => {
  it('a background removal lands a wired node beside the image and runs it on the kie tool model', async () => {
    const input = event({ node_id: 'src', tool: ImageTool.RemoveBackground });

    const result = await actions.imageTool(input as never);

    expect(result).toMatchObject({ outcome: 'done' });
    const node = input.calls.find((c) => c.table === 'nodes' && c.op === 'insert');
    expect(node?.payload).toMatchObject({ type: 'image', data: { prompt: '', model: IMAGE_TOOL_MODEL[ImageTool.RemoveBackground], params: {} } });
    expect(input.calls.some((c) => c.table === 'nodes_connections' && c.op === 'insert')).toBe(true);
    expect(runGenNode).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ medium: 'image', model: IMAGE_TOOL_MODEL[ImageTool.RemoveBackground], orgId: 'org' }));
  });

  it('an unknown tool is refused before anything is written', async () => {
    const input = event({ node_id: 'src', tool: 'sharpen' });

    expect(await actions.imageTool(input as never)).toMatchObject({ status: 400 });
    expect(input.calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('a node that is not an image is refused before anything is written', async () => {
    const input = event({ node_id: 'src', tool: ImageTool.Upscale }, [{ ...imageNode, type: 'text' }]);

    expect(await actions.imageTool(input as never)).toMatchObject({ status: 400, data: { error: 'source_not_image' } });
    expect(input.calls.some((c) => c.op === 'insert')).toBe(false);
  });
});
