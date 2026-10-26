import { env as publicEnv } from '$env/dynamic/public';

export const LOCAL_ORG_ID = '00000000-0000-4000-8000-00000000f001';
export const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000f002';
export const LOCAL_USER = { id: LOCAL_USER_ID, email: 'you@feega.local', created_at: '2026-01-01T00:00:00.000Z', app_metadata: {}, user_metadata: { full_name: 'You' }, aud: 'authenticated', role: 'authenticated' };

export const isLocalMode = (env: Record<string, string | undefined>) => env.PUBLIC_FEEGA_LOCAL === '1';

export enum LocalOff {
  CookieBanner = 'cookie_banner',
  Analytics = 'analytics',
  Chat = 'chat',
  Share = 'share',
  Credits = 'credits',
  Comments = 'comments',
  Versions = 'versions',
  NewCanvas = 'new_canvas',
  ImportCanvas = 'import_canvas',
  Brand = 'brand',
  CloudImport = 'cloud_import',
  CloudNodes = 'cloud_nodes',
  TermsNotice = 'terms_notice',
  PublicLinks = 'public_links',
  NextSteps = 'next_steps'
}

const OFF_IN_LOCAL_MODE: ReadonlySet<LocalOff> = new Set(Object.values(LocalOff));

export const localOff = (feature: LocalOff, env: Record<string, string | undefined>) => isLocalMode(env) && OFF_IN_LOCAL_MODE.has(feature);

export const isOff = (feature: LocalOff) => localOff(feature, publicEnv);
