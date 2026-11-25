import { join } from 'node:path';
import type { McpServerSpec } from './agent-session';

export const MCP_BUNDLE = 'mcp.cjs';
export const PROJECT_VAR = 'FEEGA_PROJECT';

export const editorMcp = (launcher: string, root: string): McpServerSpec => ({
  name: 'feega',
  command: process.execPath,
  args: [join(launcher, MCP_BUNDLE)],
  env: { ELECTRON_RUN_AS_NODE: '1', [PROJECT_VAR]: root }
});
