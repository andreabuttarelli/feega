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

const UNAVAILABLE = 'Code import is not available right now.';

const IMPORT_REFUSAL_TEXT: Record<string, string> = {
  [CodeImportOutcome.Invalid]: 'That source could not be read as an app.',
  [CodeImportOutcome.NoSandbox]: UNAVAILABLE,
  [CodeImportOutcome.NoBrowser]: UNAVAILABLE,
  [CodeImportOutcome.RunFailed]: 'The app could not be started. A private repository needs GitHub connected.',
  [CodeImportOutcome.Failed]: 'The page could not be opened.',
  [CodeImportOutcome.Unreadable]: 'Nothing on that page could be read.',
  [CodeImportOutcome.RateLimited]: 'Too many imports in a short time. Try again shortly.',
  [CodeImportOutcome.ChooseApp]: 'This repository holds several apps. Import it from the canvas and pick one.',
  [FigmaOutcome.Rejected]: 'Figma refused the connection. Reconnect Figma.',
  [FigmaOutcome.NoToken]: 'Figma is not connected.',
  [FigmaOutcome.NotFound]: 'That Figma file was not found.',
  [FigmaOutcome.BadLink]: 'That is not a Figma file link.',
  [FigmaOutcome.NoFrames]: 'That Figma file has no frames to import.',
  [FigmaOutcome.Unavailable]: 'Figma is not reachable right now.'
};

const FALLBACK_REFUSAL = 'The import could not be completed.';

const refusalText = (outcome: string) => IMPORT_REFUSAL_TEXT[outcome] ?? FALLBACK_REFUSAL;

const SHOWS_VALUE: Record<PromptSource, boolean> = {
  [PromptSource.Github]: true,
  [PromptSource.Folder]: true,
  [PromptSource.Upload]: false,
  [PromptSource.Figma]: true
};

const actorOf = (scope: SourceScope) => ({ ...scope, actor: { kind: 'user' as const, id: scope.userId } });

const fromCode = async (done: ReturnType<typeof importCodeInto>) => {
  const out = await done;
  return out.outcome === CodeImportOutcome.Ok ? { frameIds: [out.frameId] } : { refusal: refusalText(out.outcome) };
};

const IMPORTERS: Record<PromptSource, Importer> = {
  [PromptSource.Github]: (scope, canvasId, value) => fromCode(importCodeInto(actorOf(scope), canvasId, { repo: value, routes: [], at: ORIGIN })),
  [PromptSource.Folder]: (scope, canvasId, value) => fromCode(importCodeInto(actorOf(scope), canvasId, { folder: value, routes: [], at: ORIGIN })),
  [PromptSource.Upload]: (scope, canvasId, value) => fromCode(importCodeInto(actorOf(scope), canvasId, { upload: value, routes: [], at: ORIGIN })),
  [PromptSource.Figma]: async (scope, canvasId, value) => {
    const out = await importFigmaInto(actorOf(scope), canvasId, { url: value, nodeIds: null, at: ORIGIN });
    return out.outcome === FigmaOutcome.Ok ? { frameIds: out.frameIds } : { refusal: refusalText(out.outcome) };
  }
};

export async function importSource(scope: SourceScope, canvasId: string, pick: SourcePick): Promise<Landed> {
  const label = PROMPT_SOURCES[pick.source].label.replace(/^Import from /, '');
  const what = SHOWS_VALUE[pick.source] ? `${label} ${pick.value}` : label;
  return { what, ...(await IMPORTERS[pick.source](scope, canvasId, pick.value)) };
}
