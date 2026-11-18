import type { CodeScope } from '$lib/server/code-import/canvas-import';
import { FramesRefusal, type FramesDeps, type FramesRefused } from './frames-push';
import { entryPath } from './link';

export enum ConflictChoice {
  KeepCanvas = 'keep_canvas',
  Agent = 'agent'
}

export type ConflictFile = { path: string; base: string; canvas: string; github: string };

export type Conflicts = { ok: true; files: ConflictFile[]; head: string };

export type Resolved = { ok: true; kept: string } | { ok: false; refusal: 'agent_unavailable'; prompt: string } | FramesRefused;

const refused = (refusal: FramesRefused['refusal']): FramesRefused => ({ ok: false, refusal });

export async function frameConflicts(deps: FramesDeps, scope: CodeScope, nodeId: string): Promise<Conflicts | FramesRefused> {
  const link = await deps.links.read(nodeId);
  const host = link ? await deps.host(link.source, link.repo) : null;
  if (!link) {
    return refused(FramesRefusal.NotLinked);
  }
  if (!host) {
    return refused(FramesRefusal.NotConnected);
  }

  const head = await host.headOf(link.baseBranch);
  const upstream = new Set((await host.changedSince(link.keptSha ?? link.baseSha, head)).map((c) => c.path));
  const edits = await deps.edits(scope, nodeId);
  const mine = typeof edits === 'string' ? [] : edits.files.filter((f) => upstream.has(f.path));
  const files = await Promise.all(mine.map(async (f) => ({ path: f.path, base: (await host.readFile(f.path, link.baseSha)) ?? '', canvas: f.content, github: (await host.readFile(f.path, head)) ?? '' })));
  return { ok: true, files, head };
}

const promptOf = (entry: string, files: ConflictFile[]) =>
  [`Merge the canvas edits of ${entry} with the GitHub changes, keeping both where they do not touch the same thing.`, ...files.map((f) => `--- ${f.path}\n# base\n${f.base}\n# canvas\n${f.canvas}\n# github\n${f.github}`)].join('\n\n');

export async function frameResolve(deps: FramesDeps, scope: CodeScope, nodeId: string, choice: ConflictChoice): Promise<Resolved> {
  const split = await frameConflicts(deps, scope, nodeId);
  if (!split.ok) {
    return split;
  }
  const link = (await deps.links.read(nodeId))!;
  if (choice === ConflictChoice.Agent) {
    return { ok: false, refusal: 'agent_unavailable', prompt: promptOf(entryPath(link), split.files) };
  }

  await Promise.all((await deps.links.all(nodeId)).map((l) => deps.links.save(nodeId, { ...l, keptSha: split.head })));
  return { ok: true, kept: split.head };
}
