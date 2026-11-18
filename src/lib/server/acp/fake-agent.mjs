import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const send = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const pending = new Map();
let servers = [];
let nextId = 1000;
let cancelled = false;
let turns = 0;
const log = (line) => process.env.FAKE_ACP_LOG && appendFileSync(process.env.FAKE_ACP_LOG, `${line}\n`);

if (process.env.FAKE_ACP_NOISE) {
  process.stdout.write('not json, just a banner\n');
}

const MODELS = [
  { modelId: 'fast', name: 'Fast', description: 'Quick answers' },
  { modelId: 'deep', name: 'Deep' }
];
let model = 'fast';

const SESSION_MODELS = {
  config: () => ({ configOptions: [{ id: 'mode', name: 'Mode', category: 'mode', type: 'select', currentValue: 'a', options: [{ value: 'a', name: 'A' }] }, { id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: model, options: MODELS.map((m) => ({ value: m.modelId, name: m.name, description: m.description })) }] }),
  models: () => ({ models: { availableModels: MODELS, currentModelId: model } }),
  none: () => ({})
};
const shape = SESSION_MODELS[process.env.FAKE_ACP_MODELS ?? 'none'];

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
    return { sessionId: 'fake-session', ...shape() };
  },
  'session/set_config_option': (p) => {
    model = p.value;
    return shape();
  },
  'session/set_model': (p) => {
    model = p.modelId;
    return {};
  },
  'session/prompt': async (p) => {
    turns += 1;
    cancelled = false;
    if (process.env.FAKE_ACP_CHATTY) {
      while (!cancelled) {
        update(p.sessionId, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '.' } });
        await new Promise((r) => setTimeout(r, 5));
      }
      return { stopReason: 'cancelled' };
    }

    if (process.env.FAKE_ACP_MEMORY) {
      update(p.sessionId, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: `turn ${turns} of ${process.pid}` } });
      return { stopReason: 'end_turn' };
    }

    const text = p.prompt.map((b) => b.text).join('');
    send({ method: '_fake/notice', params: {} });
    update(p.sessionId, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: `heard: ${text}${process.env.FAKE_ACP_MODELS ? ` on ${model}` : ''}` } });
    const answer = await ask('session/request_permission', { sessionId: p.sessionId, toolCall: { toolCallId: 't1', title: 'feega edit' }, options: [{ optionId: 'no', name: 'Reject', kind: 'reject_once' }, { optionId: 'yes', name: 'Allow', kind: 'allow_once' }] });
    if (cancelled) {
      return { stopReason: 'cancelled' };
    }
    update(p.sessionId, { sessionUpdate: 'tool_call', toolCallId: 't1', title: `feega edit via ${servers.map((s) => s.name).join(',')} (${answer.outcome.optionId})`, status: 'completed' });
    return { stopReason: 'end_turn' };
  }
};

const NOTIFICATIONS = {
  'session/cancel': () => {
    log('cancel');
    cancelled = true;
  }
};

createInterface({ input: process.stdin }).on('line', async (line) => {
  const msg = JSON.parse(line);
  if (msg.method === undefined && msg.id === undefined) {
    update('fake-session', { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: ' [client replied to a notification]' } });
    return;
  }

  if (msg.method === undefined) {
    pending.get(msg.id)?.(msg.result);
    return;
  }

  if (msg.id === undefined) {
    NOTIFICATIONS[msg.method]?.(msg.params);
    return;
  }

  const result = await HANDLERS[msg.method](msg.params);
  send({ id: msg.id, result });
});
