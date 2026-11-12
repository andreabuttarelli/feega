import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/code-import/canvas-import', () => ({ importCodeInto: vi.fn(async () => ({ outcome: 'no_sandbox' })) }));
vi.mock('$lib/server/figma/canvas-import', () => ({ importFigmaInto: vi.fn(async () => ({ outcome: 'something_new' })) }));

import { importSource, type SourceScope } from './home-sources';
import { PromptSource } from '$lib/home/prompt-sources';

const scope = { db: {}, orgId: 'o', userId: 'u', projectId: 'p' } as unknown as SourceScope;
const UPLOAD_PATH = 'org-1/proj-1/code-uploads/abc.zip';

describe('importSource', () => {
  it('una cartella caricata che fallisce non mostra il percorso né il codice', async () => {
    const landed = await importSource(scope, 'c', { source: PromptSource.Upload, value: UPLOAD_PATH });

    expect(landed.what).not.toContain(UPLOAD_PATH);
    expect('reason' in landed && landed.reason).toBe('Code import is not available right now.');
  });

  it('un esito sconosciuto ricade su un testo generico', async () => {
    const landed = await importSource(scope, 'c', { source: PromptSource.Figma, value: 'https://www.figma.com/design/x' });

    expect('reason' in landed && landed.reason).toBe('The import could not be completed.');
  });
});
