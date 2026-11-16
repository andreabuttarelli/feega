import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeImportOutcome } from './import-code';

const adopt = vi.fn();
const read = vi.fn();

vi.mock('$lib/server/canvas/project-library', () => ({ adoptDocLibrary: (...a: unknown[]) => adopt(...a) }));
vi.mock('$lib/server/motion/move-element', () => ({ frameStore: () => ({ read }) }));

const { adoptedLibrary } = await import('./canvas-import');

const scope = { db: {}, orgId: 'o', projectId: 'p', userId: 'u', actor: {} } as never;
const doc = { variables: { 'app Colors': { modes: ['Light'], vars: {} } } };
const ok = { outcome: CodeImportOutcome.Ok, frameId: 'f', design: { tokens: 1 } } as never;

describe('adoptedLibrary', () => {
  beforeEach(() => {
    adopt.mockReset();
    read.mockReset().mockResolvedValue({ doc });
  });

  it('le variabili e gli stili di un import di codice entrano nella libreria del progetto, come per un URL', async () => {
    await adoptedLibrary(scope, ok);

    expect(adopt).toHaveBeenCalledWith(scope.db, scope, doc);
  });

  it('senza design system, o con un import rifiutato, la libreria non si tocca', async () => {
    await adoptedLibrary(scope, { outcome: CodeImportOutcome.Ok, frameId: 'f' } as never);
    await adoptedLibrary(scope, { outcome: CodeImportOutcome.Invalid } as never);

    expect(adopt).not.toHaveBeenCalled();
  });
});
