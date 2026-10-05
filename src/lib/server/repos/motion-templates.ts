import type { Db } from '$lib/server/db/client';
import { motionTemplateSchema, type MotionTemplate, type TemplateEntry } from '$lib/motion/template/library';
import { actorCols, type Actor } from './actor';

type TemplateRow = { id: string; name: string; description: string; doc: unknown };

const COLUMNS = 'id, name, description, doc';

function entryOf(row: TemplateRow): TemplateEntry | null {
  const parsed = motionTemplateSchema.safeParse({ name: row.name, description: row.description, doc: row.doc });
  return parsed.success ? { id: row.id, template: parsed.data } : null;
}

export async function listOrgTemplates(db: Db, orgId: string): Promise<TemplateEntry[]> {
  const { data, error } = await db.from('motion_templates').select(COLUMNS).eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) {
    throw error;
  }
  return ((data ?? []) as TemplateRow[]).map(entryOf).filter((e): e is TemplateEntry => e !== null);
}

export async function insertOrgTemplate(db: Db, input: { orgId: string; template: MotionTemplate; posterFrame: number; actor: Actor }): Promise<TemplateEntry> {
  const { data, error } = await db
    .from('motion_templates')
    .insert({
      org_id: input.orgId,
      name: input.template.name,
      description: input.template.description,
      doc: input.template.doc,
      poster_frame: Math.max(0, Math.round(input.posterFrame)),
      ...actorCols(input.actor)
    } as never)
    .select('id')
    .single();
  if (error) {
    throw error;
  }
  return { id: (data as { id: string }).id, template: input.template };
}

export async function deleteOrgTemplate(db: Db, input: { orgId: string; id: string }): Promise<boolean> {
  const { data, error } = await db.from('motion_templates').delete().eq('org_id', input.orgId).eq('id', input.id).select('id');
  if (error) {
    throw error;
  }
  return Boolean(data?.length);
}
