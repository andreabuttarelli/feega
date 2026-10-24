import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listPromptSkills, writePromptSkill } from '$lib/server/repos/prompt-skills';
import { Outcome } from '$lib/server/repos/effects';
import { bodyOf, callerOf, forbidden, refused } from '$lib/server/effects/http';

const CREATED = 201;
const API_AGENT_KEY = 'api';

export const GET: RequestHandler = async ({ request, url }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }

  const skills = await listPromptSkills(resolved.caller.db, resolved.caller.orgId);
  return json({ skills: skills ?? [], available: skills !== null });
};

export const POST: RequestHandler = async ({ request, url }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }

  const { caller } = resolved;
  if (!caller.writeAllowed) {
    return forbidden();
  }

  const actor = caller.apiKeyId ? { kind: 'agent' as const, id: caller.userId, agentKey: API_AGENT_KEY } : { kind: 'user' as const, id: caller.userId };
  const written = await writePromptSkill(caller.db, caller.orgId, actor, (await bodyOf(request)) as never);
  return written.outcome === Outcome.Ok ? json({ skill: written.skill }, { status: CREATED }) : refused(written.outcome, written.problems);
};
