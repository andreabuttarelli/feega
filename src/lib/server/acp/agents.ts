import { dirname, join, resolve } from 'node:path';
import { AcpAgent, isAcpAgent } from '$lib/acp/agent-choices';
import type { AgentCommand, McpServer } from './client';

export { AcpAgent, isAcpAgent };

export const ACP_AGENTS: Readonly<Record<AcpAgent, AgentCommand>> = {
  [AcpAgent.Claude]: { command: 'npx', args: ['-y', '@agentclientprotocol/claude-agent-acp'] },
  [AcpAgent.Codex]: { command: 'npx', args: ['-y', '@agentclientprotocol/codex-acp'] },
  [AcpAgent.Gemini]: { command: 'gemini', args: ['--experimental-acp'] }
};

const FEEGA_MCP_ENTRY = 'cli/mcp/stdio.ts';

const npxBesideNode = () => join(dirname(process.execPath), 'npx');

export const feegaMcp = (checkout: string, appUrl: string): McpServer => ({
  name: 'feega',
  command: npxBesideNode(),
  args: ['-y', 'bun', 'run', resolve(checkout, FEEGA_MCP_ENTRY)],
  env: [{ name: 'PUBLIC_APP_URL', value: appUrl }]
});
