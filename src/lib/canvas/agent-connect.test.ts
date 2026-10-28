import { describe, expect, it } from 'vitest';
import { ConnectMode, REMOTE_MCP_URL, connectClients, connectMode } from './agent-connect';

const snippets = (mode: ConnectMode, origin: string) => connectClients(mode, origin).flatMap((c) => c.steps.map((s) => s.snippet ?? ''));

describe('connectMode', () => {
  it('local mode shows the local server, the cloud the remote one', () => {
    expect(connectMode(true)).toBe(ConnectMode.Local);
    expect(connectMode(false)).toBe(ConnectMode.Cloud);
  });
});

describe('connectClients', () => {
  it('cloud points every client at the remote MCP URL', () => {
    const clients = connectClients(ConnectMode.Cloud, 'https://oh.feega.app');
    expect(clients.map((c) => c.name)).toEqual(['Claude Code', 'Claude', 'Codex', 'Cursor']);
    expect(snippets(ConnectMode.Cloud, 'https://oh.feega.app')).toContain(`claude mcp add --transport http feega ${REMOTE_MCP_URL}`);
    expect(snippets(ConnectMode.Cloud, 'https://oh.feega.app').join()).not.toContain('npx');
  });

  it('local uses npx feega mcp on the port the app runs on', () => {
    const all = snippets(ConnectMode.Local, 'http://127.0.0.1:61234');
    expect(all).toContain('claude mcp add feega-local -- npx -y feega mcp --port 61234');
    expect(all.join()).not.toContain(REMOTE_MCP_URL);
    expect(JSON.parse(all[2]).mcpServers['feega-local']).toEqual({ command: 'npx', args: ['-y', 'feega', 'mcp', '--port', '61234'] });
    expect(all[1]).toBe('[mcp_servers.feega-local]\ncommand = "npx"\nargs = ["-y", "feega", "mcp", "--port", "61234"]');
  });

  it('an origin without a port falls back to 5173', () => {
    expect(snippets(ConnectMode.Local, 'http://localhost')[0]).toContain('--port 5173');
  });
});
