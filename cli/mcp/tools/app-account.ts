import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { appAccountApi } from '../../lib/app-account.ts';
import { withAuth } from '../util.ts';

const project = z.string().describe('The project id.');

export function registerAppAccountTools(server: McpServer) {
  server.registerTool(
    'get_app_account',
    {
      title: 'Show the test app account',
      description: "The TEST account of the user's own app that the project chat remembers to log in and photograph its screens: login url, email, session expiry. Never the password. Reads only, spends nothing.",
      inputSchema: z.object({ project_id: project }),
      annotations: { readOnlyHint: true }
    },
    async ({ project_id }) => withAuth((token) => appAccountApi.get(token, project_id))
  );

  server.registerTool(
    'forget_app_account',
    {
      title: 'Forget the test app account',
      description: 'Deletes the test account and the browser session the project remembers; the chat asks for a test account again. Spends nothing.',
      inputSchema: z.object({ project_id: project }),
      annotations: { readOnlyHint: false, destructiveHint: true }
    },
    async ({ project_id }) => withAuth((token) => appAccountApi.forget(token, project_id))
  );
}
