import type { ServerLoadEvent } from '@sveltejs/kit';
import { isPlanGoEnabled } from '$lib/server/feature-flags';
import { selineSetUser } from '$lib/server/seline';
import { isInternalEmail } from '$lib/server/internal-users';
import { trackingAllowed } from '$lib/analytics';
import { socialPublishing } from '$lib/server/social-publishing';
import { firstRunFlags } from '$lib/server/dashboard/first-run-flags';

export const APP_HOST_PARAM = 'host';

export const load = async ({ url, untrack, locals: { safeGetSession, db } }: Pick<ServerLoadEvent, 'url' | 'untrack' | 'locals'>) => {
  const { session, user } = await safeGetSession();

  // Chi ha già accettato una versione dei termini vede l'avviso solo quando la versione corrente
  // è cambiata — non sul primo accesso, dove `landingPath` registra già quella corrente.
  const [{ termsNoticeVersion, tour }, social] = await Promise.all([firstRunFlags(user ? await db() : null, user), socialPublishing()]);

  // I due guard degli analytics, decisi qui una volta sola.
  //
  //  1. l'ambiente: fuori dalla produzione vera (dev, `vercel dev`, preview) non si traccia niente;
  //  2. chi sta guardando: le nostre sessioni non vanno registrate né identificate.
  //
  // Il secondo si risolve QUI, non nel browser: la lista di chi è interno vive in $lib/server e al
  // client arriva solo il booleano — gli indirizzi del team non finiscono in un bundle pubblico.
  const internalViewer = isInternalEmail(user?.email);
  const analyticsOptOut = !trackingAllowed(untrack(() => url.searchParams.get(APP_HOST_PARAM) ?? url.hostname)) || internalViewer;

  // Seline Profiles: identify authenticated users server-side (adblock-proof). Debounced in
  // $lib/server/seline. Client script still stitches the browser visitor via setUser in identifyUser.
  // Vale anche qui: un guard solo nel browser sarebbe cosmetico, questa chiamata parte dal server.
  if (user?.id && !analyticsOptOut) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const name =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      undefined;
    selineSetUser(user.id, {
      ...(user.email ? { email: user.email } : {}),
      ...(name ? { name } : {})
    });
  }

  // planGo: Vercel FEATURE_PLAN_GO — toggle without rebuild via $env/dynamic.
  // `internalViewer` viaggia separato da `analyticsOptOut` perché serve a Sentry, che sui deploy di
  // preview deve restare acceso (vedi setInternalViewer in $lib/analytics). Anche qui al browser
  // arriva solo il booleano, mai la lista degli indirizzi.
  return {
    session,
    analyticsOptOut,
    internalViewer,
    planGo: isPlanGoEnabled(),
    socialPublishing: social,
    termsNoticeVersion,
    tour
  };
};

export type RootShell = Awaited<ReturnType<typeof load>>;
