import { json } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { pickOf, turnModel } from '$lib/server/project-agent/model-route';
import { startProjectTurn, type BriefBrand } from '$lib/server/project-agent/turn';
import { offeredChatModels, resolveChoice } from '$lib/server/chat-model/catalogue';
import { gateAiAction, gateOrgAiAction } from '$lib/server/cli-auth';
import { listMemberships } from '$lib/server/repos/orgs';
import { listCanvases } from '$lib/server/repos/canvas';
import { findReachableProject } from '$lib/server/projects/lookup';
import { openThread, loadTurns, promptHistory, turnRunning } from '$lib/server/repos/chat';
import { openFrameSchema, type OpenFrame } from '$lib/server/project-agent/frame-tools';
import { AGENT_MAX_DURATION_S } from '$lib/server/project-agent/limits';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { blockedPrompt } from '$lib/server/moderation/blocked-response';
import { askedAttachments } from '$lib/server/chat-attachments/route-scope';
import { latestAnswer, readAnswer } from '$lib/reference-pick';
import type { RequestHandler } from './$types';

/**
 * LA CHAT DI PROGETTO: agnostica al brand.
 *
 * Il progetto è il contenitore; il brand è una PROPRIETÀ nullable. Con zero brand il turno parte
 * lo stesso — i tool di tela ci sono, quelli di brand no. Con un brand attaccato la superficie
 * cresce e il prompt lo dice.
 *
 * Contratto stabile per la sidebar:
 *   POST { message }  →  stream UI messages (stessa forma della vecchia chat di brand)
 *   GET               →  { threadId, messages: [{ role, content }] }
 */
export const config = { maxDuration: AGENT_MAX_DURATION_S };

async function loadBriefBrand(
  db: Db,
  input: { orgId: string; brandId: string }
): Promise<BriefBrand | null> {
  const { data } = await db
    .from('brands')
    .select('id, name, slug')
    .eq('id', input.brandId)
    .eq('org_id', input.orgId)
    .maybeSingle();
  return (data as BriefBrand | null) ?? null;
}

export const POST: RequestHandler = async ({ request, url, params, locals }) => {
  const { session, user } = await locals.safeGetSession();
  if (!session?.access_token || !user) {
    return json({ error: 'unauthenticated' }, { status: 401 });
  }

  const db = await locals.db();
  if (!db) {
    return json({ error: 'no_client' }, { status: 500 });
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findReachableProject(db, { projectId: params.projectId ?? '', memberships, userId: user.id });
  if (!found) {
    return json({ error: 'project_not_found' }, { status: 404 });
  }

  const { orgId, project } = found;
  const brand = project.brandId ? await loadBriefBrand(db, { orgId, brandId: project.brandId }) : null;

  const gated = brand ? await gateAiAction(brand, undefined) : await gateOrgAiAction(orgId, undefined);
  if (gated) return gated;

  const { message, model: askedModel, reasoning: askedReasoning, canvasId: openCanvas, attachments: askedFiles, frame: askedFrame, selection } = (await request.json()) as { message?: string; model?: unknown; reasoning?: unknown; canvasId?: unknown; attachments?: unknown; frame?: unknown; selection?: unknown };
  const parsedFrame = openFrameSchema.safeParse(askedFrame);
  const frame: OpenFrame | null = parsedFrame.success ? parsedFrame.data : null;
  const text = message?.trim() ?? '';
  const attachments = await askedAttachments(db, { orgId, projectId: project.id }, askedFiles);
  if (attachments instanceof Response) {
    return attachments;
  }
  if (!text && !attachments.length) {
    return json({ error: 'empty_message' }, { status: 400 });
  }

  const resolved = resolveChoice(await offeredChatModels(), { model: askedModel, reasoning: askedReasoning });
  if (!resolved.ok) {
    return json({ error: resolved.error }, { status: 400 });
  }
  const { model, reasoning } = turnModel(resolved.choice, pickOf(askedModel), text);

  const screening = screenModelInput(db, {
    profile: ModerationProfile.Standard,
    texts: [text],
    scope: { orgId, userId: user.id, projectId: project.id, actor: { kind: 'user', id: user.id } }
  });

  const canvases = await listCanvases(db, { orgId, projectId: project.id });
  const canvasId = canvases.find((c) => c.id === openCanvas)?.id ?? null;
  const threadId = await openThread(db, {
    orgId,
    projectId: project.id,
    userId: user.id,
    brandId: brand?.id ?? null
  });
  const turns = await loadTurns(db, { orgId, threadId });
  const history = promptHistory(turns);
  const pick = readAnswer(text) ?? latestAnswer(turns);

  const screened = await screening;
  if (!screened.ok) {
    return blockedPrompt(screened.error);
  }

  return startProjectTurn({ db, userId: user.id, accessToken: session.access_token, origin: url.origin, orgId, project, brand, text, attachments, model, reasoning, frame, selection, canvases, canvasId, threadId, turns, history, pick });
};

export const GET: RequestHandler = async ({ params, locals }) => {
  const { user } = await locals.safeGetSession();
  if (!user) return json({ error: 'unauthenticated' }, { status: 401 });

  const db = await locals.db();
  if (!db) {
    return json({ error: 'no_client' }, { status: 500 });
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findReachableProject(db, { projectId: params.projectId ?? '', memberships, userId: user.id });
  if (!found) {
    return json({ error: 'project_not_found' }, { status: 404 });
  }

  const { orgId, project } = found;
  const threadId = await openThread(db, {
    orgId,
    projectId: project.id,
    userId: user.id,
    brandId: project.brandId
  });

  const [messages, running] = await Promise.all([loadTurns(db, { orgId, threadId }), turnRunning(db, { orgId, threadId })]);
  return json({ threadId, messages, running });
};
