const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { valid, install, Channel } = require('./local-agents.cjs');

const TURN = '5b0f4a52-3c1e-4c55-9d1e-0c4f0a7b6c11';
const PROJECT = '0aef6d1a-1111-4222-8333-444455556666';
const FAKE_AGENT = path.join(__dirname, '..', '..', 'src', 'lib', 'server', 'acp', 'fake-agent.mjs');

const turn = (patch = {}) => ({ turnId: TURN, agent: 'claude', prompt: 'add a title', projectId: PROJECT, token: 'jwt', ...patch });

test('a turn needs a uuid, a catalog agent, a prompt, a project and a token', () => {
  assert.ok(valid(Channel.Start, turn()));
  assert.ok(!valid(Channel.Start, turn({ turnId: 'x' })));
  assert.ok(!valid(Channel.Start, turn({ agent: 'rm -rf' })));
  assert.ok(!valid(Channel.Start, turn({ prompt: 42 })));
  assert.ok(!valid(Channel.Start, turn({ prompt: 'x'.repeat(100_001) })));
  assert.ok(!valid(Channel.Start, turn({ projectId: '../etc' })));
  assert.ok(!valid(Channel.Start, turn({ token: '' })));
  assert.ok(!valid(Channel.Start, null));
});

test('a choice is a catalog id or null', () => {
  assert.ok(valid(Channel.Choose, 'codex'));
  assert.ok(valid(Channel.Choose, null));
  assert.ok(!valid(Channel.Choose, 'unknown'));
  assert.ok(!valid(Channel.Choose, { id: 'codex' }));
});

test('refresh is cached or fresh', () => {
  assert.ok(valid(Channel.List, 'cached'));
  assert.ok(valid(Channel.List, 'fresh'));
  assert.ok(!valid(Channel.List, true));
});

test('an answer names a turn, a permission and an option', () => {
  assert.ok(valid(Channel.Answer, { turnId: TURN, id: TURN, optionId: 'yes' }));
  assert.ok(!valid(Channel.Answer, { turnId: TURN, id: 'p', optionId: 'yes' }));
  assert.ok(!valid(Channel.Answer, { turnId: TURN, id: TURN, optionId: 7 }));
  assert.ok(valid(Channel.Cancel, TURN));
  assert.ok(!valid(Channel.Cancel, 'nope'));
});

function fakeIpc() {
  const handlers = new Map();
  return {
    handle: (channel, fn) => handlers.set(channel, fn),
    on: (channel, fn) => handlers.set(channel, fn),
    call: (channel, event, ...args) => handlers.get(channel)(event, ...args)
  };
}

function sender() {
  const events = [];
  const contents = Object.assign(new EventEmitter(), { id: 1, isDestroyed: () => false, send: (_channel, ...args) => contents.emit('sent', args) });
  contents.on('sent', (args) => events.push(args));
  return { contents, events };
}

const FAKE_DETECTION = [{ agent: { id: 'claude', name: 'Claude Code', installed: true }, command: { command: process.execPath, args: [FAKE_AGENT] } }];

function installed(trusted = () => true) {
  const ipcMain = fakeIpc();
  let chosen = null;
  install({ ipcMain, trusted, detect: async () => FAKE_DETECTION, choices: { read: () => chosen, write: (id) => { chosen = id; } }, mcpUrl: 'https://mcp.example/mcp', cwd: () => __dirname });
  return ipcMain;
}

test('an untrusted page cannot list or run agents', async () => {
  const ipcMain = installed(() => false);
  const { contents } = sender();
  await assert.rejects(ipcMain.call(Channel.List, { sender: contents }, 'cached'));
  await assert.rejects(ipcMain.call(Channel.Start, { sender: contents }, turn()));
});

test('invalid input is refused before anything runs', async () => {
  const ipcMain = installed();
  const { contents } = sender();
  await assert.rejects(ipcMain.call(Channel.Start, { sender: contents }, turn({ agent: 'nope' })));
});

test('lists the detected agents and keeps the choice', async () => {
  const ipcMain = installed();
  const { contents } = sender();
  await ipcMain.call(Channel.Choose, { sender: contents }, 'claude');
  const listing = await ipcMain.call(Channel.List, { sender: contents }, 'cached');
  assert.equal(listing.chosen, 'claude');
  assert.equal(listing.agents[0].id, 'claude');
});

test('a turn streams updates, asks permission, hands the agent the cloud MCP server and ends', async () => {
  const ipcMain = installed();
  const { contents, events } = sender();
  await ipcMain.call(Channel.Start, { sender: contents }, turn());

  const asked = await new Promise((done) => contents.on('sent', ([, event]) => event.kind === 'permission' && done(event)));
  await ipcMain.call(Channel.Answer, { sender: contents }, { turnId: TURN, id: asked.id, optionId: 'yes' });
  await new Promise((done) => contents.on('sent', ([, event]) => event.kind === 'done' && done()));

  const kinds = events.map(([, e]) => e.kind);
  assert.deepEqual([kinds[0], kinds.at(-1)], ['update', 'done']);
  const tool = events.map(([, e]) => e.update?.title).find(Boolean);
  assert.equal(tool, 'feega edit via feega (yes)');
  assert.ok(events.every(([id]) => id === TURN));
});
