export type Command = { bin: string; args: string[] };

type Repo = { packageJson: string; lockfiles: readonly string[]; configured?: string };

const DEV_SCRIPT = 'dev';

const BY_LOCKFILE: readonly [string, Command][] = [
  ['pnpm-lock.yaml', { bin: 'pnpm', args: [DEV_SCRIPT] }],
  ['yarn.lock', { bin: 'yarn', args: [DEV_SCRIPT] }],
  ['bun.lockb', { bin: 'bun', args: ['run', DEV_SCRIPT] }],
  ['bun.lock', { bin: 'bun', args: ['run', DEV_SCRIPT] }]
];

const NPM: Command = { bin: 'npm', args: ['run', DEV_SCRIPT] };

function parseConfigured(line: string): Command {
  const [bin, ...args] = line.trim().split(/\s+/);
  return { bin, args };
}

function hasDevScript(packageJson: string): boolean {
  const scripts = (JSON.parse(packageJson) as { scripts?: Record<string, string> }).scripts ?? {};
  return DEV_SCRIPT in scripts;
}

export function devCommand(repo: Repo): Command | null {
  if (repo.configured) {
    return parseConfigured(repo.configured);
  }

  if (!hasDevScript(repo.packageJson)) {
    return null;
  }

  return BY_LOCKFILE.find(([file]) => repo.lockfiles.includes(file))?.[1] ?? NPM;
}
