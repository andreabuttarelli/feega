import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const RUNS_FEEGA = ['inspect-os.yml', 'vscode-release.yml'];

describe('workflows that run feega never send usage', () => {
  it.each(RUNS_FEEGA)('%s opts out at workflow level', (name) => {
    const text = readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');
    const top = text.split(/^jobs:/m)[0];

    expect(top).toMatch(/^env:[\s\S]*^\s+FEEGA_TELEMETRY: '?0'?$/m);
    expect(top).toMatch(/^env:[\s\S]*^\s+DO_NOT_TRACK: '?1'?$/m);
  });
});
