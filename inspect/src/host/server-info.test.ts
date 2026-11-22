import { describe, expect, it } from 'vitest';
import { commandShown, serverInfo } from './server-info';

const PLANNED = 5173;
const REAL = 5174;
const DEV = ['npm', 'run', 'dev', '--', '--port', String(PLANNED), '--host', '127.0.0.1'];

describe('the dev server menu', () => {
  it('carries no port of its own', () => {
    expect(commandShown(DEV, PLANNED)).toBe('npm run dev -- --host 127.0.0.1');
  });

  it('shows a url and a port that agree with what the preview loads', () => {
    const info = serverInfo({ url: `http://127.0.0.1:${REAL}/`, framework: 'astro', command: commandShown(DEV, PLANNED), pid: 1, attached: false }, { startedAt: 0, lastError: '', keptMinutes: 0 });
    expect(new URL(info.url).port).toBe(String(info.port));
    expect(info.command).not.toContain(String(PLANNED));
  });
});
