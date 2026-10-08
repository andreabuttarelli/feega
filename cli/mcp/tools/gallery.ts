import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { galleryApi } from '../../lib/gallery.ts';
import { withAuth } from '../util.ts';

const org = z.string().optional().describe('Which org, if you belong to more than one.');

export function registerGalleryTools(server: McpServer) {
  server.registerTool(
    'search_gallery',
    {
      title: 'Search the remix gallery',
      description:
        'Search the public gallery of free motion videos and compositions anyone can remix (many by Feega). Filters: `query` (title words), ' +
        '`kind` (motion, composition), `format` (16:9, 9:16, 1:1, 4:5), `duration` (short up to 6 s, medium 6 to 15 s, long over 15 s), `tag`. ' +
        'Returns id, title, author, format, seconds, remixes and url. Free, reads only.',
      inputSchema: z.object({
        query: z.string().max(80).optional(),
        kind: z.enum(['motion', 'composition']).optional(),
        format: z.enum(['16:9', '9:16', '1:1', '4:5', '1:1 1440']).optional(),
        duration: z.enum(['short', 'medium', 'long']).optional(),
        tag: z.string().max(24).optional()
      }),
      annotations: { readOnlyHint: true }
    },
    async (search) => withAuth((token) => galleryApi.search(token, search))
  );

  server.registerTool(
    'remix_gallery_item',
    {
      title: 'Remix a gallery item',
      description:
        'Remix a gallery item, free: copies its video and files into a new `motion` node of `project_id` (on `canvas_id`, or on the Motion canvas), ' +
        'with its main texts, colours, logo and media exposed as fields. Returns `node_id` and `editor_url`. ' +
        'Then offer to put the user brand on it with `ask_motion_agent`.',
      inputSchema: z.object({ org, item_id: z.string(), project_id: z.string(), canvas_id: z.string().optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, item_id, project_id, canvas_id }) => withAuth((token) => galleryApi.remix(token, item_id, { project_id, ...(canvas_id ? { canvas_id } : {}) }, org))
  );

  server.registerTool(
    'publish_to_gallery',
    {
      title: 'Publish a video to the gallery',
      description:
        'Publish a `motion` node to the public gallery, free, so anyone can remix it. Only when the user asks. Refused for uncensored projects, ' +
        'real brands (their logo, a script about a real brand, logos or pictures imported from a website) and content the moderation refuses. ' +
        '`title` up to 80 characters, `description` up to 500, up to 8 one-word `tags`. Returns the gallery `id` and `url`.',
      inputSchema: z.object({ org, node_id: z.string(), title: z.string(), description: z.string().optional(), tags: z.array(z.string()).optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, ...body }) => withAuth((token) => galleryApi.publish(token, body, org))
  );
}
