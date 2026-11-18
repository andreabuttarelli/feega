const { randomUUID } = require('node:crypto');
const { AGENT_CATALOG } = require('./acp-agents.cjs');
const { runAcpTurn } = require('./acp-client.cjs');

const Channel = {
  List: 'local-agents:list',
  Choose: 'local-agents:choose',
  Start: 'local-agents:start',
  Answer: 'local-agents:answer',
  Cancel: 'local-agents:cancel',
  Event: 'local-agents:event'
};

const Refresh = { Cached: 'cached', Fresh: 'fresh' };
const EventKind = { Update: 'update', Permission: 'permission', Done: 'done', Failed: 'failed' };
const CANCELLED = { outcome: 'cancelled' };
const MAX_PROMPT = 100_000;
const MAX_TOKEN = 8_192;
const MAX_OPTION = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MCP_NAME = 'feega';

const isUuid = (v) => typeof v === 'string' && UUID.test(v);
const isText = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const isAgent = (v) => AGENT_CATALOG.some((row) => row.id === v);
const isObject = (v) => typeof v === 'object' && v !== null;

const VALID = {
  [Channel.List]: (v) => Object.values(Refresh).includes(v),
  [Channel.Choose]: (v) => v === null || isAgent(v),
  [Channel.Start]: (v) => isObject(v) && isUuid(v.turnId) && isAgent(v.agent) && isText(v.prompt, MAX_PROMPT) && isUuid(v.projectId) && isText(v.token, MAX_TOKEN),
  [Channel.Answer]: (v) => isObject(v) && isUuid(v.turnId) && isUuid(v.id) && isText(v.optionId, MAX_OPTION),
  [Channel.Cancel]: isUuid
};

function valid(channel, input) {
  return VALID[channel](input);
}

const feegaMcp = (url, token) => ({ type: 'http', name: MCP_NAME, url, headers: [{ name: 'Authorization', value: `Bearer ${token}` }] });

const promptOf = ({ projectId, prompt }) => [
  { type: 'text', text: `You are editing the Feega project ${projectId} through the feega MCP server.` },
  { type: 'text', text: prompt }
];

function install({ ipcMain, trusted, detect, choices, mcpUrl, cwd }) {
  const turns = new Map();
  let detection = null;

  const detected = (refresh) => {
    if (refresh === Refresh.Fresh || !detection) {
      detection = detect();
    }
    return detection;
  };

  function guard(channel, handler) {
    return async (event, input) => {
      if (!trusted(event)) {
        throw new Error('local agents refused for an untrusted page');
      }
      if (!valid(channel, input)) {
        throw new Error(`invalid input on ${channel}`);
      }
      return handler(event, input);
    };
  }

  async function start(event, input) {
    const found = (await detected(Refresh.Cached)).find((d) => d.agent.id === input.agent);
    if (!found?.command) {
      throw new Error(`${input.agent} is not installed here, or cannot run over ACP`);
    }

    const sender = event.sender;
    const abort = new AbortController();
    const waiting = new Map();
    turns.set(input.turnId, { abort, waiting });

    const send = (body) => {
      if (!sender.isDestroyed()) {
        sender.send(Channel.Event, input.turnId, body);
      }
    };

    const ask = (permission) => new Promise((settle) => {
      const id = randomUUID();
      waiting.set(id, settle);
      abort.signal.addEventListener('abort', () => settle(CANCELLED), { once: true });
      send({ kind: EventKind.Permission, id, ...permission });
    });

    sender.once('destroyed', () => abort.abort());

    const run = { agent: found.command, cwd: cwd(), mcpServers: [feegaMcp(mcpUrl, input.token)], prompt: promptOf(input) };
    runAcpTurn(run, { onUpdate: (update) => send({ kind: EventKind.Update, update }), ask, signal: abort.signal })
      .then(({ stopReason }) => send({ kind: EventKind.Done, stopReason }))
      .catch((e) => send({ kind: EventKind.Failed, message: e.message }))
      .finally(() => turns.delete(input.turnId));
  }

  function answer(_event, { turnId, id, optionId }) {
    const settle = turns.get(turnId)?.waiting.get(id);
    if (!settle) {
      return false;
    }
    settle({ outcome: 'selected', optionId });
    return true;
  }

  ipcMain.handle(Channel.List, guard(Channel.List, async (_event, refresh) => ({ agents: (await detected(refresh)).map((d) => d.agent), chosen: choices.read() })));
  ipcMain.handle(Channel.Choose, guard(Channel.Choose, (_event, id) => choices.write(id)));
  ipcMain.handle(Channel.Start, guard(Channel.Start, start));
  ipcMain.handle(Channel.Answer, guard(Channel.Answer, answer));
  ipcMain.handle(Channel.Cancel, guard(Channel.Cancel, (_event, turnId) => turns.get(turnId)?.abort.abort()));
}

module.exports = { Channel, Refresh, valid, install };
