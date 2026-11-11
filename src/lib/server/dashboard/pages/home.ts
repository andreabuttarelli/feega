import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad as PageServerLoad } from '@sveltejs/kit';
import { DASHBOARD_PATH, DEFAULT_CANVAS_NAME, DEFAULT_PROJECT_NAME, ENTRY_DEPS, canvasPath, homePathFor } from '$lib/server/tenancy/entry';
import { chooseOrg, LAST_PROJECT_COOKIE, ORG_COOKIE } from '$lib/server/tenancy/context';
import { takeCampaign } from '$lib/server/onboarding/campaign-cookie';
import { signedInDb } from '$lib/server/dashboard/app-shell';
import { listMemberships, setActiveOrg } from '$lib/server/repos/orgs';
import { createProject } from '$lib/server/repos/projects';
import { moveAssets } from '$lib/server/repos/assets';
import { createCanvas } from '$lib/server/repos/canvas';
import { SUPPORT_TOOLS } from '$lib/tools';
import { PROJECT_PARAM, toolScope } from '$lib/server/dashboard/tool-scope';
import { CanvasPick } from '$lib/server/motion/start';
import { handoffPath } from '$lib/canvas/chat-handoff';
import { loadAttachments } from '$lib/server/chat-attachments/register';
import { parseAttachments } from '$lib/chat-attachments';
import { FROM_TEMPLATE_DEPS, FROM_TEMPLATE_ERROR, FROM_TEMPLATE_STATUS, FromTemplate, fromTemplateBody, startFromTemplate } from '$lib/server/motion/from-template';
import { motionEditorPath } from '$lib/canvas/motion-node';
import { BRIEF_MAX, BRIEF_TEMPLATES, FILES_ONLY_BRIEF, briefName } from '$lib/motion/video-brief';
import { kindBrief, kindOf, urlIn, type Landed } from '$lib/home/prompt-kinds';
import { sourceOf, type SourcePick } from '$lib/home/prompt-sources';
import { importSource } from '$lib/server/dashboard/home-sources';
import { importUrlInto } from '$lib/server/url-import/canvas-import';
import { UrlImportOutcome } from '$lib/server/url-import/import-url';
import { assertPublicUrl } from '$lib/server/tool-guard';
import type { ToolScope } from '$lib/server/dashboard/tool-scope';
import { FeegaImport, importStoredCanvasFile, signCanvasFileUpload } from '$lib/server/canvas/feega-file';
import { FEEGA_REFUSAL_MESSAGE } from '$lib/canvas/feega-file';
import { startHandoff } from '$lib/server/home/handoff-start';
import { HANDOFF_NONCE, HANDOFF_RESUMED, HandoffStart } from '$lib/home/handoff';
import { ProductEvent, track } from '$lib/server/product-events/track';

const URL_SOURCE = 'url';

const HTTP_SEE_OTHER = 303;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const ORG_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;
const SLUG_BYTES = 4;

export const load = async (event: Parameters<PageServerLoad>[0]) => {
  const { db, user } = await signedInDb(event);
  const { cookies } = event;
  const campaign = takeCampaign(cookies);
  const { projects } = await event.parent();
  const recentProjectId = projects?.[0]?.id ?? null;

  if (campaign || !recentProjectId) {
    const path = await homePathFor(db, ENTRY_DEPS, user, cookies.get(ORG_COOKIE) ?? null, cookies.get(LAST_PROJECT_COOKIE) ?? null, campaign);
    if (path !== DASHBOARD_PATH) {
      throw redirect(HTTP_SEE_OTHER, path);
    }
  }

  const attachProjectId = await attachTarget(event, recentProjectId);
  const handoffStart = await resumeHandoff(event.url.searchParams, cookies, user.id);
  return { templates: BRIEF_TEMPLATES, tools: SUPPORT_TOOLS, attachProjectId, handoffStart };
};

async function resumeHandoff(params: URLSearchParams, cookies: Parameters<typeof startHandoff>[1], userId: string): Promise<HandoffStart> {
  const start = startHandoff(params, cookies);
  if (start === HandoffStart.None) {
    return start;
  }

  await track(ProductEvent.HandoffResumed, { userId, anonymousId: params.get(HANDOFF_NONCE) }, { autostart: start === HandoffStart.Send, viaLogin: params.has(HANDOFF_RESUMED) });
  return start;
}

