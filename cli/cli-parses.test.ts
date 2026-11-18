import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('feega CLI', () => {
  it('parte e stampa l aiuto, così un errore di sintassi in cli.ts non arriva agli utenti', () => {
    const out = execFileSync('bun', ['cli.ts', '--help'], { cwd: new URL('.', import.meta.url).pathname, encoding: 'utf8' });

    expect(out).toContain('live-edit');
  });
});
