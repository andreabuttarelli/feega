import type { Db } from '$lib/server/db/client';

export enum FontStyle {
  Normal = 'normal',
  Italic = 'italic'
}

export type OrgFont = { id: string; orgId: string; family: string; weight: number; style: FontStyle; path: string; uploadedBy: string | null; createdAt: string };

type OrgFontRow = { id: string; org_id: string; family: string; weight: number; style: string; path: string; uploaded_by: string | null; created_at: string };

const COLUMNS = 'id, org_id, family, weight, style, path, uploaded_by, created_at';

const toOrgFont = (row: OrgFontRow): OrgFont => ({
  id: row.id,
  orgId: row.org_id,
  family: row.family,
  weight: row.weight,
  style: row.style === FontStyle.Italic ? FontStyle.Italic : FontStyle.Normal,
  path: row.path,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at
});

export async function insertOrgFont(db: Db, font: Omit<OrgFont, 'createdAt'>): Promise<void> {
  const { error } = await db.from('org_fonts').insert({ id: font.id, org_id: font.orgId, family: font.family, weight: font.weight, style: font.style, path: font.path, uploaded_by: font.uploadedBy });
  if (error) {
    throw error;
  }
}

export async function listOrgFonts(db: Db, orgId: string): Promise<OrgFont[]> {
  const { data, error } = await db.from('org_fonts').select(COLUMNS).eq('org_id', orgId).order('family');
  if (error) {
    throw error;
  }
  return ((data ?? []) as OrgFontRow[]).map(toOrgFont);
}

export async function renameOrgFont(db: Db, input: { orgId: string; id: string; family: string }): Promise<void> {
  const { error } = await db.from('org_fonts').update({ family: input.family }).eq('org_id', input.orgId).eq('id', input.id);
  if (error) {
    throw error;
  }
}

export async function deleteOrgFont(db: Db, input: { orgId: string; id: string }): Promise<void> {
  const { error } = await db.from('org_fonts').delete().eq('org_id', input.orgId).eq('id', input.id);
  if (error) {
    throw error;
  }
}
