import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { handleMcpFetch } from './http-app.ts';

const post = (body: unknown) =>
  handleMcpFetch(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify(body),
    }),
  );

const hashOf = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('the MCP tool list does not move while the server code is reorganised (changed a tool on purpose? run npx vitest run -u on this file and commit the snapshot)', () => {
  test('tool names and descriptions are byte-identical', async () => {
    await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'pin', version: '0.0.1' } } });
    const body = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })).json();
    const tools = body.result.tools as { name: string; description: string; inputSchema: { required?: string[]; properties?: object } }[];
    const listed = tools.map((t) => ({ name: t.name, description: t.description, fields: Object.keys(t.inputSchema.properties ?? {}), required: t.inputSchema.required ?? [] }));

    expect({ count: tools.length, fingerprint: hashOf(listed) }).toMatchSnapshot();
  });
});
