import type { Db } from '$lib/server/db/client';
import type { ShaderParam, TextEdit } from '@feega/shader-fx';
import {
  CheckState,
  createEffect,
  findEffect,
  findEffectByName,
  listEffects,
  Outcome,
  patchEffect,
  recordCheck,
  type Actor,
  type StoredEffect,
  type Written
} from '$lib/server/repos/effects';
import { checkEffect, type GlPage } from './check';

export type EffectDraft = { name: string; frag: string; params: ShaderParam[] };

export type EffectEdit = { effectId: string; version: number; edits?: TextEdit[]; params?: ShaderParam[] };

export type EffectStore = {
  write: (draft: EffectDraft) => Promise<Written>;
  patch: (edit: EffectEdit) => Promise<Written>;
  list: () => Promise<StoredEffect[] | null>;
  find: (id: string) => Promise<StoredEffect | null>;
};

type StoreScope = { db: Db; orgId: string; actor: Actor; gl: GlPage | null };

export function effectStore(scope: StoreScope): EffectStore {
  const { db, orgId, actor, gl } = scope;

  const checked = async (written: Written): Promise<Written> => {
    if (written.outcome !== Outcome.Ok || !gl || written.effect.check.state === CheckState.Failed) {
      return written;
    }

    const check = await checkEffect(gl, written.effect);
    if (check.state === CheckState.Unchecked) {
      return written;
    }

    const recorded = await recordCheck(db, orgId, written.effect.id, written.effect.version, check);
    return recorded ? { outcome: Outcome.Ok, effect: { ...written.effect, check } } : written;
  };

  return {
    write: async (draft) => {
      const existing = await findEffectByName(db, orgId, draft.name);
      const written = existing ? await patchEffect(db, orgId, existing.id, { version: existing.version, frag: draft.frag, params: draft.params }) : await createEffect(db, orgId, actor, draft);
      return checked(written);
    },
    patch: async (edit) => checked(await patchEffect(db, orgId, edit.effectId, { version: edit.version, edits: edit.edits, params: edit.params })),
    list: () => listEffects(db, orgId),
    find: (id) => findEffect(db, orgId, id)
  };
}
