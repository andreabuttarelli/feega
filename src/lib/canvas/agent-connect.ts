export const REMOTE_MCP_URL = 'https://mcp.feega.app/mcp';

const LOCAL_SERVER_NAME = 'feega-local';
const DEFAULT_LOCAL_PORT = '5173';

export enum ConnectMode {
  Cloud = 'cloud',
  Local = 'local'
}

export type ConnectStep = { text: string; snippet?: string };
export type ConnectClient = { id: string; name: string; steps: ConnectStep[] };

export const connectMode = (local: boolean) => (local ? ConnectMode.Local : ConnectMode.Cloud);

const json = (value: unknown) => JSON.stringify(value, null, 2);

function cloudClients(): ConnectClient[] {
  return [
    {
      id: 'claude-code',
      name: 'Claude Code',
      steps: [
        { text: 'Run in a terminal:', snippet: `claude mcp add --transport http feega ${REMOTE_MCP_URL}` },
        { text: 'Then run /mcp in Claude Code and sign in to feega.' }
      ]
    },
    {
      id: 'claude',
      name: 'Claude',
      steps: [
        { text: 'On claude.ai or Claude Desktop: Customize → Connectors → + Add → custom connector.' },
        { text: 'Name it feega and paste this URL, then sign in:', snippet: REMOTE_MCP_URL }
      ]
    },
    {
      id: 'codex',
      name: 'Codex',
      steps: [
        { text: 'Add to ~/.codex/config.toml:', snippet: `[mcp_servers.feega]\nurl = "${REMOTE_MCP_URL}"` },
        { text: 'Then sign in:', snippet: 'codex mcp login feega' }
      ]
    },
    {
      id: 'cursor',
      name: 'Cursor',
      steps: [{ text: 'Add to ~/.cursor/mcp.json, then sign in from Cursor’s MCP settings:', snippet: json({ mcpServers: { feega: { url: REMOTE_MCP_URL } } }) }]
    }
  ];
}

function localClients(port: string): ConnectClient[] {
  const args = ['-y', 'feega', 'mcp', '--port', port];
  const stdio = json({ mcpServers: { [LOCAL_SERVER_NAME]: { command: 'npx', args } } });
  return [
    { id: 'claude-code', name: 'Claude Code', steps: [{ text: 'Run in a terminal:', snippet: `claude mcp add ${LOCAL_SERVER_NAME} -- npx ${args.join(' ')}` }] },
    {
      id: 'codex',
      name: 'Codex',
      steps: [{ text: 'Add to ~/.codex/config.toml:', snippet: `[mcp_servers.${LOCAL_SERVER_NAME}]\ncommand = "npx"\nargs = [${args.map((a) => `"${a}"`).join(', ')}]` }]
    },
    { id: 'cursor', name: 'Cursor', steps: [{ text: 'Add to ~/.cursor/mcp.json:', snippet: stdio }] },
    { id: 'claude-desktop', name: 'Claude Desktop', steps: [{ text: 'Add to claude_desktop_config.json (Settings → Developer → Edit Config), then restart:', snippet: stdio }] }
  ];
}

export function connectClients(mode: ConnectMode, origin: string): ConnectClient[] {
  if (mode === ConnectMode.Cloud) {
    return cloudClients();
  }

  return localClients(new URL(origin).port || DEFAULT_LOCAL_PORT);
}
