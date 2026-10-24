import { openSecret, sealSecret } from '$lib/server/secrets/seal';

export enum CloudProvider {
  Drive = 'google_drive',
  Dropbox = 'dropbox'
}

export type Credentials = { clientId: string; clientSecret: string };
export type TokenSet = { accessToken: string; refreshToken: string | null; expiresAt: number };
export type CloudEntry = { id: string; name: string; folder: boolean; mime: string | null };
export type CloudFile = { name: string; mime: string; bytes: Uint8Array };
export type Upload = { folder: string; name: string; mime: string; bytes: Uint8Array };

type Fetch = typeof fetch;

const STATE_CONTEXT = 'feega:cloud-state';
const STATE_TTL_MS = 10 * 60_000;
const REFRESH_MARGIN_MS = 60_000;
const SECOND_MS = 1000;
const DRIVE_FOLDER = 'application/vnd.google-apps.folder';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DROPBOX_RPC = 'https://api.dropboxapi.com/2/files';
const DROPBOX_CONTENT = 'https://content.dropboxapi.com/2/files';
const BOUNDARY = 'feega-cloud-boundary';

type Spec = {
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  offline: Record<string, string>;
  list: (token: string, folder: string | null, fetchFn: Fetch) => Promise<CloudEntry[]>;
  download: (token: string, id: string, fetchFn: Fetch) => Promise<CloudFile | null>;
  upload: (token: string, file: Upload, fetchFn: Fetch) => Promise<boolean>;
};

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function driveList(token: string, folder: string | null, fetchFn: Fetch): Promise<CloudEntry[]> {
  const query = `'${folder ?? 'root'}' in parents and trashed=false`;
  const url = `${DRIVE_API}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent('files(id,name,mimeType)')}&pageSize=200`;
  const res = await fetchFn(url, { headers: bearer(token) });
  if (!res.ok) {
    return [];
  }
  const body = (await res.json()) as { files?: { id: string; name: string; mimeType: string }[] };
  return (body.files ?? []).map((f) => ({ id: f.id, name: f.name, folder: f.mimeType === DRIVE_FOLDER, mime: f.mimeType === DRIVE_FOLDER ? null : f.mimeType }));
}

async function driveDownload(token: string, id: string, fetchFn: Fetch): Promise<CloudFile | null> {
  const meta = await fetchFn(`${DRIVE_API}/${encodeURIComponent(id)}?fields=name,mimeType`, { headers: bearer(token) });
  if (!meta.ok) {
    return null;
  }
  const { name, mimeType } = (await meta.json()) as { name: string; mimeType: string };
  const media = await fetchFn(`${DRIVE_API}/${encodeURIComponent(id)}?alt=media`, { headers: bearer(token) });
  return media.ok ? { name, mime: mimeType, bytes: new Uint8Array(await media.arrayBuffer()) } : null;
}

async function driveUpload(token: string, file: Upload, fetchFn: Fetch): Promise<boolean> {
  const head = `--${BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: file.name, parents: [file.folder] })}\r\n--${BOUNDARY}\r\nContent-Type: ${file.mime}\r\n\r\n`;
  const body = new Blob([head, file.bytes as BlobPart, `\r\n--${BOUNDARY}--`]);
  const res = await fetchFn(DRIVE_UPLOAD, { method: 'POST', headers: { ...bearer(token), 'Content-Type': `multipart/related; boundary=${BOUNDARY}` }, body });
  return res.ok;
}

async function dropboxList(token: string, folder: string | null, fetchFn: Fetch): Promise<CloudEntry[]> {
  const res = await fetchFn(`${DROPBOX_RPC}/list_folder`, { method: 'POST', headers: { ...bearer(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ path: folder ?? '' }) });
  if (!res.ok) {
    return [];
  }
  const body = (await res.json()) as { entries?: { '.tag': string; name: string; path_lower: string }[] };
  return (body.entries ?? []).map((e) => ({ id: e.path_lower, name: e.name, folder: e['.tag'] === 'folder', mime: null }));
}

async function dropboxDownload(token: string, id: string, fetchFn: Fetch): Promise<CloudFile | null> {
  const res = await fetchFn(`${DROPBOX_CONTENT}/download`, { method: 'POST', headers: { ...bearer(token), 'Dropbox-API-Arg': JSON.stringify({ path: id }) } });
  if (!res.ok) {
    return null;
  }
  const result = JSON.parse(res.headers.get('dropbox-api-result') ?? '{}') as { name?: string };
  return { name: result.name ?? id.split('/').pop() ?? 'file', mime: res.headers.get('content-type') ?? 'application/octet-stream', bytes: new Uint8Array(await res.arrayBuffer()) };
}

