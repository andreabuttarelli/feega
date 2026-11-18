import { dirname, join, resolve } from 'node:path';
import type { McpServer } from './client';

const FEEGA_MCP_ENTRY = 'cli/mcp/stdio.ts';

const npxBesideNode = () => join(dirname(process.execPath), 'npx');

export const feegaMcp = (checkout: string, appUrl: string): McpServer => ({
  name: 'feega',
  command: npxBesideNode(),
  args: ['-y', 'bun', 'run', resolve(checkout, FEEGA_MCP_ENTRY)],
  env: [{ name: 'PUBLIC_APP_URL', value: appUrl }]
});
