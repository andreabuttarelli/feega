import { handleMcpFetch } from '../mcp/http-app.ts';

const CHARS_PER_TOKEN = 4;

const post = (body: unknown) =>
  handleMcpFetch(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify(body)
    })
  );

await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'sizes', version: '0' } } });

const { result } = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })).json();

const rows = (result.tools as { name: string }[])
  .map((tool) => ({ name: tool.name, chars: JSON.stringify(tool).length }))
  .sort((a, b) => b.chars - a.chars);

const line = (chars: number, label: string) =>
  `${String(chars).padStart(7)}  ~${String(Math.round(chars / CHARS_PER_TOKEN)).padStart(6)} tok  ${label}`;

for (const { name, chars } of rows) {
  console.log(line(chars, name));
}

console.log(line(JSON.stringify(result).length, `TOTAL (${rows.length} tools)`));
