import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(new URL('./cli.ts', import.meta.url), 'utf8');

describe('feega CLI', () => {
  it('cli.ts si analizza senza errori di sintassi, così un errore di battitura non arriva agli utenti', () => {
    const parsed = ts.transpileModule(SOURCE, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });

    expect((parsed.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
  });
});