async function attachTarget(event: Parameters<PageServerLoad>[0], recentProjectId: string | null): Promise<string | null> {
  if (recentProjectId && !event.url.searchParams.has(PROJECT_PARAM)) {
    return recentProjectId;
  }
  return toolScope(event).then((scope) => scope.projectId, () => null);
}

async function workspaceOf(event: Parameters<typeof signedInDb>[0] & { cookies: { get: (name: string) => string | undefined } }) {
  const { db, user } = await signedInDb(event);
  const membership = chooseOrg(await listMemberships(db, user.id), event.cookies.get(ORG_COOKIE) ?? null);
  return membership ? { db, userId: user.id, orgId: membership.org.id } : null;
}

function pickOf(form: FormData): SourcePick | null | undefined {
  const raw = form.get('source');
  const value = String(form.get('sourceValue') ?? '').trim();
  if (!raw || !value) {
    return null;
  }
  const source = sourceOf(raw);
  return source ? { source, value } : undefined;
}

async function importBriefUrl(scope: Pick<ToolScope, 'db' | 'orgId' | 'userId' | 'projectId'>, canvasId: string, brief: string): Promise<Landed | null> {
  const url = urlIn(brief);
  if (!url) {
    return null;
  }

  const done = await importUrlInto({ ...scope, actor: { kind: 'user', id: scope.userId } }, canvasId, { url, at: { x: 0, y: 0 }, guard: assertPublicUrl });
  if (done.outcome === UrlImportOutcome.Ok) {
    return { what: url, frameIds: [done.frameId] };
  }

  await track(ProductEvent.ImportFailed, { userId: scope.userId, orgId: scope.orgId }, { source: URL_SOURCE, error: done.outcome });
  return null;
}

