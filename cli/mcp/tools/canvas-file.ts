import { z } from 'zod';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { canvasApi } from '../../lib/canvas.ts';
import { fail, withAuth } from '../util.ts';
import { getRequestAuth } from '../context.ts';

const HOSTED = 'canvas_file reads and writes your disk, so it runs only in the local feega MCP (feega-mcp). Here use edit export_canvas_file, which answers a download url.';

export enum CanvasFileAction {
  Save = 'save',
  Import = 'import'
}

const isDirectory = (path: string) => stat(path).then((s) => s.isDirectory(), () => false);

export async function savedPath(path: string, name: string): Promise<string> {
  const absolute = resolve(path);
  return (await isDirectory(absolute)) ? join(absolute, name) : absolute;
}

export function registerCanvasFileTools(server: McpServer) {
  server.registerTool(
    'canvas_file',
    {
      title: 'Save a canvas to a .feega file, or import one',
      description:
        'A canvas as a local .feega file, to carry work from a local feega to feega.app. save {project_id, canvas_id, path}: writes it (path = file or folder). import {project_id, path}: opens it as a new canvas. Free.',
      inputSchema: z.object({
        org: z.string().optional(),
        action: z.enum([CanvasFileAction.Save, CanvasFileAction.Import]),
        project_id: z.string(),
        canvas_id: z.string().optional().describe('The canvas to save; required for save.'),
        path: z.string().describe('Where to write the file (save) or the file to read (import).')
      }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, action, project_id, canvas_id, path }) =>
      getRequestAuth() ? fail(HOSTED) : withAuth(async (token) => {
        if (action === CanvasFileAction.Import) {
          return canvasApi.importFile(token, { project: project_id, bytes: new Uint8Array(await readFile(resolve(path))) }, org);
        }
        if (!canvas_id) {
          throw new Error('canvas_id is required to save a canvas.');
        }
        const file = await canvasApi.saveFile(token, { project: project_id, canvasId: canvas_id }, org);
        const out = await savedPath(path, file.name);
        await writeFile(out, file.bytes);
        return { path: out, bytes: file.bytes.byteLength };
      })
  );
}
