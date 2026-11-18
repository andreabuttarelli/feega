const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { delimiter, dirname } = require('node:path');

const ACP_PROTOCOL_VERSION = 1;
const METHOD_NOT_FOUND = -32601;
const INITIALIZE = { protocolVersion: ACP_PROTOCOL_VERSION, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } };

class Connection {
  constructor(child, hooks) {
    this.child = child;
    this.hooks = hooks;
    this.nextId = 1;
    this.waiting = new Map();
    createInterface({ input: child.stdout }).on('line', (line) => this.receive(JSON.parse(line)));
    child.on('error', (e) => this.failAll(e));
    child.on('exit', (code) => this.failAll(new Error(`ACP agent exited with code ${code}`)));
  }

  request(method, params) {
    const id = this.nextId++;
    this.write({ id, method, params });
    return new Promise((done, fail) => this.waiting.set(id, { done, fail }));
  }

  notify(method, params) {
    this.write({ method, params });
  }

  write(msg) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
  }

  receive(msg) {
    if (msg.method === undefined) {
      this.settle(msg);
      return;
    }

    if (msg.method === 'session/update') {
      this.hooks.onUpdate(msg.params.update);
      return;
    }

    if (msg.method === 'session/request_permission') {
      void this.askUser(msg.id, msg.params);
      return;
    }

    if (msg.id === undefined) {
      return;
    }

    this.write({ id: msg.id, error: { code: METHOD_NOT_FOUND, message: `Method not found: ${msg.method}` } });
  }

  async askUser(id, params) {
    const outcome = await this.hooks.ask({ title: params.toolCall?.title ?? '', options: params.options });
    this.write({ id, result: { outcome } });
  }

  settle(msg) {
    const waiter = this.waiting.get(msg.id);
    if (!waiter) {
      return;
    }

    this.waiting.delete(msg.id);
    if (msg.error) {
      waiter.fail(new Error(msg.error.message));
      return;
    }

    waiter.done(msg.result);
  }

  failAll(e) {
    for (const w of this.waiting.values()) {
      w.fail(e);
    }

    this.waiting.clear();
  }
}

function launchEnv(command) {
  return { ...process.env, PATH: [dirname(command), process.env.PATH].filter(Boolean).join(delimiter) };
}

async function runAcpTurn({ agent, cwd, mcpServers, prompt }, hooks) {
  const child = spawn(agent.command, agent.args, { cwd, env: launchEnv(agent.command), stdio: ['pipe', 'pipe', 'inherit'] });
  const acp = new Connection(child, hooks);

  try {
    await acp.request('initialize', INITIALIZE);
    const { sessionId } = await acp.request('session/new', { cwd, mcpServers });
    hooks.signal?.addEventListener('abort', () => acp.notify('session/cancel', { sessionId }), { once: true });
    const { stopReason } = await acp.request('session/prompt', { sessionId, prompt });
    return { stopReason };
  } finally {
    child.kill();
  }
}

module.exports = { runAcpTurn };
