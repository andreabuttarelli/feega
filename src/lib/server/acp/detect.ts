import { execFile } from 'node:child_process';
import { access, constants, readdir, stat } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { AcpLaunch, AgentAuth, type DetectedAgent } from '$lib/acp/detected-agent';
import type { AgentCommand } from './client';

type Acp = { launch: AcpLaunch.Native; args: string[] } | { launch: AcpLaunch.Adapter; adapter: string };

export type CatalogRow = {
  id: string;
  name: string;
  binaries: string[];
  acp: Acp;
  install: string;
  login: string | null;
  credentials: string[];
  apiKeys: string[];
  withoutCredentials: AgentAuth.NeedsLogin | AgentAuth.Unknown;
};

const native = (...args: string[]): Acp => ({ launch: AcpLaunch.Native, args });
const adapter = (pkg: string): Acp => ({ launch: AcpLaunch.Adapter, adapter: pkg });

export const AGENT_CATALOG: readonly CatalogRow[] = [
  { id: 'claude', name: 'Claude Code', binaries: ['claude'], acp: adapter('@agentclientprotocol/claude-agent-acp'), install: 'curl -fsSL https://claude.ai/install.sh | bash', login: 'claude /login', credentials: ['.claude/.credentials.json'], apiKeys: ['ANTHROPIC_API_KEY'], withoutCredentials: AgentAuth.Unknown },
  { id: 'codex', name: 'Codex CLI', binaries: ['codex'], acp: adapter('@agentclientprotocol/codex-acp'), install: 'npm install -g @openai/codex', login: 'codex login', credentials: ['.codex/auth.json'], apiKeys: ['OPENAI_API_KEY'], withoutCredentials: AgentAuth.NeedsLogin },
  { id: 'gemini', name: 'Gemini CLI', binaries: ['gemini'], acp: native('--acp'), install: 'npm install -g @google/gemini-cli', login: 'gemini', credentials: ['.gemini/oauth_creds.json'], apiKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], withoutCredentials: AgentAuth.Unknown },
  { id: 'cursor', name: 'Cursor Agent', binaries: ['cursor-agent'], acp: native('acp'), install: 'curl https://cursor.com/install -fsS | bash', login: 'cursor-agent login', credentials: [], apiKeys: ['CURSOR_API_KEY'], withoutCredentials: AgentAuth.Unknown },
  { id: 'amp', name: 'Amp', binaries: ['amp'], acp: adapter('amp-acp'), install: 'npm install -g @sourcegraph/amp', login: 'amp login', credentials: ['.local/share/amp/secrets.json'], apiKeys: ['AMP_API_KEY'], withoutCredentials: AgentAuth.NeedsLogin },
  { id: 'opencode', name: 'OpenCode', binaries: ['opencode'], acp: native('acp'), install: 'curl -fsSL https://opencode.ai/install | bash', login: 'opencode auth login', credentials: ['.local/share/opencode/auth.json'], apiKeys: [], withoutCredentials: AgentAuth.NeedsLogin },
  { id: 'goose', name: 'Goose', binaries: ['goose'], acp: native('acp'), install: 'brew install block-goose-cli', login: 'goose configure', credentials: ['.config/goose/config.yaml'], apiKeys: [], withoutCredentials: AgentAuth.NeedsLogin },
  { id: 'qwen', name: 'Qwen Code', binaries: ['qwen'], acp: native('--acp'), install: 'npm install -g @qwen-code/qwen-code', login: 'qwen', credentials: ['.qwen/oauth_creds.json'], apiKeys: ['DASHSCOPE_API_KEY'], withoutCredentials: AgentAuth.Unknown },
  { id: 'copilot', name: 'GitHub Copilot CLI', binaries: ['copilot'], acp: native('--acp'), install: 'npm install -g @github/copilot', login: 'copilot', credentials: [], apiKeys: ['GH_TOKEN', 'GITHUB_TOKEN'], withoutCredentials: AgentAuth.Unknown },
  { id: 'kimi', name: 'Kimi CLI', binaries: ['kimi'], acp: native('acp'), install: 'uv tool install kimi-cli', login: 'kimi', credentials: [], apiKeys: ['KIMI_API_KEY'], withoutCredentials: AgentAuth.Unknown },
  { id: 'kiro', name: 'Kiro CLI', binaries: ['kiro-cli'], acp: native('acp'), install: 'curl -fsSL https://cli.kiro.dev/install | bash', login: 'kiro-cli login', credentials: [], apiKeys: [], withoutCredentials: AgentAuth.Unknown },
  { id: 'droid', name: 'Factory Droid', binaries: ['droid'], acp: native('exec', '--output-format', 'acp-daemon'), install: 'curl -fsSL https://app.factory.ai/cli | sh', login: 'droid', credentials: [], apiKeys: ['FACTORY_API_KEY'], withoutCredentials: AgentAuth.Unknown },
  { id: 'auggie', name: 'Auggie CLI', binaries: ['auggie'], acp: native('--acp'), install: 'npm install -g @augmentcode/auggie', login: 'auggie login', credentials: ['.augment/session.json'], apiKeys: ['AUGMENT_SESSION_AUTH'], withoutCredentials: AgentAuth.NeedsLogin },
  { id: 'cline', name: 'Cline', binaries: ['cline'], acp: native('--acp'), install: 'npm install -g cline', login: 'cline auth', credentials: [], apiKeys: [], withoutCredentials: AgentAuth.Unknown },
  { id: 'kilo', name: 'Kilo', binaries: ['kilo'], acp: native('acp'), install: 'npm install -g @kilocode/cli', login: 'kilo auth', credentials: [], apiKeys: [], withoutCredentials: AgentAuth.Unknown }
];

