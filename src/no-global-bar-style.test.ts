import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const APP_CSS = readFileSync(fileURLToPath(new URL('app.css', import.meta.url)), 'utf8');
const GLOBAL_BAR_RULE = /^\.bars?\b/m;

describe('app.css non stila .bar', () => {
  it("l'header dell'editor motion e le clip della timeline non ereditano flex:1 e colonna", () => {
    expect(APP_CSS).not.toMatch(GLOBAL_BAR_RULE);
  });
});
