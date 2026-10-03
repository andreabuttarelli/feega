import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { configuredDidit, settleDidit } from '$lib/server/uncensored-workspace/workspace-server';
import { AgeVerdict } from '$lib/server/uncensored-workspace/didit';

const NOTICE_OF_VERDICT: Readonly<Record<AgeVerdict, string>> = {
  [AgeVerdict.Adult]: '',
  [AgeVerdict.Refused]: '?age=failed',
  [AgeVerdict.Pending]: '?age=pending'
};

export const GET: RequestHandler = async ({ url, params, locals }) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    throw redirect(303, '/login');
  }

  const back = `/p/${params.projectId}/settings/project`;
  const didit = configuredDidit();
  const sessionId = url.searchParams.get('verificationSessionId');
  const result = didit && sessionId ? await didit.decision(sessionId) : null;
  if (!didit || !result || result.userId !== user.id) {
    throw redirect(303, `${back}${NOTICE_OF_VERDICT[AgeVerdict.Refused]}`);
  }

  await settleDidit(didit, result);
  throw redirect(303, `${back}${NOTICE_OF_VERDICT[result.verdict]}`);
};
