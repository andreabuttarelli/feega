import type { FileWrite } from './git-host';

const SECRET_PATTERNS: RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{60,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b[sr]k_(live|test)_[A-Za-z0-9]{16,}\b/,
  /\bsk-[A-Za-z0-9_-]{32,}\b/,
  /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/
];

const ENV_FILE = /(^|\/)\.env(\.[^/]*)?$/;

const SENSITIVE_FILES: RegExp[] = [
  /(^|\/)\.[^/]+$/,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|Gemfile\.lock|poetry\.lock|composer\.lock)$/,
  /(^|\/)(package\.json|tsconfig[^/]*\.json|jsconfig\.json|vercel\.json|netlify\.toml|Dockerfile)$/,
  /(^|\/)[^/]+\.config\.[cm]?[jt]s$/,
  /(^|\/)\.github\//
];

export const isEnvFile = (path: string) => ENV_FILE.test(path);

export const isSensitive = (path: string) => SENSITIVE_FILES.some((p) => p.test(path));

export const withSecrets = (files: FileWrite[]) => files.filter((f) => f.content !== null && SECRET_PATTERNS.some((p) => p.test(f.content!))).map((f) => f.path);
