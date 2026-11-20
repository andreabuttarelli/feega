import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Command } from './commands';

const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

describe('commands', () => {
  it('every registered command is declared, with a title, and nothing else is', () => {
    const declared = manifest.contributes.commands.map((c: { command: string; title: string }) => (expect(c.title).toBeTruthy(), c.command));

    expect(declared.sort()).toEqual(Object.values(Command).sort());
  });

  it('the explorer offers folder and page design', () => {
    const menu = manifest.contributes.menus['explorer/context'].map((m: { command: string }) => m.command);

    expect(menu).toEqual([Command.DesignFolder, Command.DesignPage]);
  });
});
