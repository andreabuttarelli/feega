const { execFile } = require('node:child_process');
const { access, constants, readdir, stat } = require('node:fs/promises');
const { delimiter, join } = require('node:path');

const Launch = { Native: 'native', Adapter: 'adapter', None: 'none' };
const Auth = { SignedIn: 'signed_in', NeedsLogin: 'needs_login', Unknown: 'unknown' };

const native = (...args) => ({ launch: Launch.Native, args });
const adapter = (pkg) => ({ launch: Launch.Adapter, adapter: pkg });

const AGENT_CATALOG = [
  { id: 'claude', name: 'Claude Code', binaries: ['claude'], acp: adapter('@agentclientprotocol/claude-agent-acp'), install: 'curl -fsSL https://claude.ai/install.sh | bash', login: 'claude /login', credentials: ['.claude/.credentials.json'], apiKeys: ['ANTHROPIC_API_KEY'], withoutCredentials: Auth.Unknown },
  { id: 'codex', name: 'Codex CLI', binaries: ['codex'], acp: adapter('@agentclientprotocol/codex-acp'), install: 'npm install -g @openai/codex', login: 'codex login', credentials: ['.codex/auth.json'], apiKeys: ['OPENAI_API_KEY'], withoutCredentials: Auth.NeedsLogin },
  { id: 'gemini', name: 'Gemini CLI', binaries: ['gemini'], acp: native('--acp'), install: 'npm install -g @google/gemini-cli', login: 'gemini', credentials: ['.gemini/oauth_creds.json'], apiKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], withoutCredentials: Auth.Unknown },
  { id: 'cursor', name: 'Cursor Agent', binaries: ['cursor-agent'], acp: native('acp'), install: 'curl https://cursor.com/install -fsS | bash', login: 'cursor-agent login', credentials: [], apiKeys: ['CURSOR_API_KEY'], withoutCredentials: Auth.Unknown },
  { id: 'amp', name: 'Amp', binaries: ['amp'], acp: adapter('amp-acp'), install: 'npm install -g @sourcegraph/amp', login: 'amp login', credentials: ['.local/share/amp/secrets.json'], apiKeys: ['AMP_API_KEY'], withoutCredentials: Auth.NeedsLogin },
  { id: 'opencode', name: 'OpenCode', binaries: ['opencode'], acp: native('acp'), install: 'curl -fsSL https://opencode.ai/install | bash', login: 'opencode auth login', credentials: ['.local/share/opencode/auth.json'], apiKeys: [], withoutCredentials: Auth.NeedsLogin },
  { id: 'goose', name: 'Goose', binaries: ['goose'], acp: native('acp'), install: 'brew install block-goose-cli', login: 'goose configure', credentials: ['.config/goose/config.yaml'], apiKeys: [], withoutCredentials: Auth.NeedsLogin },
  { id: 'qwen', name: 'Qwen Code', binaries: ['qwen'], acp: native('--acp'), install: 'npm install -g @qwen-code/qwen-code', login: 'qwen', credentials: ['.qwen/oauth_creds.json'], apiKeys: ['DASHSCOPE_API_KEY'], withoutCredentials: Auth.Unknown },
  { id: 'copilot', name: 'GitHub Copilot CLI', binaries: ['copilot'], acp: native('--acp'), install: 'npm install -g @github/copilot', login: 'copilot', credentials: [], apiKeys: ['GH_TOKEN', 'GITHUB_TOKEN'], withoutCredentials: Auth.Unknown },
  { id: 'kimi', name: 'Kimi CLI', binaries: ['kimi'], acp: native('acp'), install: 'uv tool install kimi-cli', login: 'kimi', credentials: [], apiKeys: ['KIMI_API_KEY'], withoutCredentials: Auth.Unknown },
  { id: 'kiro', name: 'Kiro CLI', binaries: ['kiro-cli'], acp: native('acp'), install: 'curl -fsSL https://cli.kiro.dev/install | bash', login: 'kiro-cli login', credentials: [], apiKeys: [], withoutCredentials: Auth.Unknown },
  { id: 'droid', name: 'Factory Droid', binaries: ['droid'], acp: native('exec', '--output-format', 'acp-daemon'), install: 'curl -fsSL https://app.factory.ai/cli | sh', login: 'droid', credentials: [], apiKeys: ['FACTORY_API_KEY'], withoutCredentials: Auth.Unknown },
  { id: 'auggie', name: 'Auggie CLI', binaries: ['auggie'], acp: native('--acp'), install: 'npm install -g @augmentcode/auggie', login: 'auggie login', credentials: ['.augment/session.json'], apiKeys: ['AUGMENT_SESSION_AUTH'], withoutCredentials: Auth.NeedsLogin },
  { id: 'cline', name: 'Cline', binaries: ['cline'], acp: native('--acp'), install: 'npm install -g cline', login: 'cline auth', credentials: [], apiKeys: [], withoutCredentials: Auth.Unknown },
  { id: 'kilo', name: 'Kilo', binaries: ['kilo'], acp: native('acp'), install: 'npm install -g @kilocode/cli', login: 'kilo auth', credentials: [], apiKeys: [], withoutCredentials: Auth.Unknown }
];

