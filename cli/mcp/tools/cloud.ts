import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { cloudApi, figmaTokenApi, type CloudProviderId } from '../../lib/cloud.ts';
import { fail, withAuth } from '../util.ts';

const project = z.string().describe('The project id.');
const providers = ['google_drive', 'dropbox'] as const;

const ask = z.object({
  project_id: project,
  action: z.enum(['status', 'files', 'import', 'export', 'disconnect']),
  provider: z.enum(providers).optional(),
  folder: z.string().optional(),
  cursor: z.string().optional(),
  file_id: z.string().optional(),
  canvas_id: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  asset_id: z.string().optional(),
  name: z.string().optional()
});

type Ask = z.infer<typeof ask>;

const need = (field: string) => fail(`${field} is required for this action.`);

function run(token: string, a: Ask & { provider: CloudProviderId }) {
  switch (a.action) {
    case 'files':
      return cloudApi.files(token, a.project_id, a.provider, { folder: a.folder, cursor: a.cursor });
    case 'import':
      return cloudApi.importFile(token, a.project_id, a.provider, { fileId: a.file_id!, place: a.canvas_id ? { canvasId: a.canvas_id, x: a.x ?? 0, y: a.y ?? 0 } : undefined });
    case 'export':
      return cloudApi.exportAsset(token, a.project_id, a.provider, { assetId: a.asset_id!, folder: a.folder ?? '', name: a.name });
    default:
      return cloudApi.disconnect(token, a.project_id, a.provider);
  }
}

export function registerCloudTools(server: McpServer) {
  server.registerTool(
    'cloud',
    {
      title: 'Google Drive and Dropbox files',
      description:
        'Cloud files of a project, for the signed-in person. `action` status: which providers (google_drive, dropbox) are connected and set up. files: list a folder of `provider` (`folder`, `cursor` from the previous `next` for more). import: `file_id` into the project, placed on `canvas_id` at `x`,`y`. export: `asset_id` into `folder` of the provider, `name` optional (Drive: empty folder is the root). disconnect: forget the connection and revoke it at the provider. ' +
        'Connecting is a browser sign-in in the app; a provider that is not connected answers `not_connected` or `reconnect`. Google Docs, Sheets and Slides import as PDF, Drawings as PNG. Spends no credits.',
      inputSchema: ask,
      annotations: { readOnlyHint: false, destructiveHint: true }
    },
    async (a) => {
      if (a.action === 'status') {
        return withAuth((token) => cloudApi.providers(token, a.project_id));
      }
      if (!a.provider) {
        return need('provider');
      }
      if (a.action === 'import' && !a.file_id) {
        return need('file_id');
      }
      if (a.action === 'export' && !a.asset_id) {
        return need('asset_id');
      }
      return withAuth((token) => run(token, { ...a, provider: a.provider! }));
    }
  );

  server.registerTool(
    'figma_token_status',
    {
      title: 'Is a Figma token saved',
      description: 'Whether the signed-in person saved a Figma personal access token, which lets a Figma paste bring its images. Never returns the token; it is set in the app only. Reads only, spends nothing.',
      inputSchema: z.object({ project_id: project }),
      annotations: { readOnlyHint: true }
    },
    async ({ project_id }) => withAuth((token) => figmaTokenApi.status(token, project_id))
  );
}