const COMMON_DIRS = ['.local/bin', '.npm-global/bin', '.bun/bin', '.opencode/bin', '.cargo/bin'];
const SYSTEM_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];
const NPX_CACHE = '.npm/_npx';
const NPX_BIN = 'node_modules/.bin';
const PROBE_TIMEOUT_MS = 3000;
const VERSION = /\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/;

export type DetectHost = {
  env: Record<string, string | undefined>;
  fs: { executable: (path: string) => Promise<boolean>; exists: (path: string) => Promise<boolean>; list: (dir: string) => Promise<string[]> };
  run: (command: string, args: string[], timeoutMs: number) => Promise<string | null>;
};

export type Detection = { agent: DetectedAgent; command: AgentCommand | null };

async function searchDirs(host: DetectHost): Promise<string[]> {
  const home = host.env.HOME ?? '';
  const path = (host.env.PATH ?? '').split(delimiter).filter(Boolean);
  const npx = join(home, NPX_CACHE);
  const cached = (await host.fs.list(npx)).map((entry) => join(npx, entry, NPX_BIN));
  return [...new Set([...path, ...COMMON_DIRS.map((d) => join(home, d)), ...SYSTEM_DIRS, ...cached])];
}

async function which(host: DetectHost, dirs: string[], binaries: string[]): Promise<string | null> {
  for (const dir of dirs) {
    for (const binary of binaries) {
      const candidate = join(dir, binary);
      if (await host.fs.executable(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

async function authOf(host: DetectHost, row: CatalogRow): Promise<AgentAuth> {
  if (row.apiKeys.some((key) => host.env[key])) {
    return AgentAuth.SignedIn;
  }

  const home = host.env.HOME ?? '';
  for (const file of row.credentials) {
    if (await host.fs.exists(join(home, file))) {
      return AgentAuth.SignedIn;
    }
  }

  return row.withoutCredentials;
}

function commandOf(row: CatalogRow, path: string, npx: string | null): AgentCommand | null {
  if (row.acp.launch === AcpLaunch.Native) {
    return { command: path, args: row.acp.args };
  }

  return npx ? { command: npx, args: ['-y', row.acp.adapter] } : null;
}

async function detectOne(host: DetectHost, dirs: string[], npx: string | null, row: CatalogRow): Promise<Detection> {
  const base = { id: row.id, name: row.name, install: row.install, login: row.login };
  const path = await which(host, dirs, row.binaries);
  if (!path) {
    return { agent: { ...base, installed: false, version: null, launch: AcpLaunch.None, auth: AgentAuth.Unknown }, command: null };
  }

  const [printed, auth] = await Promise.all([host.run(path, ['--version'], PROBE_TIMEOUT_MS), authOf(host, row)]);
  const command = commandOf(row, path, npx);
  const launch = command ? row.acp.launch : AcpLaunch.None;
  return { agent: { ...base, installed: true, version: printed?.match(VERSION)?.[0] ?? null, launch, auth }, command };
}

export async function detectWith(host: DetectHost): Promise<Detection[]> {
  const dirs = await searchDirs(host);
  const npx = await which(host, dirs, ['npx']);
  return Promise.all(AGENT_CATALOG.map((row) => detectOne(host, dirs, npx, row)));
}

export const detectAgents = async (host: DetectHost) => (await detectWith(host)).map((d) => d.agent);

const executable = (path: string) =>
  access(path, constants.X_OK)
    .then(() => stat(path))
    .then((s) => s.isFile())
    .catch(() => false);

const exists = (path: string) =>
  stat(path)
    .then((s) => s.isFile())
    .catch(() => false);

export const nodeHost = (env: DetectHost['env'] = process.env): DetectHost => ({
  env,
  fs: { executable, exists, list: (dir) => readdir(dir).catch(() => []) },
  run: (command, args, timeoutMs) =>
    new Promise((resolve) => execFile(command, args, { timeout: timeoutMs, encoding: 'utf8' }, (e, stdout) => resolve(e ? null : stdout)))
});

export enum Refresh {
  Cached = 'cached',
  Fresh = 'fresh'
}

let cache: Promise<Detection[]> | null = null;

export function detectCached(refresh: Refresh, host: () => DetectHost = nodeHost): Promise<Detection[]> {
  if (refresh === Refresh.Fresh || !cache) {
    cache = detectWith(host());
  }

  return cache;
}