async function dropboxUpload(token: string, file: Upload, fetchFn: Fetch): Promise<boolean> {
  const arg = { path: `${file.folder.replace(/\/$/, '')}/${file.name}`, mode: 'add', autorename: true };
  const res = await fetchFn(`${DROPBOX_CONTENT}/upload`, { method: 'POST', headers: { ...bearer(token), 'Dropbox-API-Arg': JSON.stringify(arg), 'Content-Type': 'application/octet-stream' }, body: file.bytes as BodyInit });
  return res.ok;
}

const PROVIDERS: Record<CloudProvider, Spec> = {
  [CloudProvider.Drive]: {
    label: 'Google Drive',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
    offline: { access_type: 'offline', prompt: 'consent' },
    list: driveList,
    download: driveDownload,
    upload: driveUpload
  },
  [CloudProvider.Dropbox]: {
    label: 'Dropbox',
    authorizeUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scope: 'files.metadata.read files.content.read files.content.write',
    offline: { token_access_type: 'offline' },
    list: dropboxList,
    download: dropboxDownload,
    upload: dropboxUpload
  }
};

export const isCloudProvider = (value: string): value is CloudProvider => Object.values(CloudProvider).includes(value as CloudProvider);

export const labelOf = (provider: CloudProvider): string => PROVIDERS[provider].label;

export function authorizeUrl(provider: CloudProvider, input: { clientId: string; redirectUri: string; state: string }): string {
  const spec = PROVIDERS[provider];
  const params = new URLSearchParams({ client_id: input.clientId, redirect_uri: input.redirectUri, response_type: 'code', scope: spec.scope, state: input.state, ...spec.offline });
  return `${spec.authorizeUrl}?${params}`;
}

export type OAuthState = { userId: string; provider: CloudProvider; returnTo: string };

export function sealState(state: OAuthState, now = Date.now()): string {
  return sealSecret(STATE_CONTEXT, JSON.stringify({ ...state, exp: now + STATE_TTL_MS }));
}

export function openState(sealed: string, now = Date.now()): OAuthState | null {
  const text = openSecret(STATE_CONTEXT, sealed);
  if (!text) {
    return null;
  }
  const { exp, ...state } = JSON.parse(text) as OAuthState & { exp: number };
  return exp > now ? state : null;
}

async function tokenRequest(provider: CloudProvider, form: Record<string, string>, fetchFn: Fetch, now: number): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: number } | null> {
  const res = await fetchFn(PROVIDERS[provider].tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() });
  if (!res.ok) {
    return null;
  }
  const body = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!body.access_token) {
    return null;
  }
  return { accessToken: body.access_token, refreshToken: body.refresh_token ?? null, expiresAt: now + (body.expires_in ?? 0) * SECOND_MS };
}

export function exchangeCode(provider: CloudProvider, input: Credentials & { redirectUri: string; code: string }, fetchFn: Fetch = fetch, now = Date.now()): Promise<TokenSet | null> {
  return tokenRequest(provider, { grant_type: 'authorization_code', code: input.code, redirect_uri: input.redirectUri, client_id: input.clientId, client_secret: input.clientSecret }, fetchFn, now);
}

export async function freshAccess(provider: CloudProvider, tokens: TokenSet, creds: Credentials, fetchFn: Fetch = fetch, now = Date.now()): Promise<TokenSet | null> {
  if (tokens.expiresAt - REFRESH_MARGIN_MS > now) {
    return tokens;
  }
  if (!tokens.refreshToken) {
    return null;
  }
  const next = await tokenRequest(provider, { grant_type: 'refresh_token', refresh_token: tokens.refreshToken, client_id: creds.clientId, client_secret: creds.clientSecret }, fetchFn, now);
  return next ? { ...next, refreshToken: next.refreshToken ?? tokens.refreshToken } : null;
}

export const listFiles = (provider: CloudProvider, token: string, folder: string | null, fetchFn: Fetch = fetch) => PROVIDERS[provider].list(token, folder, fetchFn);

export const downloadFile = (provider: CloudProvider, token: string, id: string, fetchFn: Fetch = fetch) => PROVIDERS[provider].download(token, id, fetchFn);

export const uploadFile = (provider: CloudProvider, token: string, file: Upload, fetchFn: Fetch = fetch) => PROVIDERS[provider].upload(token, file, fetchFn);
