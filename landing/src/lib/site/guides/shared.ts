import { DOCS_URL } from '../links';

export const MCP_URL = 'https://mcp.feega.app/mcp';

export const CONNECT_COMMAND = `claude mcp add --transport http feega ${MCP_URL}`;

export const MCP_TOOLS = ['query', 'view', 'edit', 'describe', 'render_video', 'get_render', 'find_tools', 'load_tools', 'list_orgs'] as const;

export const docsLink = (path: string, label: string) => ({ href: `${DOCS_URL}${path}`, label });

export const code = (text: string) => `<pre><code>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre>`;
