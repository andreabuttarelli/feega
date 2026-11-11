import { createInterface } from 'node:readline';

const send = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const pending = new Map();
let servers = [];
let nextId = 1000;

const ask = (method, params) => new Promise((done) => {
  const id = nextId++;
  pending.set(id, done);
  send({ id, method, params });
});

const update = (sessionId, body) => send({ method: 'session/update', params: { sessionId, update: body } });

const HANDLERS = {
  initialize: () => ({ protocolVersion: 1, agentCapabilities: {} }),
  'session/new': (p) => {
    servers = p.mcpServers;
    return { sessionId: 'fake-session' };
  },
  'session/prompt': async (p) => {
    const text = p.prompt.map((b) => b.text).join('');
    update(p.sessionId, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: `heard: ${text}` } });
    const answer = await ask('session/request_permission', { sessionId: p.sessionId, toolCall: { toolCallId: 't1', title: 'feega edit' }, options: [{ optionId: 'no', name: 'Reject', kind: 'reject_once' }, { optionId: 'yes', name: 'Allow', kind: 'allow_once' }] });
    update(p.sessionId, { sessionUpdate: 'tool_call', toolCallId: 't1', title: `feega edit via ${servers.map((s) => s.name).join(',')} (${answer.outcome.optionId})`, status: 'completed' });
    return { stopReason: 'end_turn' };
  }
};

createInterface({ input: process.stdin }).on('line', async (line) => {
  const msg = JSON.parse(line);
  if (msg.method === undefined) {
    pending.get(msg.id)?.(msg.result);
    return;
  }

  const result = await HANDLERS[msg.method](msg.params);
  send({ id: msg.id, result });
});
