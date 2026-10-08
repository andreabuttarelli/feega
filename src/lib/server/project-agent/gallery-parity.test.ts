import { describe, expect, it } from 'vitest';
import type { Tool } from 'ai';
import { z } from 'zod';
import { fakeDb } from '$lib/server/db/fake-db';
import { createProjectTools } from './project-tools';
import { registerGalleryTools } from '../../../../cli/mcp/tools/gallery';

const GALLERY_TOOLS = ['search_gallery', 'remix_gallery_item', 'publish_to_gallery'];
const MCP_ONLY_FIELDS = ['org', 'project_id'];

type Registered = { name: string; fields: string[] };

function mcpTools(): Registered[] {
  const registered: Registered[] = [];
  const server = {
    registerTool: (name: string, spec: { inputSchema?: z.ZodObject }) => registered.push({ name, fields: Object.keys(spec.inputSchema?.shape ?? {}) })
  };
  registerGalleryTools(server as never);
  return registered;
}

function chatTools(): Registered[] {
  const tools = createProjectTools({ db: fakeDb({}).db, orgId: 'o', projectId: 'p', userId: 'u' });
  return Object.entries(tools).map(([name, tool]: [string, Tool]) => ({ name, fields: Object.keys((tool.inputSchema as z.ZodObject).shape ?? {}) }));
}

const snake = (field: string) => field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

describe('gallery: la chat della tela e MCP fanno le stesse cose', () => {
  it.each(GALLERY_TOOLS)('%s esiste in entrambe le superfici con gli stessi campi', (name) => {
    const chat = chatTools().find((t) => t.name === name);
    const mcp = mcpTools().find((t) => t.name === name);

    expect(chat, `chat senza ${name}`).toBeDefined();
    expect(mcp, `MCP senza ${name}`).toBeDefined();
    expect(chat!.fields.map(snake).sort()).toEqual(mcp!.fields.filter((f) => !MCP_ONLY_FIELDS.includes(f)).sort());
  });
});
