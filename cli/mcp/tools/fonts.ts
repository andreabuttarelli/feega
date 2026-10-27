import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fontsApi } from '../../lib/fonts.ts';
import { withAuth } from '../util.ts';

export function registerFontTools(server: McpServer) {
  server.registerTool(
    'org_fonts',
    {
      title: 'List, upload or delete the fonts of an org',
      description:
        'The fonts uploaded once per org and usable in every frame, code frame and export. Without `upload` or `delete` it lists them: family, weight, italic, signed url. ' +
        '`upload` is a local path to a TTF, OTF, WOFF or WOFF2 file (10MB max): the family is read from the file. `delete` removes a whole family; frames using it fall back to a system font. Only when the user asks. Free.',
      inputSchema: z.object({
        org: z.string().optional(),
        upload: z.string().optional(),
        delete: z.string().optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: true }
    },
    async ({ org, upload, delete: family }) =>
      withAuth((token) => {
        if (upload) {
          return fontsApi.upload(token, upload, org);
        }
        if (family) {
          return fontsApi.remove(token, family, org);
        }
        return fontsApi.list(token, org);
      })
  );
}
