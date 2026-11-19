import { Toolkit, type ProviderAnswer, type ProviderCaller } from '$lib/server/connections/account-links';
import { TOOLKITS } from '$lib/server/connections/toolkits';

export enum CloudProvider {
  Drive = 'google_drive',
  Dropbox = 'dropbox',
  OneDrive = 'one_drive'
}

export type CloudEntry = { id: string; name: string; folder: boolean; mime: string | null; importable: boolean };
export type CloudPage = { entries: CloudEntry[]; next: string | null };
export type CloudFile = { name: string; mime: string; bytes: Uint8Array };
export type Upload = { folder: string; name: string; mime: string; bytes: Uint8Array };

type Fetch = typeof fetch;

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const PAGE_SIZE = 200;
const OCTET_STREAM = 'application/octet-stream';
const DRIVE_ROOT = 'root';
const DRIVE_FOLDER = 'application/vnd.google-apps.folder';
const DRIVE_NATIVE = 'application/vnd.google-apps.';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const DROPBOX_RPC = 'https://api.dropboxapi.com/2/files';
const DROPBOX_CONTENT = 'https://content.dropboxapi.com/2/files';
const DROPBOX_ARG = 'Dropbox-API-Arg';
const GRAPH_DRIVE = 'https://graph.microsoft.com/v1.0/me/drive';
const GRAPH_ROOT = 'root';

const EMPTY_PAGE: CloudPage = { entries: [], next: null };

type Spec = {
  toolkit: Toolkit;
  list: (call: ProviderCaller, folder: string | null, cursor: string | null) => Promise<CloudPage>;
  download: (call: ProviderCaller, id: string, fetchFn: Fetch) => Promise<CloudFile | null>;
  upload: (call: ProviderCaller, file: Upload) => Promise<boolean>;
};

type NativeExport = { mime: string; extension: string };

const NATIVE_EXPORTS: Record<string, NativeExport> = {
  [`${DRIVE_NATIVE}document`]: { mime: 'application/pdf', extension: 'pdf' },
  [`${DRIVE_NATIVE}spreadsheet`]: { mime: 'application/pdf', extension: 'pdf' },
  [`${DRIVE_NATIVE}presentation`]: { mime: 'application/pdf', extension: 'pdf' },
  [`${DRIVE_NATIVE}drawing`]: { mime: 'image/png', extension: 'png' }
};

const ok = (answer: ProviderAnswer) => answer.status >= HTTP_OK_MIN && answer.status <= HTTP_OK_MAX;
const isNative = (mime: string) => mime.startsWith(DRIVE_NATIVE);
const base64Of = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
const header = (answer: ProviderAnswer, name: string) => Object.entries(answer.headers).find(([k]) => k.toLowerCase() === name)?.[1] ?? null;

async function bytesOf(answer: ProviderAnswer, fetchFn: Fetch): Promise<Uint8Array | null> {
  if (!ok(answer) || !answer.file) {
    return null;
  }
  const res = await fetchFn(answer.file).catch(() => null);
  return res?.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}

async function driveList(call: ProviderCaller, folder: string | null, cursor: string | null): Promise<CloudPage> {
  const query: Record<string, string> = { q: `'${folder ?? DRIVE_ROOT}' in parents and trashed=false`, fields: 'nextPageToken,files(id,name,mimeType)', pageSize: String(PAGE_SIZE) };
  if (cursor) {
    query.pageToken = cursor;
  }
  const res = await call({ endpoint: DRIVE_API, query });
  if (!ok(res)) {
    return EMPTY_PAGE;
  }
  const body = (res.data ?? {}) as { files?: { id: string; name: string; mimeType: string }[]; nextPageToken?: string };
  const entries = (body.files ?? []).map((f) => {
    const folderEntry = f.mimeType === DRIVE_FOLDER;
    const importable = !isNative(f.mimeType) || folderEntry || f.mimeType in NATIVE_EXPORTS;
    return { id: f.id, name: f.name, folder: folderEntry, mime: folderEntry ? null : f.mimeType, importable };
  });
  return { entries, next: body.nextPageToken ?? null };
}

async function driveDownload(call: ProviderCaller, id: string, fetchFn: Fetch): Promise<CloudFile | null> {
  const item = `${DRIVE_API}/${encodeURIComponent(id)}`;
  const meta = await call({ endpoint: item, query: { fields: 'name,mimeType' } });
  if (!ok(meta)) {
    return null;
  }
  const { name, mimeType } = meta.data as { name: string; mimeType: string };
  const native = NATIVE_EXPORTS[mimeType];
  if (isNative(mimeType) && !native) {
    return null;
  }
  const media = await call(native ? { endpoint: `${item}/export`, query: { mimeType: native.mime } } : { endpoint: item, query: { alt: 'media' } });
  const bytes = await bytesOf(media, fetchFn);
  if (!bytes) {
    return null;
  }
  return native ? { name: `${name}.${native.extension}`, mime: native.mime, bytes } : { name, mime: mimeType, bytes };
}

async function driveUpload(call: ProviderCaller, file: Upload): Promise<boolean> {
  const sent = await call({ endpoint: DRIVE_UPLOAD, method: 'POST', query: { uploadType: 'media' }, binary: { base64: base64Of(file.bytes), contentType: file.mime } });
  const id = ok(sent) ? (sent.data as { id?: string } | null)?.id : null;
  if (!id) {
    return false;
  }
  const named = await call({ endpoint: `${DRIVE_API}/${encodeURIComponent(id)}`, method: 'PATCH', query: { addParents: file.folder || DRIVE_ROOT }, body: { name: file.name } });
  return ok(named);
}