function projectSlug(): string {
  const suffix = [...crypto.getRandomValues(new Uint8Array(SLUG_BYTES))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `project-${suffix}`;
}

export const actions: Actions = {
  video: async (event) => {
    const form = await event.request.formData();
    const typed = String(form.get('brief') ?? '').trim().slice(0, BRIEF_MAX);
    const attachmentIds = parseAttachments(form.getAll('attachment'));
    const kind = kindOf(form.get('kind'));
    const pick = pickOf(form);
    if (!kind || pick === undefined) {
      return fail(HTTP_BAD_REQUEST, { error: 'Pick what to make' });
    }
    if (!typed && !attachmentIds.length) {
      return fail(HTTP_BAD_REQUEST, { error: 'Paste a URL or describe what to make' });
    }

    const brief = typed || FILES_ONLY_BRIEF;
    const workspace = await workspaceOf(event);
    if (!workspace) {
      return fail(HTTP_NOT_FOUND, { error: 'No workspace' });
    }

    const uploadedIn = String(form.get('projectId') ?? '');
    const attachments = uploadedIn && attachmentIds.length ? await loadAttachments(workspace.db, { orgId: workspace.orgId, projectId: (await toolScope(event, uploadedIn)).projectId, ids: attachmentIds }) : [];
    const name = briefName(brief);
    const project = await createProject(workspace.db, { orgId: workspace.orgId, name, slug: projectSlug() });
    const assetIds = attachments.map((a) => a.assetId);
    await moveAssets(workspace.db, { orgId: workspace.orgId, projectId: project.id, ids: assetIds });

    const scope = { db: workspace.db, orgId: workspace.orgId, userId: workspace.userId, projectId: project.id };
    const canvas = await createCanvas(scope.db, { orgId: scope.orgId, projectId: project.id, name });
    const actor = { userId: scope.userId, orgId: scope.orgId };
    await track(ProductEvent.CanvasCreated, actor, { kind, source: pick?.source ?? null });
    const imported = pick ? await importSource(scope, canvas.id, pick) : await importBriefUrl(scope, canvas.id, brief);
    if (pick && imported && 'refusal' in imported) {
      await track(ProductEvent.ImportFailed, actor, { source: pick.source, error: imported.refusal });
    }

    throw redirect(HTTP_SEE_OTHER, handoffPath({ projectId: project.id, canvasId: canvas.id }, kindBrief(kind, brief, imported), assetIds));
  },

  fromTemplate: async (event) => {
    const form = await event.request.formData();
    const body = fromTemplateBody.safeParse({ template: form.get('template'), format: form.get('format') || undefined, project: form.get('projectId') || undefined });
    if (!body.success) {
      return fail(HTTP_BAD_REQUEST, { error: 'Pick a component and a format' });
    }

    const scope = await toolScope(event, body.data.project ?? null);
    const started = await startFromTemplate(scope.db, FROM_TEMPLATE_DEPS, { orgId: scope.orgId, projectId: scope.projectId, userId: scope.userId, templateId: body.data.template, format: body.data.format, pick: CanvasPick.New });
    if (started.outcome !== FromTemplate.Started) {
      return fail(FROM_TEMPLATE_STATUS[started.outcome], { error: FROM_TEMPLATE_ERROR[started.outcome] });
    }

    throw redirect(HTTP_SEE_OTHER, motionEditorPath(started.start));
  },

  project: async (event) => {
    const form = await event.request.formData();
    const chosen = String(form.get('projectId') ?? '');
    if (chosen) {
      const scope = await toolScope(event, chosen);
      const canvas = await createCanvas(scope.db, { orgId: scope.orgId, projectId: scope.projectId, name: DEFAULT_CANVAS_NAME });
      throw redirect(HTTP_SEE_OTHER, canvasPath(scope.projectId, canvas.id));
    }

    const { db, user } = await signedInDb(event);
    const membership = chooseOrg(await listMemberships(db, user.id), event.cookies.get(ORG_COOKIE) ?? null);
    if (!membership) {
      return fail(HTTP_NOT_FOUND, { error: 'No workspace' });
    }

    const name = String(form.get('name') ?? '').trim() || DEFAULT_PROJECT_NAME;
    const project = await createProject(db, { orgId: membership.org.id, name, slug: projectSlug() });
    const canvas = await createCanvas(db, { orgId: membership.org.id, projectId: project.id, name: DEFAULT_CANVAS_NAME });
    throw redirect(HTTP_SEE_OTHER, canvasPath(project.id, canvas.id));
  },

  request_canvas_import: async (event) => {
    const workspace = await workspaceOf(event);
    return workspace ? signCanvasFileUpload(workspace.db, workspace.orgId) : fail(HTTP_NOT_FOUND, { error: 'No workspace' });
  },

  import_canvas_file: async (event) => {
    const workspace = await workspaceOf(event);
    if (!workspace) {
      return fail(HTTP_NOT_FOUND, { error: 'No workspace' });
    }

    const { db, orgId, userId } = workspace;
    const path = String((await event.request.formData()).get('path') ?? '');
    const projectFor = async (name: string) => (await createProject(db, { orgId, name: name.trim() || DEFAULT_PROJECT_NAME, slug: projectSlug() })).id;
    const out = await importStoredCanvasFile(db, { orgId, projectFor, path, actor: { kind: 'user', id: userId } });
    if (out.outcome === FeegaImport.Refused) {
      return fail(HTTP_BAD_REQUEST, { error: FEEGA_REFUSAL_MESSAGE[out.refusal] });
    }
    throw redirect(HTTP_SEE_OTHER, canvasPath(out.canvas.projectId, out.canvas.id));
  },

  workspace: async (event) => {
    const { db, user } = await signedInDb(event);
    const orgId = String((await event.request.formData()).get('orgId') ?? '');
    const memberships = await listMemberships(db, user.id);
    if (!memberships.some((m) => m.org.id === orgId)) {
      return fail(HTTP_NOT_FOUND, { error: 'Not your workspace' });
    }

    await setActiveOrg(db, { userId: user.id, orgId });
    event.cookies.set(ORG_COOKIE, orgId, { path: '/', maxAge: ORG_COOKIE_MAX_AGE_S });
    throw redirect(HTTP_SEE_OTHER, DASHBOARD_PATH);
  }
};

export type HomeData = Awaited<ReturnType<typeof load>>;
