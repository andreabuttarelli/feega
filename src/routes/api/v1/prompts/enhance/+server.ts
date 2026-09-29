import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openOrgScope } from '$lib/server/cli-auth';
import { enhancePrompt } from '$lib/server/prompt-enhance';
import { withOrgContext } from '$lib/server/ai-log';
import { ENHANCE_PROMPT } from '@feega/api-contracts';
import type { Db } from '$lib/server/db/client';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { blockedPrompt } from '$lib/server/moderation/blocked-response';

// Riscrivere il brief di un gatto non deve chiedere a quale azienda addebitarlo: il disegno vero
// non lo chiede (`/api/v1/images`), e un passo che lo chiedesse rimetterebbe il confine dove
// quella rotta l'ha tolto.
export const POST: RequestHandler = async ({ request }) => {
  const { scope, error } = await openOrgScope(request);
  if (error) return error;

  const parsed = ENHANCE_PROMPT.input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: 'invalid_input', details: parsed.error.issues }, { status: 400 });
  }

  const screened = await screenModelInput(scope.supabase as unknown as Db, {
    profile: ModerationProfile.Standard,
    texts: [parsed.data.prompt],
    scope: { orgId: scope.orgId, userId: scope.user.id, model: parsed.data.model }
  });
  if (!screened.ok) {
    return blockedPrompt(screened.error);
  }

  const result = await withOrgContext(scope.orgId, () =>
    enhancePrompt({
      prompt: parsed.data.prompt,
      model: parsed.data.model,
      shotMode: parsed.data.shot_mode
    })
  );

  return json({ ...result, organization: scope.organization });
};