async function dropboxList(call: ProviderCaller, folder: string | null, cursor: string | null): Promise<CloudPage> {
  const request = cursor ? { endpoint: `${DROPBOX_RPC}/list_folder/continue`, body: { cursor } } : { endpoint: `${DROPBOX_RPC}/list_folder`, body: { path: folder ?? '', limit: PAGE_SIZE } };
  const res = await call({ ...request, method: 'POST' });
  if (!ok(res)) {
    return EMPTY_PAGE;
  }
  const body = (res.data ?? {}) as { entries?: { '.tag': string; name: string; path_lower: string }[]; has_more?: boolean; cursor?: string };
  const entries = (body.entries ?? []).map((e) => ({ id: e.path_lower, name: e.name, folder: e['.tag'] === 'folder', mime: null, importable: true }));
  return { entries, next: body.has_more ? (body.cursor ?? null) : null };
}

async function dropboxDownload(call: ProviderCaller, id: string, fetchFn: Fetch): Promise<CloudFile | null> {
  const res = await call({ endpoint: `${DROPBOX_CONTENT}/download`, method: 'POST', headers: { [DROPBOX_ARG]: JSON.stringify({ path: id }) } });
  const bytes = await bytesOf(res, fetchFn);
  if (!bytes) {
    return null;
  }
  const result = JSON.parse(header(res, 'dropbox-api-result') ?? '{}') as { name?: string };
  return { name: result.name ?? id.split('/').pop() ?? 'file', mime: header(res, 'content-type') ?? OCTET_STREAM, bytes };
}

async function dropboxUpload(call: ProviderCaller, file: Upload): Promise<boolean> {
  const arg = { path: `${file.folder.replace(/\/$/, '')}/${file.name}`, mode: 'add', autorename: true };
  const res = await call({ endpoint: `${DROPBOX_CONTENT}/upload`, method: 'POST', headers: { [DROPBOX_ARG]: JSON.stringify(arg) }, binary: { base64: base64Of(file.bytes), contentType: OCTET_STREAM } });
  return ok(res);
}

type GraphItem = { id: string; name: string; folder?: unknown; file?: { mimeType?: string } };

const graphItem = (id: string) => `${GRAPH_DRIVE}/items/${encodeURIComponent(id)}`;

async function oneDriveList(call: ProviderCaller, folder: string | null, cursor: string | null): Promise<CloudPage> {
  if (cursor && !cursor.startsWith(`${GRAPH_DRIVE}/`)) {
    return EMPTY_PAGE;
  }
  const res = await call(cursor ? { endpoint: cursor } : { endpoint: `${folder ? graphItem(folder) : `${GRAPH_DRIVE}/${GRAPH_ROOT}`}/children` });
  if (!ok(res)) {
    return EMPTY_PAGE;
  }
  const body = (res.data ?? {}) as { value?: GraphItem[]; '@odata.nextLink'?: string };
  const entries = (body.value ?? []).map((i) => ({ id: i.id, name: i.name, folder: i.folder !== undefined, mime: i.file?.mimeType ?? null, importable: true }));
  return { entries, next: body['@odata.nextLink'] ?? null };
}

async function oneDriveDownload(call: ProviderCaller, id: string, fetchFn: Fetch): Promise<CloudFile | null> {
  const meta = await call({ endpoint: graphItem(id) });
  if (!ok(meta)) {
    return null;
  }
  const item = meta.data as GraphItem;
  const bytes = await bytesOf(await call({ endpoint: `${graphItem(id)}/content` }), fetchFn);
  return bytes ? { name: item.name, mime: item.file?.mimeType ?? OCTET_STREAM, bytes } : null;
}

async function oneDriveUpload(call: ProviderCaller, file: Upload): Promise<boolean> {
  const res = await call({ endpoint: `${GRAPH_DRIVE}/items/${encodeURIComponent(file.folder || GRAPH_ROOT)}:/${encodeURIComponent(file.name)}:/content`, method: 'PUT', binary: { base64: base64Of(file.bytes), contentType: file.mime } });
  return ok(res);
}

const PROVIDERS: Record<CloudProvider, Spec> = {
  [CloudProvider.Drive]: { toolkit: Toolkit.GoogleDrive, list: driveList, download: driveDownload, upload: driveUpload },
  [CloudProvider.Dropbox]: { toolkit: Toolkit.Dropbox, list: dropboxList, download: dropboxDownload, upload: dropboxUpload },
  [CloudProvider.OneDrive]: { toolkit: Toolkit.OneDrive, list: oneDriveList, download: oneDriveDownload, upload: oneDriveUpload }
};

export const isCloudProvider = (value: string): value is CloudProvider => Object.values(CloudProvider).includes(value as CloudProvider);

export const toolkitOf = (provider: CloudProvider): Toolkit => PROVIDERS[provider].toolkit;

export const labelOf = (provider: CloudProvider): string => TOOLKITS[toolkitOf(provider)].label;

export const listFiles = (provider: CloudProvider, call: ProviderCaller, folder: string | null, cursor: string | null) => PROVIDERS[provider].list(call, folder, cursor);

export const downloadFile = (provider: CloudProvider, call: ProviderCaller, id: string, fetchFn: Fetch = fetch) => PROVIDERS[provider].download(call, id, fetchFn);

export const uploadFile = (provider: CloudProvider, call: ProviderCaller, file: Upload) => PROVIDERS[provider].upload(call, file);
