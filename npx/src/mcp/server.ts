import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { cloudTools, failureText, type CloudDeps, type Tool } from './tools';

export { BILLING_URL } from './tools';

const asText = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] });

const asFailure = (error: unknown) => ({ isError: true, content: [{ type: 'text' as const, text: failureText(error) }] });

export function mcpServer(deps: CloudDeps, version: string, local: Record<string, Tool>): McpServer {
  const server = new McpServer({ name: 'feega', version });

  for (const [name, tool] of Object.entries({ ...local, ...cloudTools(deps) })) {
    server.registerTool(name, { description: tool.description, inputSchema: tool.input }, async (input: unknown) => {
      try {
        return asText(await tool.run(input));
      } catch (error) {
        return asFailure(error);
      }
    });
  }

  return server;
}
