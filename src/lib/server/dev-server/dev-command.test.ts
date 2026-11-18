import { describe, expect, it } from 'vitest';
import { devCommand } from './dev-command';

const pkg = (scripts: Record<string, string>) => JSON.stringify({ scripts });

describe('devCommand', () => {
  it('usa pnpm quando c è pnpm-lock', () => {
    expect(devCommand({ packageJson: pkg({ dev: 'next dev' }), lockfiles: ['pnpm-lock.yaml'] })).toEqual({ bin: 'pnpm', args: ['dev'] });
  });

  it('usa npm run dev di default', () => {
    expect(devCommand({ packageJson: pkg({ dev: 'vite' }), lockfiles: [] })).toEqual({ bin: 'npm', args: ['run', 'dev'] });
  });

  it('rispetta il comando configurato', () => {
    expect(devCommand({ packageJson: pkg({}), lockfiles: [], configured: 'bun run start' })).toEqual({ bin: 'bun', args: ['run', 'start'] });
  });

  it('nessun comando senza script dev', () => {
    expect(devCommand({ packageJson: pkg({ build: 'x' }), lockfiles: [] })).toBeNull();
  });
});
