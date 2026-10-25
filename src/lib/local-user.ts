export const LOCAL_ORG_ID = '00000000-0000-4000-8000-00000000f001';
export const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000f002';
export const LOCAL_USER = { id: LOCAL_USER_ID, email: 'you@feega.local', created_at: '2026-01-01T00:00:00.000Z', app_metadata: {}, user_metadata: { full_name: 'You' }, aud: 'authenticated', role: 'authenticated' };

export const isLocalMode = (env: Record<string, string | undefined>) => env.PUBLIC_FEEGA_LOCAL === '1';
