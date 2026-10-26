import { describe, expect, test } from 'bun:test';
import { listAllTools } from './server.ts';

const EDIT_HINT_TOOLS = ['edit', 'insert_row', 'update_row', 'query'];

describe('the MCP tools that trim their answers offer verbose to get the whole data', () => {
  test.each(EDIT_HINT_TOOLS)('%s has a verbose option', async (name) => {
    const tool = (await listAllTools()).find((t) => t.name === name) as { inputSchema?: { properties?: Record<string, unknown> } } | undefined;

    expect(Object.keys(tool?.inputSchema?.properties ?? {})).toContain('verbose');
  });
});
