import type { LayoutServerLoad } from './$types';
import type { Db } from '$lib/server/db/client';
import { isPlanGoEnabled } from '$lib/server/feature-flags';
import { selineSetUser } from '$lib/server/seline';
import { isInternalEmail } from '$lib/server/internal-users';
import { trackingAllowed } from '$lib/analytics';
import { outdatedTermsVersion } from '$lib/terms-notice';
import { socialPublishing } from '$lib/server/social-publishing';

export const load: LayoutServerLoad = async ({ url, locals: { safeGetSession, db } }) => {
  const { session, user } = await safeGetSession();

  // Chi ha già accettato una versione dei termini vede l'avviso solo quando la versione corrente
  // è cambiata — non sul primo accesso, dove `landingPath` registra già quella corrente.
  const termsNoticeVersion = await outdatedTermsNoticeFor(db, user?.id ?? null);

  // I due guard degli analytics, decisi qui una volta sola.
  //
  //  1. l'ambiente: fuori dalla produzione vera (dev, `vercel dev`, preview) non si traccia niente;
  //  2. chi sta guardando: le nostre sessioni non vanno registrate né identificate.
  //
  // Il secondo si risolve QUI, non nel browser: la lista di chi è interno vive in $lib/server e al
  // client arriva solo il booleano — gli indirizzi del team non finiscono in un bundle pubblico.
  const internalViewer = isInternalEmail(user?.email);
  const analyticsOptOut = !trackingAllowed(url.hostname) || internalViewer;

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
    socialPublishing: await socialPublishing(),
    termsNoticeVersion
  };
};

async function outdatedTermsNoticeFor(db: () => Promise<Db | null>, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const client = await db();
  if (!client) return null;

  const { data } = await client.from('profiles').select('terms_version').eq('id', userId).maybeSingle();
  return outdatedTermsVersion(data?.terms_version ?? null);
}
