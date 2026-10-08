import { json } from '@sveltejs/kit';
import { streamText, type ModelMessage } from 'ai';
import type { Db } from '$lib/server/db/client';
import { llmLanguageModel } from '$lib/server/llm';
import { offeredChatModels, reasoningProviderOptions, resolveChoice } from '$lib/server/chat-model/catalogue';
import { extractSdkUsage, logAiCall, withBrandContext, withOrgContext } from '$lib/server/ai-log';
import { gateAiAction, gateOrgAiAction } from '$lib/server/cli-auth';
import { listMemberships } from '$lib/server/repos/orgs';
import { listCanvases } from '$lib/server/repos/canvas';
import { findReachableProject } from '$lib/server/projects/lookup';
import { openThread, loadTurns, promptHistory, saveTurn, turnRunning } from '$lib/server/repos/chat';
import { finishedTurn } from '$lib/server/project-agent/finished-turn';
import { openReply, ReplyStatus } from '$lib/server/repos/chat-reply';
import { agentActor, SIDEBAR_AGENT_KEY } from '$lib/server/repos/actor';
import { createProjectTools } from '$lib/server/project-agent/project-tools';
import { createMotionDelegation } from '$lib/server/project-agent/motion-delegation';
import { openAgentTools } from '$lib/server/project-agent/tool-surface';
import { projectAgentPrompt } from '$lib/server/project-agent/system-prompt';
import { AGENT_MAX_DURATION_S, agentStopWhen } from '$lib/server/project-agent/limits';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { blockedPrompt } from '$lib/server/moderation/blocked-response';
import { runInBackground } from '$lib/server/background-work';
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

type BriefBrand = { id: string; name: string; slug: string };

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

  const { message, model: askedModel, reasoning: askedReasoning } = (await request.json()) as { message?: string; model?: unknown; reasoning?: unknown };
  const text = message?.trim();
  if (!text) return json({ error: 'empty_message' }, { status: 400 });

  const resolved = resolveChoice(await offeredChatModels(), { model: askedModel, reasoning: askedReasoning });
  if (!resolved.ok) {
    return json({ error: resolved.error }, { status: 400 });
  }
  const { model, reasoning } = resolved.choice;

  const screening = screenModelInput(db, {
    profile: ModerationProfile.Standard,
    texts: [text],
    scope: { orgId, userId: user.id, projectId: project.id, actor: { kind: 'user', id: user.id } }
  });

  const canvases = await listCanvases(db, { orgId, projectId: project.id });
  const threadId = await openThread(db, {
    orgId,
    projectId: project.id,
    userId: user.id,
    brandId: brand?.id ?? null
  });
  const history = promptHistory(await loadTurns(db, { orgId, threadId }));

  const screened = await screening;
  if (!screened.ok) {
    return blockedPrompt(screened.error);
  }

  const actor = agentActor(user.id, SIDEBAR_AGENT_KEY);
  const userActor = { kind: 'user' as const, id: user.id };
  await saveTurn(db, { orgId, threadId, role: 'user', content: text, actor: userActor });
  const reply = await openReply(db, { orgId, threadId, actor });
  const steps: Parameters<typeof finishedTurn>[0][number][] = [];

  const projectTools = {
    ...createProjectTools({ db, orgId, projectId: project.id, userId: user.id, brandId: brand?.id ?? null }),
    ...createMotionDelegation({ db, orgId, projectId: project.id, userId: user.id, origin: url.origin, model })
  };
  const agent = await openAgentTools({
    projectTools,
    brand,
    accessToken: session.access_token
  });

  const t0 = Date.now();
  const billedScope = <T>(fn: () => T): T => (brand ? withBrandContext(brand.id, fn) : withOrgContext(orgId, fn));

  const result = billedScope(() => streamText({
    model: llmLanguageModel(model),
    system: projectAgentPrompt({
      project: { id: project.id, name: project.name },
      canvases: canvases.map((c) => ({ id: c.id, name: c.name })),
      brand: brand ? { name: brand.name, slug: brand.slug } : null
    }),
    allowSystemInMessages: true,
    messages: [...history, { role: 'user', content: text }] as ModelMessage[],
    tools: agent.tools,
    providerOptions: reasoningProviderOptions(reasoning),
    stopWhen: [agentStopWhen(t0)],
    onStepFinish: (step) => {
      steps.push(step);
      void reply.progress(finishedTurn(steps));
    },
    onFinish: async ({ steps: finished, totalUsage }) => {
      await agent.close().catch((e) => console.error('[project-agent] tools not closed:', e));

      await reply.finish(finishedTurn(finished), ReplyStatus.Done);

      logAiCall({
        label: 'project-agent',
        provider: 'llm',
        model,
        ms: Date.now() - t0,
        ok: true,
        brandId: brand?.id,
        orgId,
        userId: user.id,
        threadId,
        projectId: project.id,
        actorKind: 'agent',
        actorId: user.id,
        agentKey: SIDEBAR_AGENT_KEY,
        ...extractSdkUsage(totalUsage)
      });
    }
  }));

  runInBackground(
    async () => {
      await result.consumeStream({ onError: (e) => console.error('[project-agent] turn failed after client left', e) });
      await reply.finish(finishedTurn(steps), ReplyStatus.Failed);
    },
    'project-agent-turn'
  );

  return result.toUIMessageStreamResponse({ sendReasoning: true });
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
