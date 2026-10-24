import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CORE_TOOLS, TOOL_FAMILY, type LoadedSet, type RemoteTool } from './surface.ts';
import { fail, type ToolResult } from './util.ts';

export type ListedTool = { name: string; description?: string; inputSchema?: Record<string, unknown>; [key: string]: unknown };

type Handler = (args: unknown, extra: unknown) => Promise<ToolResult>;

type Registered = { schema: z.ZodType | undefined; handler: Handler };

const REMOTE_INPUT = z.object({}).passthrough();

const SUMMARY_MAX = 110;

type Schema = Record<string, unknown>;

export function firstSentence(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? '';
  return sentence.length <= SUMMARY_MAX ? sentence : `${sentence.slice(0, SUMMARY_MAX - 1)}…`;
}

function compactProperty(property: Schema): Schema {
  if (Array.isArray(property.enum)) {
    return { enum: property.enum };
  }
  if (Array.isArray(property.anyOf)) {
    const types = [...new Set((property.anyOf as Schema[]).map((p) => p.type).filter(Boolean))];
    return types.length === 1 ? { type: types[0] } : {};
  }
  return property.type ? { type: property.type } : {};
}

export function compactSchema(schema: Schema): Schema {
  const properties = (schema.properties ?? {}) as Record<string, Schema>;
  const compact = Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, compactProperty(value)]));
  const required = schema.required as string[] | undefined;
  return { type: 'object', properties: compact, ...(required?.length ? { required } : {}) };
}

export enum Listing {
  Session = 'session',
  Full = 'full'
}

export class ToolSurface {
  private readonly registry = new Map<string, Registered>();
  private readonly remoteHandles = new Map<string, RegisteredTool>();
  private listAll: () => Promise<ListedTool[]> = async () => [];

  constructor(
    private readonly server: McpServer,
    readonly loaded: LoadedSet
  ) {}

  remember(name: string, schema: z.ZodType | undefined, handler: Handler): void {
    this.registry.set(name, { schema, handler });
  }

  useFullListing(list: () => Promise<ListedTool[]>): void {
    this.listAll = list;
  }

  async listing(kind: Listing): Promise<ListedTool[]> {
    const all = await this.listAll();
    if (kind === Listing.Full) {
      return all;
    }
    return all.filter((tool) => this.visible(tool.name)).map((tool) => this.shown(tool));
  }

  private visible(name: string): boolean {
    return name in CORE_TOOLS || this.loaded.has(name);
  }

  private shown(tool: ListedTool): ListedTool {
    const remote = this.loaded.remote.get(tool.name);
    const description = CORE_TOOLS[tool.name] ?? firstSentence(remote?.description ?? tool.description ?? '');
    const { title: _title, annotations, ...rest } = tool;
    const hints = Object.fromEntries(Object.entries((annotations ?? {}) as Schema).filter(([, on]) => on === true));
    const shownHints = Object.keys(hints).length ? { annotations: hints } : {};
    return { ...rest, ...shownHints, description, inputSchema: compactSchema(remote?.inputSchema ?? tool.inputSchema ?? {}) };
  }

  isLocal(name: string): boolean {
    return this.registry.has(name) && !this.loaded.remote.has(name);
  }

  localNames(): string[] {
    return [...this.registry.keys()].filter((name) => name in TOOL_FAMILY);
  }

  async schemaOf(name: string): Promise<ListedTool | undefined> {
    return (await this.listAll()).find((tool) => tool.name === name);
  }

  async run(name: string, input: unknown): Promise<ToolResult> {
    const found = this.registry.get(name);
    if (!found) {
      return fail(`Unknown tool ${name}. Use find_tools.`);
    }
    const parsed = found.schema ? found.schema.safeParse(input ?? {}) : { success: true as const, data: input };
    if (!parsed.success) {
      const listed = await this.schemaOf(name);
      return fail(`Invalid input for ${name}: ${z.prettifyError(parsed.error)}\nSchema: ${JSON.stringify(listed?.inputSchema ?? {})}`);
    }
    return found.handler(parsed.data, {});
  }

  addRemote(tool: RemoteTool, run: (input: Record<string, unknown>) => Promise<ToolResult>): void {
    this.loaded.remote.set(tool.name, tool);
    if (this.remoteHandles.has(tool.name)) {
      return;
    }
    const handle = this.server.registerTool(tool.name, { description: tool.description, inputSchema: REMOTE_INPUT }, (input: Record<string, unknown>) => run(input));
    this.remoteHandles.set(tool.name, handle);
  }

  removeRemote(names: readonly string[]): void {
    for (const name of names) {
      this.remoteHandles.get(name)?.remove();
      this.remoteHandles.delete(name);
      this.registry.delete(name);
    }
  }

  changed(): void {
    if (!this.server.isConnected()) {
      return;
    }
    this.server.sendToolListChanged();
  }
}
