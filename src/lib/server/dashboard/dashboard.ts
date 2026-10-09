import type { Db } from '$lib/server/db/client';
import { listProjects } from '$lib/server/repos/projects';
import { listRecentBatches, listRecentCanvases, listRecentImages, listRecentNodes, type RecentNode } from '$lib/server/repos/dashboard';
import { signedAssets } from '$lib/server/studio/studio-media';
import { canvasPath } from '$lib/server/tenancy/entry';
import { motionEditorPath, motionOf } from '$lib/canvas/motion-node';
import type { MotionFormat } from '$lib/motion/doc';
import { ProjectMode } from '$lib/project-mode';

export type DashboardDeps = {
  listProjects: typeof listProjects;
  listRecentCanvases: typeof listRecentCanvases;
  listRecentImages: typeof listRecentImages;
  listRecentBatches: typeof listRecentBatches;
  listRecentNodes: typeof listRecentNodes;
  signImages: (db: Db, orgId: string, ids: string[]) => Promise<Record<string, string | null>>;
  signVideos: (db: Db, orgId: string, ids: string[]) => Promise<Record<string, string | null>>;
};

export const DASHBOARD_DEPS: DashboardDeps = {
  listProjects,
  listRecentCanvases,
  listRecentImages,
  listRecentBatches,
  listRecentNodes,
  signImages: async (db, orgId, ids) => (await signedAssets(db, orgId, ids, 'pickerTile')).urls,
  signVideos: async (db, orgId, ids) => (await signedAssets(db, orgId, ids)).urls
};

export type DashboardProject = {
  id: string;
  name: string;
  href: string;
  updatedAt: string;
  canvases: { id: string; name: string; href: string }[];
  thumbs: string[];
  videoCount: number;
  posters: string[];
};

export type DashboardBatch = { id: string; name: string; status: string; createdAt: string; projectName: string; href: string };

export type DashboardMotion = {
  id: string;
  name: string;
  projectName: string;
  updatedAt: string;
  format: MotionFormat;
  poster: string | null;
  preview: string | null;
  href: string;
};

export type Dashboard = { projects: DashboardProject[]; batches: DashboardBatch[]; motions: DashboardMotion[]; moreVideos: string | null };

export type VideoPage = { videos: DashboardMotion[]; more: string | null };

export const VIDEO_PAGE = 20;

const PROJECT_LIMIT = 12;
const CANVASES_PER_PROJECT = 3;
const THUMBS_PER_PROJECT = 4;
const CANVAS_SCAN = 60;
const IMAGE_SCAN = 120;
const OUTPUT_LIMIT = 8;
const MOTION_SCAN = 200;
const POSTERS_PER_PROJECT = 4;
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

type Signed = Record<string, string | null>;

function cardOf(node: RecentNode, projectName: string, images: Signed, videos: Signed): DashboardMotion {
  const motion = motionOf({ id: node.id, type: 'motion', data: node.data })!;
  return {
    id: node.id,
    name: node.name ?? UNTITLED_VIDEO,
    projectName,
    updatedAt: node.updatedAt,
    format: motion.format,
    poster: motion.posterAssetId ? (images[motion.posterAssetId] ?? null) : null,
    preview: motion.lastRenderAssetId ? (videos[motion.lastRenderAssetId] ?? null) : null,
    href: motionEditorPath({ projectId: node.projectId, canvasId: node.canvasId, nodeId: node.id })
  };
}

const posterIdOf = (node: RecentNode) => motionOf({ id: node.id, type: 'motion', data: node.data })!.posterAssetId;
const renderIdOf = (node: RecentNode) => motionOf({ id: node.id, type: 'motion', data: node.data })!.lastRenderAssetId;
const present = (id: string | null): id is string => Boolean(id);

function pageOf(nodes: RecentNode[]): { page: RecentNode[]; more: string | null } {
  const page = nodes.slice(0, VIDEO_PAGE);
  return { page, more: nodes.length > VIDEO_PAGE ? page.at(-1)!.updatedAt : null };
}

function standardNames(projects: Awaited<ReturnType<typeof listProjects>>): Map<string, string> {
  return new Map(projects.filter((p) => p.mode === ProjectMode.Standard).map((p) => [p.id, p.name]));
}

export async function videoPage(db: Db, deps: DashboardDeps, orgId: string, before: string): Promise<VideoPage> {
  const [allProjects, nodes] = await Promise.all([deps.listProjects(db, orgId), deps.listRecentNodes(db, { orgId, type: 'motion', limit: VIDEO_PAGE + 1, before })]);
  const names = standardNames(allProjects);
  const { page, more } = pageOf(nodes);
  const visible = page.filter((n) => names.has(n.projectId));
  const [images, videos] = await Promise.all([deps.signImages(db, orgId, visible.map(posterIdOf).filter(present)), deps.signVideos(db, orgId, visible.map(renderIdOf).filter(present))]);
  return { videos: visible.map((n) => cardOf(n, names.get(n.projectId)!, images, videos)), more };
}

export async function dashboardFor(db: Db, deps: DashboardDeps, orgId: string): Promise<Dashboard> {
  const [allProjects, canvases, images, batches, motionNodes] = await Promise.all([
    deps.listProjects(db, orgId),
    deps.listRecentCanvases(db, { orgId, limit: CANVAS_SCAN }),
    deps.listRecentImages(db, { orgId, limit: IMAGE_SCAN }),
    deps.listRecentBatches(db, { orgId, limit: OUTPUT_LIMIT * 2 }),
    deps.listRecentNodes(db, { orgId, type: 'motion', limit: MOTION_SCAN })
  ]);

  const projects = allProjects.filter((p) => p.mode === ProjectMode.Standard).slice(0, PROJECT_LIMIT);
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const visible = <T extends { projectId: string }>(rows: T[]) => rows.filter((r) => names.has(r.projectId)).slice(0, OUTPUT_LIMIT);

  const canvasesOf = firstPerProject(canvases, CANVASES_PER_PROJECT);
  const imagesOf = firstPerProject(images.filter((i) => names.has(i.projectId)), THUMBS_PER_PROJECT);
  const ownMotions = motionNodes.filter((n) => names.has(n.projectId));
  const { page, more } = pageOf(motionNodes);
  const motions = page.filter((n) => names.has(n.projectId));
  const postersOf = firstPerProject(ownMotions.filter((n) => posterIdOf(n)), POSTERS_PER_PROJECT);
  const posterIds = [...motions, ...[...postersOf.values()].flat()].map(posterIdOf).filter(present);
  const [urls, videos] = await Promise.all([
    deps.signImages(db, orgId, [...new Set([...[...imagesOf.values()].flat().map((i) => i.id), ...posterIds])]),
    deps.signVideos(db, orgId, motions.map(renderIdOf).filter(present))
  ]);

  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      href: `/p/${p.id}`,
      updatedAt: p.lastActiveAt,
      canvases: (canvasesOf.get(p.id) ?? []).map((c) => ({ id: c.id, name: c.name, href: canvasPath(p.id, c.id) })),
      thumbs: (imagesOf.get(p.id) ?? []).map((i) => urls[i.id]).filter(present),
      videoCount: ownMotions.filter((n) => n.projectId === p.id).length,
      posters: (postersOf.get(p.id) ?? []).map((n) => urls[posterIdOf(n)!]).filter(present)
    })),
    batches: visible(batches).map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      createdAt: b.createdAt,
      projectName: names.get(b.projectId)!,
      href: `/app/studio/${b.id}`
    })),
    motions: motions.map((n) => cardOf(n, names.get(n.projectId)!, urls, videos)),
    moreVideos: more
  };
}
