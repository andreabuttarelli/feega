import { Readable, Writable } from 'node:stream';
import { agent, methods, ndJsonStream, PROTOCOL_VERSION, RequestError } from '@agentclientprotocol/sdk';

const SESSION = 'fake-session';
const MODES = [
  { id: 'default', name: 'Default', description: 'Ask before changes' },
  { id: 'acceptEdits', name: 'Accept edits', description: 'Apply file edits without asking' },
  { id: 'plan', name: 'Plan', description: 'Plan without editing' }
];
const MODELS = [
  { value: 'sonnet', name: 'Sonnet', description: 'Balanced' },
  { value: 'haiku', name: 'Haiku', description: 'Fast' }
];
const EFFORTS = [
  { value: 'low', name: 'Low' },
  { value: 'medium', name: 'Medium' },
  { value: 'high', name: 'High' }
];
const chosen = { model: 'sonnet', effort: 'medium' };
const configOptions = () => [
  { id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: chosen.model, options: MODELS },
  { id: 'effort', name: 'Effort', category: 'thought_level', type: 'select', currentValue: chosen.effort, options: EFFORTS },
  { id: 'mode', name: 'Mode', category: 'mode', type: 'select', currentValue: 'default', options: MODES.map((m) => ({ value: m.id, name: m.name })) },
  { id: 'fast', name: 'Fast mode', category: 'speed', type: 'boolean', currentValue: false }
];
const WRITTEN = 'written by the agent\n';

const chunk = (text) => ({ sessionId: SESSION, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } } });

let cancelled = null;

const handlers = {
  hello: async (cx) => {
    await cx.client.notify(methods.client.session.update, chunk('Hel'));
    await cx.client.notify(methods.client.session.update, chunk('lo'));
    return 'end_turn';
  },
  write: async (cx, path) => {
    const toolCallId = 'call-1';
    await cx.client.notify(methods.client.session.update, { sessionId: SESSION, update: { sessionUpdate: 'tool_call', toolCallId, title: `Write ${path}`, kind: 'edit', status: 'pending', content: [{ type: 'diff', path, oldText: null, newText: WRITTEN }] } });
    const answer = await cx.client.request(methods.client.session.requestPermission, {
      sessionId: SESSION,
      toolCall: { toolCallId, title: `Write ${path}`, kind: 'edit' },
      options: [
        { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
        { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
      ]
    });
    if (answer.outcome.outcome !== 'selected' || answer.outcome.optionId !== 'allow') {
      await cx.client.notify(methods.client.session.update, chunk('denied'));
      return 'end_turn';
    }
    await cx.client.request(methods.client.fs.writeTextFile, { sessionId: SESSION, path, content: WRITTEN });
    await cx.client.notify(methods.client.session.update, { sessionId: SESSION, update: { sessionUpdate: 'tool_call_update', toolCallId, status: 'completed' } });
    await cx.client.notify(methods.client.session.update, chunk('done'));
    return 'end_turn';
  },
  read: async (cx, path) => {
    const file = await cx.client.request(methods.client.fs.readTextFile, { sessionId: SESSION, path });
    await cx.client.notify(methods.client.session.update, chunk(file.content));
    return 'end_turn';
  },
  wait: () => new Promise((resolve) => (cancelled = resolve)),
  retune: async (cx) => {
    chosen.effort = 'high';
    await cx.client.notify(methods.client.session.update, { sessionId: SESSION, update: { sessionUpdate: 'config_option_update', configOptions: configOptions() } });
    return 'end_turn';
  },
  plan: async (cx) => {
    await cx.client.notify(methods.client.session.update, { sessionId: SESSION, update: { sessionUpdate: 'plan', entries: [{ content: 'step one', priority: 'high', status: 'in_progress' }] } });
    return 'end_turn';
  }
};

const textOf = (prompt) => prompt.map((block) => (block.type === 'text' ? block.text : '')).join('\n');

const CAN_LOAD = process.argv.includes('load');
const NEEDS_LOGIN = process.argv.includes('login');
const AUTH_REQUIRED = -32000;
let signedIn = !NEEDS_LOGIN;

const app = agent({ name: 'fake' })
  .onRequest(methods.agent.initialize, () => ({ protocolVersion: PROTOCOL_VERSION, agentCapabilities: { loadSession: CAN_LOAD }, authMethods: NEEDS_LOGIN ? [{ id: 'fake_login', name: 'Fake login' }] : [] }))
  .onRequest(methods.agent.authenticate, (cx) => {
    signedIn = cx.params.methodId === 'fake_login';
    return {};
  })
  .onRequest(methods.agent.session.new, () => {
    if (!signedIn) {
      throw new RequestError(AUTH_REQUIRED, 'Authentication required');
    }
    return { sessionId: SESSION, modes: { currentModeId: 'default', availableModes: MODES }, configOptions: configOptions() };
  })
  .onRequest(methods.agent.session.load, async (cx) => {
    await cx.client.notify(methods.client.session.update, chunk('replayed history'));
    return { modes: { currentModeId: 'plan', availableModes: MODES }, configOptions: configOptions() };
  })
  .onRequest(methods.agent.session.setMode, async (cx) => {
    await cx.client.notify(methods.client.session.update, { sessionId: SESSION, update: { sessionUpdate: 'current_mode_update', currentModeId: cx.params.modeId } });
    return {};
  })
  .onRequest(methods.agent.session.setConfigOption, (cx) => {
    chosen[cx.params.configId] = cx.params.value;
    return { configOptions: configOptions() };
  })
  .onRequest(methods.agent.session.prompt, async (cx) => {
    const text = textOf(cx.params.prompt);
    const [name, arg] = text.split('\n').pop().split(' ');
    const stopReason = await (handlers[name] ?? handlers.hello)(cx, arg);
    return { stopReason };
  })
  .onNotification(methods.agent.session.cancel, () => cancelled?.('cancelled'));

app.connect(ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)));
