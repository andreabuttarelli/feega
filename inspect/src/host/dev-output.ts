export enum Failure {
  MissingDeps = 'missing-deps',
  PortInUse = 'port-in-use',
  MissingModule = 'missing-module',
  Syntax = 'syntax'
}

export enum FailureAction {
  Install = 'install',
  Restart = 'restart',
  ShowLogs = 'show-logs'
}

type FailureRow = { pattern: RegExp; message: string; action: FailureAction };

export const FAILURES: Record<Failure, FailureRow> = {
  [Failure.MissingDeps]: { pattern: /command not found|is not recognized as an internal or external command|ENOENT.*spawn/, message: "Dependencies aren't installed", action: FailureAction.Install },
  [Failure.PortInUse]: { pattern: /EADDRINUSE|address already in use|Port \d+ is (already )?in use/i, message: 'The port is already in use', action: FailureAction.Restart },
  [Failure.MissingModule]: { pattern: /ERR_MODULE_NOT_FOUND|Cannot find (module|package)/, message: 'A dependency is missing', action: FailureAction.Install },
  [Failure.Syntax]: { pattern: /SyntaxError/, message: 'The app has a syntax error', action: FailureAction.ShowLogs }
};

const ANSI = /\u001b\[[0-9;]*m/g;
const LOCAL_URL = /Local\b[:\s]+\s*(https?:\/\/[^\s]+)/;

const plain = (text: string) => text.replace(ANSI, '');

export function localUrlOf(text: string): string | null {
  return plain(text).match(LOCAL_URL)?.[1] ?? null;
}

export type Failed = { failure: Failure; line: string; message: string; action: FailureAction };

export function failureOf(text: string): Failed | null {
  for (const line of plain(text).split('\n')) {
    const found = (Object.entries(FAILURES) as [Failure, FailureRow][]).find(([, row]) => row.pattern.test(line));
    if (found) {
      return { failure: found[0], line: line.trim(), message: found[1].message, action: found[1].action };
    }
  }
  return null;
}
