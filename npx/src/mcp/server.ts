import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { cloudTools, failureText, Picture, type CloudDeps, type Tool } from './tools';

export { BILLING_URL } from './tools';

const asContent = (value: unknown) =>
  value instanceof Picture ? { content: [{ type: 'image' as const, data: value.png, mimeType: 'image/png' }] } : { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };

const asFailure = (error: unknown) => ({ isError: true, content: [{ type: 'text' as const, text: failureText(error) }] });

export function toolServer(version: string, tools: Record<string, Tool>, onCall: (name: string) => void = () => undefined): McpServer {
  const server = new McpServer({ name: 'feega', version });

  for (const [name, tool] of Object.entries(tools)) {
    server.registerTool(name, { description: tool.description, inputSchema: tool.input }, async (input: unknown) => {
      onCall(name);
      try {
        return asContent(await tool.run(input));
      } catch (error) {
        return asFailure(error);
      }
    });
  }

  return server;
}

export const mcpServer = (deps: CloudDeps, version: string, local: Record<string, Tool>, onCall?: (name: string) => void): McpServer => toolServer(version, { ...local, ...cloudTools(deps) }, onCall);
