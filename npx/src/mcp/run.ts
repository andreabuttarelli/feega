import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileAccountStore } from '../../../inspect/src/host/account';
import { cloudApi } from '../../../inspect/src/host/cloud-api';
import type { ShareHost } from '../../../inspect/src/host/share-port';
import { bearerOf } from './auth';
import { childEditors } from './editors';
import { editorRegistry } from '../../../inspect/src/host/local-bridge/editors';
import { localTools } from './local-tools';
import { mcpServer } from './server';
import { mcpUsage } from './usage';

const WEB_URL_VAR = 'FEEGA_WEB_URL';

export type McpRun = { cli: string; version: string; cwd: string; env: NodeJS.ProcessEnv; share: ShareHost };

export async function serveMcp({ cli, version, cwd, env, share }: McpRun): Promise<void> {
  const store = fileAccountStore();
  const api = cloudApi({ base: env[WEB_URL_VAR], token: () => bearerOf({ env, store }) });
  const local = localTools({ registry: editorRegistry(), send: fetch, cwd });
  const usage = mcpUsage({ cwd, env, version });
  const server = mcpServer({ api, share, editors: childEditors(cli), cwd }, version, local, usage.called);
  process.stdin.once('close', () => void usage.end());

  await server.connect(new StdioServerTransport());
}
