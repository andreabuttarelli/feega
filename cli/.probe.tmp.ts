import { handleMcpFetch } from './mcp/http-app.ts';
const post = (b) => handleMcpFetch(new Request('http://localhost/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(b) }));
await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'inventory', version: '0' } } });
const res = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
console.log((await res.text()).length);
process.exit(0);
