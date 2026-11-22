import type { Db } from '$lib/server/db/client';
import type { Database } from '$lib/database.types';
import { modeOf, type ProjectMode } from '$lib/project-mode';

type ProjectRow = Database['public']['Tables']['projects']['Row'];

export type Project = {
  id: string;
  name: string;
  slug: string;
  archivedAt: string | null;
  lastActiveAt: string;
  mode: ProjectMode;
};

const PROJECT_COLUMNS = 'id, name, slug, archived_at, updated_at, mode';

type ProjectColumns = Pick<ProjectRow, 'id' | 'name' | 'slug' | 'archived_at' | 'updated_at' | 'mode'>;

function toProject(row: ProjectColumns, lastActiveAt: string = row.updated_at): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
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
