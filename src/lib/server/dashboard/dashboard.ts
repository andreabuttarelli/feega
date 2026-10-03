import type { Db } from '$lib/server/db/client';
import { listProjects } from '$lib/server/repos/projects';
import { listRecentBatches, listRecentCanvases, listRecentImages, listRecentNodes } from '$lib/server/repos/dashboard';
import { signedAssets } from '$lib/server/studio/studio-media';
import { canvasPath } from '$lib/server/tenancy/entry';
import { motionEditorPath } from '$lib/canvas/motion-node';
import { ProjectMode } from '$lib/project-mode';

export type DashboardDeps = {
  listProjects: typeof listProjects;
  listRecentCanvases: typeof listRecentCanvases;
  listRecentImages: typeof listRecentImages;
  listRecentBatches: typeof listRecentBatches;
  listRecentNodes: typeof listRecentNodes;
  signImages: (db: Db, orgId: string, ids: string[]) => Promise<Record<string, string | null>>;
};

export const DASHBOARD_DEPS: DashboardDeps = {
  listProjects,
  listRecentCanvases,
  listRecentImages,
  listRecentBatches,
  listRecentNodes,
  signImages: async (db, orgId, ids) => (await signedAssets(db, orgId, ids, 'pickerTile')).urls
};

export type DashboardProject = {
  id: string;
  name: string;
  href: string;
  updatedAt: string;
  canvases: { id: string; name: string; href: string }[];
  thumbs: string[];
};

export type DashboardBatch = { id: string; name: string; status: string; createdAt: string; projectName: string; href: string };

export type DashboardMotion = { id: string; name: string; projectName: string; updatedAt: string; poster: string | null; href: string };

export type Dashboard = { projects: DashboardProject[]; batches: DashboardBatch[]; motions: DashboardMotion[] };

const PROJECT_LIMIT = 12;
const CANVASES_PER_PROJECT = 3;
const THUMBS_PER_PROJECT = 4;
const CANVAS_SCAN = 60;
const IMAGE_SCAN = 120;
const OUTPUT_LIMIT = 8;
const UNTITLED_VIDEO = 'Untitled video';

function firstPerProject<T extends { projectId: string }>(rows: T[], perProject: number): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.projectId) ?? [];
    if (list.length < perProject) {
      grouped.set(row.projectId, [...list, row]);
    }
  }
  return grouped;
}

function posterOf(data: Record<string, unknown>): string | null {
  return typeof data.posterAssetId === 'string' ? data.posterAssetId : null;
}

export async function dashboardFor(db: Db, deps: DashboardDeps, orgId: string): Promise<Dashboard> {
  const [allProjects, canvases, images, batches, motionNodes] = await Promise.all([
    deps.listProjects(db, orgId),
    deps.listRecentCanvases(db, { orgId, limit: CANVAS_SCAN }),
    deps.listRecentImages(db, { orgId, limit: IMAGE_SCAN }),
    deps.listRecentBatches(db, { orgId, limit: OUTPUT_LIMIT * 2 }),
    deps.listRecentNodes(db, { orgId, type: 'motion', limit: OUTPUT_LIMIT * 2 })
  ]);

  const projects = allProjects.filter((p) => p.mode === ProjectMode.Standard).slice(0, PROJECT_LIMIT);
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const visible = <T extends { projectId: string }>(rows: T[]) => rows.filter((r) => names.has(r.projectId)).slice(0, OUTPUT_LIMIT);

  const canvasesOf = firstPerProject(canvases, CANVASES_PER_PROJECT);
  const imagesOf = firstPerProject(images.filter((i) => names.has(i.projectId)), THUMBS_PER_PROJECT);
  const motions = visible(motionNodes);
  const posterIds = motions.map((m) => posterOf(m.data)).filter((id): id is string => Boolean(id));
  const urls = await deps.signImages(db, orgId, [...[...imagesOf.values()].flat().map((i) => i.id), ...posterIds]);

  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      href: `/p/${p.id}`,
      updatedAt: p.lastActiveAt,
      canvases: (canvasesOf.get(p.id) ?? []).map((c) => ({ id: c.id, name: c.name, href: canvasPath(p.id, c.id) })),
      thumbs: (imagesOf.get(p.id) ?? []).map((i) => urls[i.id]).filter((url): url is string => Boolean(url))
    })),
    batches: visible(batches).map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      createdAt: b.createdAt,
      projectName: names.get(b.projectId)!,
      href: `/app/studio/${b.id}`
    })),
    motions: motions.map((m) => {
      const poster = posterOf(m.data);
      return {
        id: m.id,
        name: m.name ?? UNTITLED_VIDEO,
        projectName: names.get(m.projectId)!,
        updatedAt: m.updatedAt,
        poster: poster ? (urls[poster] ?? null) : null,
        href: motionEditorPath({ projectId: m.projectId, canvasId: m.canvasId, nodeId: m.id })
      };
    })
  };
}
