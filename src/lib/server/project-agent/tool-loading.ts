import { asSchema, jsonSchema, tool, type Tool } from 'ai';
import { z } from 'zod';
import type { Turn } from '$lib/server/repos/chat';
import { motionToolList, motionToolSpec } from '$lib/server/motion/tool-run';
import { withFrames } from '$lib/server/motion/frames';
import { firstLine, slimCore } from './core-tools';
import { FRAME_TOOL, createFrameTools, type FrameRunner, type FrameToolDeps } from './frame-tools';

export const FIND_TOOLS = 'find_tools';
export const LOAD_TOOLS = 'load_tools';
export const DESCRIBE_TOOLS = 'describe_tools';
export const LOADED_CAP = 40;
export const WARM_TURNS = 3;
const FOUND_MAX = 25;

export enum ToolLoading {
  Proxy = 'proxy',
  Direct = 'direct',
  Load = 'load'
}

export function toolLoadingOf(raw: string | undefined): ToolLoading {
  return Object.values(ToolLoading).includes(raw as ToolLoading) ? (raw as ToolLoading) : ToolLoading.Load;
}

type JsonObject = { type?: string; properties?: Record<string, unknown>; [key: string]: unknown };

const NODE_ID_FIELD = { type: 'string', description: 'the frame node; defaults to the frame open in the editor' };

function withNodeId(schema: JsonObject): JsonObject {
  return { ...schema, type: 'object', properties: { node_id: NODE_ID_FIELD, ...(schema.properties ?? {}) } };
}

export async function directFrameTools(runner: FrameRunner, taken: ReadonlySet<string>): Promise<Record<string, Tool>> {
  const free = motionToolList().filter((t) => !taken.has(t.name));
  const specs = await Promise.all(free.map((t) => motionToolSpec(t.name)));

  const tools = Object.fromEntries(
    specs.flatMap((spec) => {
      if (!spec) {
        return [];
      }
      const direct = tool({
        description: spec.description,
        inputSchema: jsonSchema(withNodeId(spec.input_schema as JsonObject)),
        execute: (input: unknown, { toolCallId }) => {
          const { node_id, ...rest } = (input ?? {}) as Record<string, unknown>;
          return runner.run({ node_id: typeof node_id === 'string' ? node_id : undefined, tool: spec.name, input: rest }, toolCallId);
        }
      });
      return [[spec.name, direct]];
    })
  );
  return withFrames(tools, { frames: runner.seen });
}

export function warmTools(turns: readonly Turn[], loadable: ReadonlySet<string>): string[] {
  const recent = turns.filter((t) => t.role === 'assistant').slice(-WARM_TURNS);
  const used = recent.flatMap((t) => (t.tools ?? []).map((saved) => saved.toolName));
  const proxied = recent.flatMap((t) => (t.tools ?? []).filter((saved) => saved.toolName === FRAME_TOOL).map((saved) => String((saved.input as { tool?: unknown } | undefined)?.tool ?? '')));
  return [...new Set([...used, ...proxied].filter((name) => loadable.has(name)))].slice(-LOADED_CAP);
}

export class LoadedSet {
  private readonly names: string[];

  constructor(warm: readonly string[]) {
    this.names = [...warm].slice(-LOADED_CAP);
  }

  add(names: readonly string[]): void {
    for (const name of names) {
      const at = this.names.indexOf(name);
      if (at >= 0) {
        this.names.splice(at, 1);
      }
      this.names.push(name);
    }
    this.names.splice(0, Math.max(0, this.names.length - LOADED_CAP));
  }

  list(): string[] {
    return [...this.names];
  }
}

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const NAME_WEIGHT = 3;

function score(query: string, name: string, description: string): number {
  const named = name.replace(/_/g, ' ');
  const described = description.toLowerCase();
  return words(query).reduce((sum, w) => sum + (named.includes(w) ? NAME_WEIGHT : 0) + (described.includes(w) ? 1 : 0), 0);
}

type Entry = { name: string; summary: string };

export type Catalogue = { full: Record<string, Tool>; entries: Entry[]; loaded: LoadedSet };

