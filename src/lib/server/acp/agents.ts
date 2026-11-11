import { resolve } from 'node:path';
import type { AgentCommand, McpServer } from './client';

export enum AcpAgent {
  Claude = 'claude',
  Codex = 'codex',
  Gemini = 'gemini'
}

export type AcpAgentEntry = AgentCommand & { label: string };

export const ACP_AGENTS: Readonly<Record<AcpAgent, AcpAgentEntry>> = {
  [AcpAgent.Claude]: { label: 'Claude Code', command: 'npx', args: ['-y', '@zed-industries/claude-code-acp'] },
  [AcpAgent.Codex]: { label: 'Codex', command: 'npx', args: ['-y', '@zed-industries/codex-acp'] },
  [AcpAgent.Gemini]: { label: 'Gemini CLI', command: 'gemini', args: ['--experimental-acp'] }
};

export const isAcpAgent = (key: unknown): key is AcpAgent => Object.values(AcpAgent).includes(key as AcpAgent);

const FEEGA_MCP_ENTRY = 'cli/mcp/stdio.ts';

export const feegaMcp = (checkout: string, appUrl: string): McpServer => ({
  name: 'feega',
  command: 'npx',
  args: ['-y', 'bun', 'run', resolve(checkout, FEEGA_MCP_ENTRY)],
  env: [{ name: 'PUBLIC_APP_URL', value: appUrl }]
});
