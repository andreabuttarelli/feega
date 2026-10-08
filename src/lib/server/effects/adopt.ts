import type { Db } from '$lib/server/db/client';
import type { MotionDoc } from '$lib/motion/doc';
import { freeName, rewireShaders } from '$lib/motion/shaders/model';
import { createEffect, listEffects, Outcome } from '$lib/server/repos/effects';
import type { Actor } from '$lib/server/repos/actor';

const AGENT = 'agent';

export type WorkspaceAuthor = { kind: 'user' | 'agent'; id: string; agentKey?: string };

export function workspaceAuthor(scope: { userId: string; actor: Actor }): WorkspaceAuthor {
  return { kind: scope.actor.kind === AGENT ? AGENT : 'user', id: scope.userId, agentKey: scope.actor.agentKey ?? undefined };
}

export async function adoptShaders(db: Db, scope: { orgId: string; author: WorkspaceAuthor }, doc: MotionDoc): Promise<MotionDoc> {
  const { orgId, author } = scope;
  const entries = Object.entries(doc.shaders);
  if (!entries.length) {
    return doc;
  }

  const existing = await listEffects(db, orgId);
  if (!existing) {
    return doc;
  }

  const taken = new Set(existing.map((e) => e.name));
  const refs: Record<string, string> = {};
  const renamed: Record<string, string> = {};
  for (const [ref, def] of entries) {
    const name = freeName(def.name, taken);
    const written = await createEffect(db, orgId, author, { name, frag: def.frag, params: def.params });
    if (written.outcome !== Outcome.Ok) {
      continue;
    }

    taken.add(name);
    refs[ref] = written.effect.id;
    renamed[ref] = name;
  }

  return rewireShaders(doc, refs, renamed);
}
