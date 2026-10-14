import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import { agentActor, type Actor } from '$lib/server/repos/actor';
import { findProjectById, listProjects } from '$lib/server/repos/projects';
import { motionEditorPath } from '$lib/canvas/motion-node';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { MOTION_FORMATS, MotionFormat } from '$lib/motion/doc';
import { setStill } from '$lib/motion/still';
import type { TemplateEntry } from '$lib/motion/template/library';
import { composedTemplate } from '$lib/canvas/composition-template';
import type { UpstreamCard } from '$lib/canvas/composition-node';
import { MOTION_START_DEPS, startMotion, type CanvasPick, type MotionStart, type MotionStartDeps } from './start';
import { saveMotionDoc } from './editor';
import { templateLibrary } from './templates';

const ID_LENGTH = 8;
const API_AGENT_KEY = 'mcp';
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

export enum FromTemplate {
  Started = 'started',
  Unknown = 'unknown',
  NoCanvas = 'no_canvas',
  Invalid = 'invalid'
}

export type FromTemplateResult =
  | { outcome: FromTemplate.Started; start: MotionStart; version: number }
  | { outcome: FromTemplate.Unknown }
  | { outcome: FromTemplate.NoCanvas }
  | { outcome: FromTemplate.Invalid; error: string };

export type FromTemplateDeps = MotionStartDeps & {
  templates: (db: Db, scope: { orgId: string; actor: Actor }) => Promise<TemplateEntry[]>;
  save: typeof saveMotionDoc;
};

export const FROM_TEMPLATE_DEPS: FromTemplateDeps = {
  ...MOTION_START_DEPS,
  templates: (db, scope) => templateLibrary(db, scope).list(),
  save: saveMotionDoc
};

export const fromTemplateBody = z.object({
  template: z.string().min(1),
  format: z.enum(MOTION_FORMATS).default(MotionFormat.Landscape),
  project: z.string().optional(),
  still: z.number().min(0).optional()
});

type Input = { orgId: string; projectId: string; canvasId?: string | null; userId: string; templateId: string; format: MotionFormat; still?: number; values?: Record<string, string>; wired?: UpstreamCard[]; at?: { x: number; y: number }; actor?: Actor; pick?: CanvasPick };

const newId = () => crypto.randomUUID().slice(0, ID_LENGTH);

export async function startFromTemplate(db: Db, deps: FromTemplateDeps, input: Input): Promise<FromTemplateResult> {
  const actor = input.actor ?? { kind: 'user', id: input.userId };
  const entry = (await deps.templates(db, { orgId: input.orgId, actor })).find((e) => e.id === input.templateId);
  if (!entry) {
    return { outcome: FromTemplate.Unknown };
  }

  const composed = composedTemplate(entry, { format: input.format, values: input.values ?? {} }, input.wired ?? [], newId);
  const placed = composed.ok && input.still !== undefined ? setStill(composed.doc, input.still) : composed;
  if (!placed.ok) {
    return { outcome: FromTemplate.Invalid, error: placed.error };
  }

  const start = await startMotion(db, deps, { orgId: input.orgId, projectId: input.projectId, canvasId: input.canvasId ?? null, userId: input.userId, name: entry.template.name, format: input.format, at: input.at, picture: placed.doc, actor, pick: input.pick });
  if (!start) {
    return { outcome: FromTemplate.NoCanvas };
  }

  const write = await deps.save(db, { orgId: input.orgId, nodeId: start.nodeId, expectedVersion: 0, doc: placed.doc, actor, summary: `Started from ${entry.template.name}` });
  if (write.outcome !== RevisionOutcome.Written) {
    return { outcome: FromTemplate.Invalid, error: write.outcome === RevisionOutcome.Invalid ? write.error : 'conflict' };
  }
  return { outcome: FromTemplate.Started, start, version: write.head.version };
}

export const FROM_TEMPLATE_STATUS: Record<Exclude<FromTemplate, FromTemplate.Started>, number> = {
  [FromTemplate.Unknown]: HTTP_NOT_FOUND,
  [FromTemplate.NoCanvas]: HTTP_NOT_FOUND,
  [FromTemplate.Invalid]: HTTP_BAD_REQUEST
};

export const FROM_TEMPLATE_ERROR: Record<Exclude<FromTemplate, FromTemplate.Started>, string> = {
  [FromTemplate.Unknown]: 'That component no longer exists',
  [FromTemplate.NoCanvas]: 'No canvas for this video',
  [FromTemplate.Invalid]: 'That component could not start a video'
};

async function apiProject(db: Db, orgId: string, wanted: string | undefined): Promise<string | null> {
  if (wanted) {
    return (await findProjectById(db, { orgId, projectId: wanted }))?.id ?? null;
  }
  return (await listProjects(db, orgId))[0]?.id ?? null;
}

export async function videoFromTemplate(db: Db, scope: { orgId: string; userId: string }, raw: unknown): Promise<Record<string, unknown> | Response> {
  const body = fromTemplateBody.safeParse(raw);
  if (!body.success) {
    return json({ error: 'invalid_from_template_request' }, { status: HTTP_BAD_REQUEST });
  }
  const projectId = await apiProject(db, scope.orgId, body.data.project);
  if (!projectId) {
    return json({ error: 'project_not_found' }, { status: HTTP_NOT_FOUND });
  }

  const actor = agentActor(scope.userId, API_AGENT_KEY);
  const started = await startFromTemplate(db, FROM_TEMPLATE_DEPS, { ...scope, projectId, templateId: body.data.template, format: body.data.format, still: body.data.still, actor });
  if (started.outcome !== FromTemplate.Started) {
    return json({ error: FROM_TEMPLATE_ERROR[started.outcome] }, { status: FROM_TEMPLATE_STATUS[started.outcome] });
  }
  const { start } = started;
  return { node_id: start.nodeId, project_id: start.projectId, canvas_id: start.canvasId, version: started.version, editor_url: motionEditorPath(start) };
}
