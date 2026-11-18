import { env as publicEnv } from '$env/dynamic/public';
import { HOSTED_SOURCE_ASKS, type SourceAsks } from '$lib/canvas/core/frame-sources';
import type { PictureLimits } from '$lib/canvas/core/picture-turns';

export const LOCAL_ORG_ID = '00000000-0000-4000-8000-00000000f001';
export const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000f002';
export const LOCAL_USER = { id: LOCAL_USER_ID, email: 'you@feega.local', created_at: '2026-01-01T00:00:00.000Z', app_metadata: {}, user_metadata: { full_name: 'You' }, aud: 'authenticated', role: 'authenticated' };

export const isLocalMode = (env: Record<string, string | undefined>) => env.PUBLIC_FEEGA_LOCAL === '1';

const LOCAL_SOURCE_ASKS: SourceAsks = { framesPerAsk: 2, open: 2 };

export const sourceAsksFor = (env: Record<string, string | undefined>): SourceAsks => (isLocalMode(env) ? LOCAL_SOURCE_ASKS : HOSTED_SOURCE_ASKS);

const LOCAL_PICTURE_LIMITS: PictureLimits = { whileOwed: 3, open: 6 };
const HOSTED_PICTURE_LIMITS: PictureLimits = { whileOwed: Infinity, open: Infinity };

export const pictureLimitsFor = (env: Record<string, string | undefined>): PictureLimits => (isLocalMode(env) ? LOCAL_PICTURE_LIMITS : HOSTED_PICTURE_LIMITS);

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
  AiNodes = 'ai_nodes',
  TermsNotice = 'terms_notice',
  PublicLinks = 'public_links',
  NextSteps = 'next_steps',
  Present = 'present'
}

type Env = Record<string, string | undefined>;

export const LOCAL_AI_FLAG = 'PUBLIC_FEEGA_LOCAL_AI';

const always = () => true;
const withoutAiKey = (env: Env) => env[LOCAL_AI_FLAG] !== '1';

const OFF_IN_LOCAL_MODE: Record<LocalOff, (env: Env) => boolean> = {
  [LocalOff.CookieBanner]: always,
  [LocalOff.Analytics]: always,
  [LocalOff.Chat]: always,
  [LocalOff.Share]: always,
  [LocalOff.Credits]: always,
  [LocalOff.Comments]: always,
  [LocalOff.Versions]: always,
  [LocalOff.NewCanvas]: always,
  [LocalOff.ImportCanvas]: always,
  [LocalOff.Brand]: always,
  [LocalOff.CloudImport]: always,
  [LocalOff.CloudNodes]: always,
  [LocalOff.AiNodes]: withoutAiKey,
  [LocalOff.TermsNotice]: always,
  [LocalOff.PublicLinks]: always,
  [LocalOff.NextSteps]: always,
  [LocalOff.Present]: always
};

export const localOff = (feature: LocalOff, env: Env) => isLocalMode(env) && OFF_IN_LOCAL_MODE[feature](env);

export const isOff = (feature: LocalOff) => localOff(feature, publicEnv);
