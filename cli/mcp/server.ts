import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import { asTool } from '../lib/api.ts';
import { getRequestAuth } from './context.ts';
import { mcpLog } from './observability.ts';
import { registerOrgDataTools } from './tools/org-data.ts';
import { registerNodeTools } from './tools/nodes.ts';
import { registerCanvasTools } from './tools/canvas.ts';
import { registerCanvasFileTools } from './tools/canvas-file.ts';
import { registerPromptTools } from './tools/prompts.ts';
import { registerMotionTools } from './tools/motion.ts';
import { registerGalleryTools } from './tools/gallery.ts';
import { registerLayoutTools } from './tools/layouts.ts';
import { registerModelAllowlistTools } from './tools/model-allowlist.ts';
import { registerSpendCapsTools } from './tools/spend-caps.ts';
import { registerCloudTools } from './tools/cloud.ts';
import { registerAppAccountTools } from './tools/app-account.ts';
import { registerOrgTools } from './tools/orgs.ts';
import { registerEditTools } from './tools/edit.ts';
import { registerLoadingTools } from './tools/loading.ts';
import { STDIO_SESSION, sessionLoaded } from './surface.ts';
import { Listing, ToolSurface, type ListedTool } from './tool-surface.ts';
import { fail, type ToolResult } from './util.ts';

const MCP_INSTRUCTION_LINES = [
  'feega: an infinite canvas of typed nodes; frames are motion videos and stills.',
  'A video is a frame: `edit` op draw_frame, then frame ops inside it; check it with `view` snapshot; `render_video` exports it.',
  'Reads cost nothing: `query` (tables, name `columns`, `offset` pages) and `view` (canvas). Change with `edit`. `describe` {op} gives one exact schema; never call it bare to browse: `find_tools` searches.',
  'Everything else: `find_tools`, then `load_tools` to list it, or call it through `edit` {op: "<tool>", input}.',
  'A project needs no brand; never guess one. Signing in is no tool: HTTP hosts send the Bearer; locally `feega login`.'
];

export const MCP_INSTRUCTIONS = MCP_INSTRUCTION_LINES.join(' ');

function withoutKeysNoClientReads(tools: ListedTool[]): ListedTool[] {
  return tools.map(({ inputSchema, ...tool }) => {
    const { $schema: _dialect, ...schema } = inputSchema ?? {};
    return { ...tool, execution: undefined, inputSchema: schema };
  });
}

type ToolHandler = (...args: unknown[]) => unknown;

type CallRequest = { params: { name: string } };

async function withSchemaOnError(surface: ToolSurface, request: CallRequest, result: ToolResult): Promise<ToolResult> {
  const text = result.isError ? result.content.find((c) => c.type === 'text')?.text : undefined;
  if (!text) {
    return result;
  }
  if (text.includes('Input validation error')) {
    const listed = await surface.schemaOf(request.params.name);
    return fail(`${text}\nSchema: ${JSON.stringify(listed?.inputSchema ?? {})}`);
  }
  if (/Tool .* not found$/.test(text)) {
    return fail(`${text}. Use find_tools, or edit {op: "<name>", input}.`);
  }
  return result;
}

function shapeListedTools(server: McpServer, surface: ToolSurface): void {
  const inner = server.server;
  const install = inner.setRequestHandler.bind(inner);

  inner.setRequestHandler = ((schema: unknown, handler: (...args: unknown[]) => Promise<unknown>) => {
    if (schema === ListToolsRequestSchema) {
      surface.useFullListing(async () => withoutKeysNoClientReads(((await handler({ method: 'tools/list', params: {} }, {})) as { tools: ListedTool[] }).tools));
      return install(schema as never, (async () => ({ tools: await surface.listing(Listing.Session) })) as never);
    }
    if (schema === CallToolRequestSchema) {
      return install(schema as never, (async (request: CallRequest, extra: unknown) => withSchemaOnError(surface, request, (await handler(request, extra)) as ToolResult)) as never);
    }
    return install(schema as never, handler as never);
  }) as typeof inner.setRequestHandler;
}

function brandSlugOf(args: unknown[]): string | undefined {
  const input = args[0] as { slug?: unknown } | undefined;
  return typeof input?.slug === 'string' ? input.slug : undefined;
}

function recordToolCalls(server: McpServer, surface: ToolSurface): void {
  const register = server.registerTool.bind(server);

  server.registerTool = ((name: string, config: { inputSchema?: z.ZodType }, handler: ToolHandler) => {
    const recorded = async (...args: unknown[]) => {
      const started = Date.now();
      const common = {
        event: 'tool.call',
        toolName: name,
        brandSlug: brandSlugOf(args),
        userId: getRequestAuth()?.user.id,
      } as const;

      try {
        const result = (await asTool(name, () => handler(...args))) as { isError?: boolean };
        const failed = result?.isError === true;

        mcpLog({
          ...common,
          level: failed ? 'warn' : 'info',
          message: failed ? `${name} returned an error` : name,
          durationMs: Date.now() - started,
        });

        return result;
      } catch (e) {
        mcpLog({
          ...common,
          level: 'error',
          message: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - started,
          error: e,
        });
        throw e;
      }
    };
    surface.remember(name, config.inputSchema, recorded as never);
    return register(name as never, config as never, recorded as never);
  }) as typeof server.registerTool;
}

function build(session: string): { server: McpServer; surface: ToolSurface } {
  const server = new McpServer(
    {
      name: 'feega',
      version: '0.1.0',
      description:
        'feega infinite canvas — query and write projects, canvases, nodes, motion videos via OAuth.',
    },
    { instructions: MCP_INSTRUCTIONS },
  );

  const surface = new ToolSurface(server, sessionLoaded(session));
  shapeListedTools(server, surface);
  recordToolCalls(server, surface);

  registerOrgDataTools(server);
  registerModelAllowlistTools(server);
  registerSpendCapsTools(server);
  registerNodeTools(server);
  registerCanvasTools(server);
  registerCanvasFileTools(server);
  registerPromptTools(server);
  registerMotionTools(server);
  registerGalleryTools(server);
  registerLayoutTools(server);
  registerAppAccountTools(server);
  registerCloudTools(server);
  registerOrgTools(server);
  registerEditTools(server, surface);
  registerLoadingTools(server, surface);

  return { server, surface };
}

export function createFeegaMcpServer(session: string = STDIO_SESSION): McpServer {
  return build(session).server;
}

const CATALOGUE_SESSION = 'catalogue';

export async function listAllTools(): Promise<ListedTool[]> {
  const { server, surface } = build(CATALOGUE_SESSION);
  const all = await surface.listing(Listing.Full);
  await server.close();
  return all;
}
