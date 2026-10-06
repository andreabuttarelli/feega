import type { Db } from '$lib/server/db/client';
import type { MotionDoc } from '$lib/motion/doc';
import { BUILTIN_PREFIX, BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { templateFromComp, templateFromDoc, type TemplateEntry, type TemplateMeta } from '$lib/motion/template/library';
import { deleteOrgTemplate, insertOrgTemplate, listOrgTemplates } from '$lib/server/repos/motion-templates';
import type { Actor } from '$lib/server/repos/actor';

export type SaveRequest = { doc: MotionDoc; compId: string | null; meta: TemplateMeta; posterFrame: number };
export type Saved = { ok: true; entry: TemplateEntry } | { ok: false; error: string };

export type TemplateLibrary = {
  list: () => Promise<TemplateEntry[]>;
  save: (request: SaveRequest) => Promise<Saved>;
  remove: (id: string) => Promise<boolean>;
};

export function templateLibrary(db: Db, scope: { orgId: string; actor: Actor }): TemplateLibrary {
  return {
    list: async () => [...BUILTIN_TEMPLATES, ...(await listOrgTemplates(db, scope.orgId))],
    save: async (request) => {
      const made = request.compId ? templateFromComp(request.doc, request.compId, request.meta) : templateFromDoc(request.doc, request.meta);
      if (!made.ok) {
        return made;
      }
      const entry = await insertOrgTemplate(db, { orgId: scope.orgId, template: made.template, posterFrame: request.posterFrame, actor: scope.actor });
      return { ok: true, entry };
    },
    remove: async (id) => !id.startsWith(BUILTIN_PREFIX) && (await deleteOrgTemplate(db, { orgId: scope.orgId, id }))
  };
}