export function loaderTools({ full, entries, loaded }: Catalogue): Record<string, Tool> {
  const loadable = new Set(entries.map((e) => e.name));
  const described = (name: string) => String(full[name]?.description ?? '');

  return {
    [FIND_TOOLS]: tool({
      description: `Search the other tools (frame editor, effects, gallery, groups, loops...) by keywords, best match first; omit query to list all. Free. ${LOAD_TOOLS} them to call them.`,
      inputSchema: z.object({ query: z.string().optional() }).strict(),
      execute: async ({ query }: { query?: string }) => {
        const ranked = query ? entries.map((e) => ({ e, score: score(query, e.name, described(e.name)) })).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).map((r) => r.e) : entries;
        const kept = new Set(loaded.list());
        return { tools: ranked.slice(0, query ? FOUND_MAX : ranked.length).map((e) => ({ ...e, loaded: kept.has(e.name) })) };
      }
    }),

    [LOAD_TOOLS]: tool({
      description: `Load tools by name, several at once: callable from the next step with full schema. At most ${LOADED_CAP}, oldest drop.`,
      inputSchema: z.object({ names: z.array(z.string().min(1)).min(1).max(LOADED_CAP) }).strict(),
      execute: async ({ names }: { names: string[] }) => {
        const known = names.filter((n) => loadable.has(n));
        loaded.add(known);
        return { loaded: known, unknown: names.filter((n) => !loadable.has(n)), callable_from: 'next step' };
      }
    }),

    [DESCRIBE_TOOLS]: tool({
      description: 'Full description and input schema of any tool by name: {names}.',
      inputSchema: z.object({ names: z.array(z.string().min(1)).min(1).max(LOADED_CAP) }).strict(),
      execute: async ({ names }: { names: string[] }) => ({
        tools: names.filter((n) => n in full).map((name) => ({ name, description: described(name), schema: asSchema(full[name].inputSchema).jsonSchema })),
        unknown: names.filter((n) => !(n in full))
      })
    })
  };
}

export type FrameSurface = { tools: Record<string, Tool>; active: () => string[] | undefined; guidance: string };

export const PROXY_GUIDANCE = 'Edit frames (motion videos and stills) yourself with frame_tool: its description names the editor tools, describe_frame_tool gives one schema. Small, precise changes (a text, a colour, a timing, a still export) go through frame_tool.';
const DIRECT_GUIDANCE = 'Edit frames (motion videos and stills) yourself with the frame editor tools (add_clip, set_props, set_keyframes…): each takes node_id, default the open frame. Small, precise changes (a text, a colour, a timing, a still export) go through them.';
const LOAD_GUIDANCE = `Only a few tools are listed. Edit frames (motion videos and stills) yourself with the frame editor tools, and reach every other tool (effects, gallery, groups, loops, connecting nodes...) the same way: ${FIND_TOOLS} searches them (one call with every keyword you need), ${LOAD_TOOLS} makes them callable from the next step (load every tool you will need in one call), ${DESCRIBE_TOOLS} gives an exact schema. Frame tools take node_id, default the open frame. Small, precise changes (a text, a colour, a timing, a still export) go through them.`;

export async function frameSurface(mode: ToolLoading, deps: FrameToolDeps, runner: FrameRunner, core: Record<string, Tool>, turns: readonly Turn[], kept: Record<string, Tool> = {}): Promise<FrameSurface> {
  if (mode === ToolLoading.Proxy) {
    return { tools: createFrameTools(deps, runner), active: () => undefined, guidance: PROXY_GUIDANCE };
  }

  const direct = await directFrameTools(runner, new Set(Object.keys(core)));
  if (mode === ToolLoading.Direct) {
    return { tools: direct, active: () => undefined, guidance: DIRECT_GUIDANCE };
  }

  const slim = slimCore(core);
  const deferred = Object.keys(core).filter((name) => !(name in slim) && !(name in kept));
  const entries: Entry[] = [
    ...motionToolList().filter((t) => t.name in direct),
    ...deferred.map((name) => ({ name, summary: firstLine(String(core[name].description ?? '')) }))
  ];
  const loaded = new LoadedSet(warmTools(turns, new Set(entries.map((e) => e.name))));
  const loader = loaderTools({ full: { ...core, ...direct }, entries, loaded });
  const alwaysOn = new Set([...Object.keys(slim), ...Object.keys(kept), ...Object.keys(loader)]);
  const order = [...Object.keys(core), ...Object.keys(loader), ...Object.keys(direct)];
  return {
    tools: { ...loader, ...direct, ...slim },
    active: () => {
      const on = new Set([...alwaysOn, ...loaded.list()]);
      return order.filter((name) => on.has(name));
    },
    guidance: LOAD_GUIDANCE
  };
}
