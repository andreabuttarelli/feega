import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { editApi } from '../../lib/edit.ts';
import { DESCRIBE, FIND_TOOLS, LOAD_TOOLS, LOADED_CAP, TOOL_FAMILY, UNLOAD_TOOLS, ToolFamily, rank, type Findable, type RemoteTool } from '../surface.ts';
import { Listing, firstSentence, type ToolSurface } from '../tool-surface.ts';
import { fail, ok, okText, requireAuth, type ToolResult } from '../util.ts';

const HTTP_ERROR_FROM = 400;

const org = z.string().optional();

type EditEntry = { name: string; family: string; summary: string };

type EditDetail = { op: string; family: string; summary: string; input_schema: Record<string, unknown> | null };

async function editDescribe(input: Record<string, unknown>, orgId?: string): Promise<{ ok: true; body: unknown } | { ok: false; result: ToolResult }> {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth;
  }
  try {
    const answer = await editApi.edit(auth.session.access_token, { op: DESCRIBE, input }, orgId);
    if (answer.status >= HTTP_ERROR_FROM) {
      return { ok: false, result: fail(JSON.stringify(answer.body)) };
    }
    return { ok: true, body: answer.body };
  } catch (e) {
    return { ok: false, result: fail(e instanceof Error ? e.message : String(e)) };
  }
}

const EDIT_OP_FAMILIES = [ToolFamily.Canvas, ToolFamily.Frame, ToolFamily.Editor];

async function familyEntries(family: string, orgId?: string): Promise<EditEntry[]> {
  const described = await editDescribe({ family }, orgId);
  const ops = described.ok ? ((described.body as { ops?: Omit<EditEntry, 'family'>[] }).ops ?? []) : [];
  return ops.map((o) => ({ ...o, family }));
}

async function editEntries(orgId?: string, family?: string): Promise<EditEntry[]> {
  const families = family ? EDIT_OP_FAMILIES.filter((f) => f === family) : EDIT_OP_FAMILIES;
  return (await Promise.all(families.map((f) => familyEntries(f, orgId)))).flat();
}

async function localEntries(surface: ToolSurface): Promise<Findable[]> {
  const full = await surface.listing(Listing.Full);
  return surface.localNames().map((name) => ({ name, family: TOOL_FAMILY[name], summary: firstSentence(full.find((t) => t.name === name)?.description ?? '') }));
}

function remoteTool(detail: EditDetail): RemoteTool {
  const input = detail.input_schema ?? { type: 'object' };
  return {
    name: detail.op,
    family: detail.family,
    description: detail.summary,
    inputSchema: { type: 'object', properties: { target: { type: 'string' }, element: { type: 'string' }, project_id: { type: 'string' }, version: { type: 'integer' }, input }, required: [] }
  };
}

function runRemote(op: string) {
  return async ({ org: orgId, target, element, project_id, version, input }: Record<string, unknown>): Promise<ToolResult> => {
    const auth = await requireAuth();
    if (!auth.ok) {
      return auth.result;
    }
    const answer = await editApi.edit(auth.session.access_token, { op, target: target as string, element: element as string, project_id: project_id as string, version: version as number, input: input as Record<string, unknown> }, orgId as string);
    return answer.status >= HTTP_ERROR_FROM ? fail(JSON.stringify(answer.body)) : ok(answer.body);
  };
}

export function registerLoadingTools(server: McpServer, surface: ToolSurface) {
  for (const tool of surface.loaded.remote.values()) {
    surface.addRemote(tool, runRemote(tool.name));
  }

  server.registerTool(
    DESCRIBE,
    {
      description: 'Families, op names, or exact input schemas.',
      inputSchema: z.object({ org, family: z.enum(EDIT_OP_FAMILIES as [string, ...string[]]).optional(), op: z.string().optional(), ops: z.array(z.string()).max(LOADED_CAP).optional() }).strict(),
      annotations: { readOnlyHint: true }
    },
    async ({ org: orgId, family, op, ops }) => {
      const names = ops ?? (op ? [op] : []);
      if (family) {
        return okText({ family, ops: await familyEntries(family, orgId) });
      }
      if (names.length === 0) {
        const local = (await localEntries(surface)).map(({ name, family: f }) => ({ name, family: f }));
        const edit = await editDescribe({}, orgId);
        return okText({ tools: local, edit_ops: edit.ok ? edit.body : null, fix: 'Pass {family} for op names, {op} for one schema.' });
      }
      const full = await surface.listing(Listing.Full);
      const local = names.flatMap((name) => full.filter((t) => t.name === name).map((t) => ({ op: t.name, family: TOOL_FAMILY[t.name] ?? 'core', description: t.description, input_schema: t.inputSchema })));
      const rest = names.filter((name) => !local.some((l) => l.op === name));
      if (rest.length === 0) {
        return okText({ schemas: local });
      }
      const remote = await editDescribe({ ops: rest }, orgId);
      if (!remote.ok) {
        return remote.result;
      }
      return okText({ schemas: [...local, ...((remote.body as { schemas?: unknown[] }).schemas ?? [remote.body])] });
    }
  );

  server.registerTool(
    FIND_TOOLS,
    {
      description: 'Search tools and ops by keywords.',
      inputSchema: z.object({ org, query: z.string().optional(), family: z.enum(Object.values(ToolFamily) as [string, ...string[]]).optional() }).strict(),
      annotations: { readOnlyHint: true }
    },
    async ({ org: orgId, query, family }) => {
      const entries = [...(await localEntries(surface)), ...(await editEntries(orgId, family))];
      const found = rank(entries, query, family);
      return okText({ tools: found.map((e) => ({ ...e, loaded: surface.loaded.has(e.name) })), fix: `${LOAD_TOOLS} {names} lists them; or call any via edit {op, input}.` });
    }
  );

  server.registerTool(
    LOAD_TOOLS,
    {
      description: 'Add tools to this session list.',
      inputSchema: z.object({ org, names: z.array(z.string().min(1)).min(1).max(LOADED_CAP) }).strict(),
      annotations: { readOnlyHint: true }
    },
    async ({ org: orgId, names }) => {
      const local = names.filter((name) => surface.isLocal(name) && name in TOOL_FAMILY);
      const others = names.filter((name) => !local.includes(name) && !surface.isLocal(name));
      const remote = others.length ? await editDescribe({ ops: others }, orgId) : null;
      const details = remote?.ok ? ((remote.body as { schemas?: EditDetail[] }).schemas ?? []) : [];
      for (const detail of details) {
        surface.addRemote(remoteTool(detail), runRemote(detail.op));
      }
      const loaded = [...local, ...details.map((d) => d.op)];
      const evicted = surface.loaded.add(loaded);
      surface.removeRemote(evicted.filter((name) => !(name in TOOL_FAMILY)));
      surface.changed();
      return ok({ loaded, unknown: names.filter((n) => !loaded.includes(n)), evicted, callable: 'now, by name' });
    }
  );

  server.registerTool(
    UNLOAD_TOOLS,
    {
      description: 'Drop loaded tools.',
      inputSchema: z.object({ names: z.array(z.string().min(1)).min(1).max(LOADED_CAP) }).strict(),
      annotations: { readOnlyHint: true }
    },
    async ({ names }) => {
      const remote = names.filter((name) => surface.loaded.remote.has(name));
      surface.loaded.forget(names);
      surface.removeRemote(remote);
      surface.changed();
      return ok({ unloaded: names });
    }
  );
}