const COMMON_DIRS = ['.local/bin', '.npm-global/bin', '.bun/bin', '.opencode/bin', '.cargo/bin'];
const SYSTEM_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];
const NPX_CACHE = '.npm/_npx';
const NPX_BIN = 'node_modules/.bin';
const PROBE_TIMEOUT_MS = 3000;
const VERSION = /\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/;

const executable = (file) => access(file, constants.X_OK).then(() => stat(file)).then((s) => s.isFile()).catch(() => false);
const exists = (file) => stat(file).then((s) => s.isFile()).catch(() => false);
const run = (command, args) => new Promise((resolve) => execFile(command, args, { timeout: PROBE_TIMEOUT_MS, encoding: 'utf8' }, (e, stdout) => resolve(e ? null : stdout)));

async function searchDirs(env) {
  const home = env.HOME ?? '';
  const npx = join(home, NPX_CACHE);
  const cached = (await readdir(npx).catch(() => [])).map((entry) => join(npx, entry, NPX_BIN));
  const onPath = (env.PATH ?? '').split(delimiter).filter(Boolean);
  return [...new Set([...onPath, ...COMMON_DIRS.map((d) => join(home, d)), ...SYSTEM_DIRS, ...cached])];
}

async function which(dirs, binaries) {
  for (const dir of dirs) {
    for (const binary of binaries) {
      const candidate = join(dir, binary);
      if (await executable(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

async function authOf(env, row) {
  if (row.apiKeys.some((key) => env[key])) {
    return Auth.SignedIn;
  }

  for (const file of row.credentials) {
    if (await exists(join(env.HOME ?? '', file))) {
      return Auth.SignedIn;
    }
  }

  return row.withoutCredentials;
}

function commandOf(row, file, npx) {
  if (row.acp.launch === Launch.Native) {
    return { command: file, args: row.acp.args };
  }

  return npx ? { command: npx, args: ['-y', row.acp.adapter] } : null;
}

async function detectOne(env, dirs, npx, row) {
  const base = { id: row.id, name: row.name, install: row.install, login: row.login };
  const file = await which(dirs, row.binaries);
  if (!file) {
    return { agent: { ...base, installed: false, version: null, launch: Launch.None, auth: Auth.Unknown }, command: null };
  }

  const [printed, auth] = await Promise.all([run(file, ['--version']), authOf(env, row)]);
  const command = commandOf(row, file, npx);
  const launch = command ? row.acp.launch : Launch.None;
  return { agent: { ...base, installed: true, version: printed?.match(VERSION)?.[0] ?? null, launch, auth }, command };
}

async function detect(env) {
  const dirs = await searchDirs(env);
  const npx = await which(dirs, ['npx']);
  return Promise.all(AGENT_CATALOG.map((row) => detectOne(env, dirs, npx, row)));
}

module.exports = { AGENT_CATALOG, detect };
