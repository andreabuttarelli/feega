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
    'set_app_account',
    {
      title: 'Set the test app account',
      description: "Saves a TEST account of the user's own app (login url, email, password) that the project chat and code import sign in with. The AI sees it, so only a test login, never a real account. Replaces the saved one and its session; an empty password keeps the saved password. Spends nothing.",
      inputSchema: z.object({ project_id: project, login_url: z.string().url().describe('Login page of the app.'), email: z.string().describe('Test account email.'), password: z.string().describe('Test account password; empty keeps the saved one.') }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ project_id, login_url, email, password }) => withAuth((token) => appAccountApi.set(token, project_id, { login_url, email, password }))
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
