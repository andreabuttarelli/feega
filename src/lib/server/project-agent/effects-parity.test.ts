import { describe, expect, it } from 'vitest';
import type { Tool } from 'ai';
import { z } from 'zod';
import { fakeDb } from '$lib/server/db/fake-db';
import { createProjectTools } from './project-tools';
import { registerNodeTools } from '../../../../cli/mcp/tools/nodes';

const EFFECT_TOOLS = ['apply_effects', 'make_effects_pair', 'list_effects', 'write_effect'];
const MCP_ONLY_FIELDS = ['org'];

type Registered = { name: string; fields: string[] };

function mcpTools(): Registered[] {
  const registered: Registered[] = [];
  const server = {
    registerTool: (name: string, spec: { inputSchema?: z.ZodObject }) =>
      registered.push({ name, fields: Object.keys(spec.inputSchema?.shape ?? {}) })
  };
  registerNodeTools(server as never);
  return registered;
}

function chatTools(): Registered[] {
  const tools = createProjectTools({ db: fakeDb({}).db, orgId: 'o', projectId: 'p', userId: 'u' });
  return Object.entries(tools).map(([name, tool]: [string, Tool]) => ({
    name,
    fields: Object.keys((tool.inputSchema as z.ZodObject).shape ?? {})
  }));
}

const snake = (field: string) => field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

describe('effects: chat della tela e MCP fanno le stesse cose', () => {
  it.each(EFFECT_TOOLS)('%s esiste in entrambe le superfici con gli stessi campi', (name) => {
    const chat = chatTools().find((t) => t.name === name);
    const mcp = mcpTools().find((t) => t.name === name);

    expect(chat, `chat senza ${name}`).toBeDefined();
    expect(mcp, `MCP senza ${name}`).toBeDefined();
    expect(chat!.fields.map(snake).sort()).toEqual(mcp!.fields.filter((f) => !MCP_ONLY_FIELDS.includes(f)).sort());
  });
});
