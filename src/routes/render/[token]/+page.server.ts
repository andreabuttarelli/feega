import { fail, type Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { Claim, createRenderLinkDb, failRenderLink, finishRenderLink, linkPayload, openRenderLink, parseToken, uploadSlot } from '$lib/server/motion/render-link';
import { BROWSER_RENDER_DEADLINE_MS, LinkRefusal, RENDER_PAGE } from '$lib/motion/render-link';

const HTTP_BAD_REQUEST = 400;
const HTTP_GONE = 410;
const HTTP_UNAVAILABLE = 503;
const ERROR_MAX = 300;
const MS_PER_S = 1000;

const cookieName = (token: string) => `feega_render_${parseToken(token)?.runId ?? 'none'}`;

async function opened(token: string, cookies: Cookies, mode: Claim) {
  const db = createRenderLinkDb();
  const link = await openRenderLink(db, token, cookies.get(cookieName(token)) ?? null, mode);
  if (link.ok && link.claim) {
    cookies.set(cookieName(token), link.claim, { path: RENDER_PAGE, httpOnly: true, sameSite: 'lax', maxAge: BROWSER_RENDER_DEADLINE_MS / MS_PER_S });
  }
  return { db, link };
}

export const load: PageServerLoad = async ({ params, cookies, setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  const { db, link } = await opened(params.token, cookies, Claim.Take);
  if (!link.ok) {
    return { refused: link.error, render: null };
  }
  const render = await linkPayload(db, link.run);
  return render ? { refused: null, render } : { refused: LinkRefusal.Invalid, render: null };
};

export const actions: Actions = {
  slot: async ({ params, cookies }) => {
    const { db, link } = await opened(params.token, cookies, Claim.Require);
    if (!link.ok) {
      return fail(HTTP_GONE, { error: link.error });
    }
    const slot = await uploadSlot(db, link.run);
    return slot ?? fail(HTTP_UNAVAILABLE, { error: 'upload_unavailable' });
  },

  finish: async ({ params, cookies, request }) => {
    const { db, link } = await opened(params.token, cookies, Claim.Require);
    if (!link.ok) {
      return fail(HTTP_GONE, { error: link.error });
    }
    const form = await request.formData();
    const output = { width: Number(form.get('width')), height: Number(form.get('height')), seconds: Number(form.get('seconds')) };
    if (![output.width, output.height, output.seconds].every((n) => Number.isFinite(n) && n > 0)) {
      return fail(HTTP_BAD_REQUEST, { error: 'invalid_output' });
    }
    const finished = await finishRenderLink(db, link.run, output);
    return finished.ok ? { assetId: finished.assetId } : fail(HTTP_BAD_REQUEST, { error: finished.error });
  },

  cancel: async ({ params, cookies, request }) => {
    const { db, link } = await opened(params.token, cookies, Claim.Require);
    if (!link.ok) {
      return fail(HTTP_GONE, { error: link.error });
    }
    const form = await request.formData();
    await failRenderLink(db, link.run, String(form.get('reason') ?? 'cancelled').slice(0, ERROR_MAX));
    return { cancelled: true };
  }
};
