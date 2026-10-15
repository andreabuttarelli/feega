import type { Db } from '$lib/server/db/client';
import type { Database } from '$lib/database.types';
import { modeOf, ProjectMode } from '$lib/project-mode';

/**
 * I PROGETTI DI UN'ORG.
 *
 * `brandId` è nullable e resta tale: si apre una tela per esplorare, e solo quando il materiale
 * diventa qualcosa da pubblicare si decide per chi. Assegnarlo dopo è un `UPDATE` e basta — i
 * nodi non portano il brand, quindi non c'è niente da riscrivere.
 */
type ProjectRow = Database['public']['Tables']['projects']['Row'];

export type Project = {
  id: string;
  name: string;
  slug: string;
  brandId: string | null;
  archivedAt: string | null;
  lastActiveAt: string;
  mode: ProjectMode;
};

const PROJECT_COLUMNS = 'id, name, slug, brand_id, archived_at, updated_at, mode';

type ProjectColumns = Pick<ProjectRow, 'id' | 'name' | 'slug' | 'brand_id' | 'archived_at' | 'updated_at' | 'mode'>;

function toProject(row: ProjectColumns, lastActiveAt: string = row.updated_at): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brandId: row.brand_id,
    archivedAt: row.archived_at,
    lastActiveAt,
    mode: modeOf(row.mode)
  };
}

export async function listProjects(db: Db, orgId: string): Promise<Project[]> {
  const { data, error } = await db
    .from('projects')
    .select(`${PROJECT_COLUMNS}, last_edited_at`)
    .eq('org_id', orgId)
    .is('archived_at', null)
    .order('last_edited_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toProject(row, row.last_edited_at));
}

export async function findProjectBySlug(
  db: Db,
  input: { orgId: string; slug: string }
): Promise<Project | null> {
  const { data, error } = await db
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('org_id', input.orgId)
    .eq('slug', input.slug)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? toProject(data) : null;
}

export async function findProjectById(
  db: Db,
  input: { orgId: string; projectId: string }
): Promise<Project | null> {
  const { data, error } = await db
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('org_id', input.orgId)
    .eq('id', input.projectId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? toProject(data) : null;
}

export async function createProject(
  db: Db,
  input: { orgId: string; name: string; slug: string; brandId?: string | null; mode?: ProjectMode }
): Promise<Project> {
  const { data, error } = await db
    .from('projects')
    .insert({
      org_id: input.orgId,
      name: input.name,
      slug: input.slug,
      brand_id: input.brandId ?? null,
      mode: input.mode ?? ProjectMode.Standard
    })
    .select(PROJECT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }
  return toProject(data);
}

export async function renameProject(
  db: Db,
  input: { orgId: string; projectId: string; name: string }
): Promise<void> {
  const { error } = await db
    .from('projects')
    .update({ name: input.name, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .eq('org_id', input.orgId);

  if (error) {
    throw error;
  }
}

export async function setProjectBrand(
  db: Db,
  input: { orgId: string; projectId: string; brandId: string | null }
): Promise<void> {
  const { error } = await db
    .from('projects')
    .update({ brand_id: input.brandId, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .eq('org_id', input.orgId);

  if (error) {
    throw error;
  }
}

export async function archiveProject(
  db: Db,
  input: { orgId: string; projectId: string }
): Promise<void> {
  const { error } = await db
    .from('projects')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .eq('org_id', input.orgId);

  if (error) {
    throw error;
  }
}
