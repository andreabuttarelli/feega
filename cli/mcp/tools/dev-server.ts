import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DevAction, devServerApi } from '../../lib/dev-server.ts';
import { withAuth } from '../util.ts';

export function registerDevServerTools(server: McpServer) {
  server.registerTool(
    'dev_server',
    {
      title: 'Status, start or stop the local dev server behind live frames',
      description:
        'Local Feega only. Live frames show routes of the dev server of the opened folder. `status` (default) says whether one runs, its url, whether it was found already running or started by Feega, and recent logs. ' +
        '`start` reuses one already running, else runs the project dev script and restarts it if it crashes. `stop` stops the one Feega started. Free.',
      inputSchema: z.object({ action: z.enum(DevAction).optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ action }) => withAuth((token) => devServerApi(token, action ?? DevAction.Status))
  );
}
