import type { Db } from '$lib/server/db/client';
import { importCodeInto } from '$lib/server/code-import/canvas-import';
import { CodeImportOutcome } from '$lib/server/code-import/import-code';
import { importFigmaInto } from '$lib/server/figma/canvas-import';
import { FigmaOutcome } from '$lib/server/figma/import-images';
import { PROMPT_SOURCES, PromptSource, type SourcePick } from '$lib/home/prompt-sources';
import type { Landed } from '$lib/home/prompt-kinds';

export type SourceScope = { db: Db; orgId: string; userId: string; projectId: string };

const ORIGIN = { x: 0, y: 0 };

type Importer = (scope: SourceScope, canvasId: string, value: string) => Promise<{ frameIds: string[] } | { refusal: string }>;

const actorOf = (scope: SourceScope) => ({ ...scope, actor: { kind: 'user' as const, id: scope.userId } });

const fromCode = async (done: ReturnType<typeof importCodeInto>) => {
  const out = await done;
  return out.outcome === CodeImportOutcome.Ok ? { frameIds: [out.frameId] } : { refusal: out.outcome };
};

const IMPORTERS: Record<PromptSource, Importer> = {
  [PromptSource.Github]: (scope, canvasId, value) => fromCode(importCodeInto(actorOf(scope), canvasId, { repo: value, routes: [], at: ORIGIN })),
  [PromptSource.Folder]: (scope, canvasId, value) => fromCode(importCodeInto(actorOf(scope), canvasId, { folder: value, routes: [], at: ORIGIN })),
  [PromptSource.Upload]: (scope, canvasId, value) => fromCode(importCodeInto(actorOf(scope), canvasId, { upload: value, routes: [], at: ORIGIN })),
  [PromptSource.Figma]: async (scope, canvasId, value) => {
    const out = await importFigmaInto(actorOf(scope), canvasId, { url: value, nodeIds: null, at: ORIGIN });
    return out.outcome === FigmaOutcome.Ok ? { frameIds: out.frameIds } : { refusal: out.outcome };
  }
};

export async function importSource(scope: SourceScope, canvasId: string, pick: SourcePick): Promise<Landed> {
  const what = `${PROMPT_SOURCES[pick.source].label.replace(/^Import from /, '')} ${pick.value}`;
  return { what, ...(await IMPORTERS[pick.source](scope, canvasId, pick.value)) };
}
