export enum SourceKind {
  Github = 'github',
  Npm = 'npm'
}

export type PluginSource = { kind: SourceKind.Github; owner: string; repo: string; tag: string | null } | { kind: SourceKind.Npm; name: string; version: string | null };

const GITHUB = /^github:([\w.-]+)\/([\w.-]+)(?:@([\w.+/-]+))?$/;
const NPM = /^((?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*)(?:@([\w.+-]+))?$/;

export function sourceOf(text: string): PluginSource | null {
  const github = GITHUB.exec(text);
  if (github) {
    return { kind: SourceKind.Github, owner: github[1], repo: github[2], tag: github[3] ?? null };
  }
  const npm = NPM.exec(text);
  return npm ? { kind: SourceKind.Npm, name: npm[1], version: npm[2] ?? null } : null;
}
