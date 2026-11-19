import { describe, expect, it, vi } from 'vitest';
import { Toolkit, type ProviderAnswer, type ProviderCall } from '$lib/server/connections/account-links';
import { CloudProvider, downloadFile, listFiles, toolkitOf, uploadFile } from './cloud';

const answer = (data: unknown, extra: Partial<ProviderAnswer> = {}): ProviderAnswer => ({ status: 200, data, headers: {}, file: null, ...extra });

function proxy(answers: ProviderAnswer[]) {
  const seen: ProviderCall[] = [];
  const call = vi.fn(async (request: ProviderCall) => {
    seen.push(request);
    return answers.shift() ?? answer(null, { status: 404 });
  });
  return { call, seen };
}

const bytesAt = (bytes: number[]) => vi.fn(async () => new Response(new Uint8Array(bytes))) as unknown as typeof fetch;

describe('every cloud provider is a Composio toolkit', () => {
  it.each([
    [CloudProvider.Drive, Toolkit.GoogleDrive],
    [CloudProvider.Dropbox, Toolkit.Dropbox],
    [CloudProvider.OneDrive, Toolkit.OneDrive]
  ])('%s → %s', (provider, toolkit) => {
    expect(toolkitOf(provider)).toBe(toolkit);
  });
});

describe('Google Drive through the proxy', () => {
  it('lists a folder, keeping native docs that export and dropping the ones that do not', async () => {
    const { call, seen } = proxy([answer({ files: [{ id: 'f', name: 'Pics', mimeType: 'application/vnd.google-apps.folder' }, { id: 'd', name: 'Doc', mimeType: 'application/vnd.google-apps.document' }, { id: 'm', name: 'Map', mimeType: 'application/vnd.google-apps.map' }], nextPageToken: 'n2' })]);

    const page = await listFiles(CloudProvider.Drive, call, 'root', null);

    expect(page.next).toBe('n2');
    expect(page.entries.map((e) => [e.id, e.folder, e.importable])).toEqual([['f', true, true], ['d', false, true], ['m', false, false]]);
    expect(seen[0].endpoint).toBe('https://www.googleapis.com/drive/v3/files');
    expect(seen[0].query?.q).toBe("'root' in parents and trashed=false");
  });

  it('downloads a native doc as its PDF export, reading the bytes Composio stored', async () => {
    const { call, seen } = proxy([answer({ name: 'Brief', mimeType: 'application/vnd.google-apps.document' }), answer(null, { file: 'https://files/brief.pdf' })]);

    const file = await downloadFile(CloudProvider.Drive, call, 'd1', bytesAt([1, 2]));

    expect(file).toEqual({ name: 'Brief.pdf', mime: 'application/pdf', bytes: new Uint8Array([1, 2]) });
    expect(seen[1]).toEqual({ endpoint: 'https://www.googleapis.com/drive/v3/files/d1/export', query: { mimeType: 'application/pdf' } });
  });

  it('uploads the bytes, then names the file and files it in the folder', async () => {
    const { call, seen } = proxy([answer({ id: 'new' }), answer({ id: 'new' })]);

    expect(await uploadFile(CloudProvider.Drive, call, { folder: 'fold', name: 'a.png', mime: 'image/png', bytes: new Uint8Array([1, 2]) })).toBe(true);
    expect(seen[0]).toMatchObject({ method: 'POST', query: { uploadType: 'media' }, binary: { base64: 'AQI=', contentType: 'image/png' } });
    expect(seen[1]).toEqual({ endpoint: 'https://www.googleapis.com/drive/v3/files/new', method: 'PATCH', query: { addParents: 'fold' }, body: { name: 'a.png' } });
  });
});

describe('Dropbox through the proxy', () => {
  it('pages a folder with its cursor', async () => {
    const { call, seen } = proxy([answer({ entries: [{ '.tag': 'file', name: 'a.png', path_lower: '/a.png' }], has_more: false })]);

    expect((await listFiles(CloudProvider.Dropbox, call, null, 'c1')).entries).toEqual([{ id: '/a.png', name: 'a.png', folder: false, mime: null, importable: true }]);
    expect(seen[0]).toEqual({ endpoint: 'https://api.dropboxapi.com/2/files/list_folder/continue', method: 'POST', body: { cursor: 'c1' } });
  });

  it('downloads with the path in the API arg header', async () => {
    const { call, seen } = proxy([answer(null, { file: 'https://files/a', headers: { 'content-type': 'image/png' } })]);

    expect(await downloadFile(CloudProvider.Dropbox, call, '/x/a.png', bytesAt([7]))).toEqual({ name: 'a.png', mime: 'image/png', bytes: new Uint8Array([7]) });
    expect(seen[0].headers).toEqual({ 'Dropbox-API-Arg': '{"path":"/x/a.png"}' });
  });

  it('uploads as a binary body', async () => {
    const { call, seen } = proxy([answer({})]);

    expect(await uploadFile(CloudProvider.Dropbox, call, { folder: '/out/', name: 'a.png', mime: 'image/png', bytes: new Uint8Array([1]) })).toBe(true);
    expect(seen[0]).toMatchObject({ endpoint: 'https://content.dropboxapi.com/2/files/upload', headers: { 'Dropbox-API-Arg': '{"path":"/out/a.png","mode":"add","autorename":true}' }, binary: { base64: 'AQ==', contentType: 'application/octet-stream' } });
  });
});

describe('OneDrive through the proxy', () => {
  it('lists the root and pages with the next link Graph gives', async () => {
    const next = 'https://graph.microsoft.com/v1.0/me/drive/root/children?$skiptoken=x';
    const { call, seen } = proxy([answer({ value: [{ id: 'f', name: 'Pics', folder: {} }, { id: 'p', name: 'a.png', file: { mimeType: 'image/png' } }], '@odata.nextLink': next }), answer({ value: [] })]);

    const page = await listFiles(CloudProvider.OneDrive, call, null, null);
    await listFiles(CloudProvider.OneDrive, call, null, page.next);

    expect(page).toEqual({ entries: [{ id: 'f', name: 'Pics', folder: true, mime: null, importable: true }, { id: 'p', name: 'a.png', folder: false, mime: 'image/png', importable: true }], next });
    expect(seen.map((s) => s.endpoint)).toEqual(['https://graph.microsoft.com/v1.0/me/drive/root/children', next]);
  });

  it('refuses a cursor that is not a Graph link', async () => {
    const { call } = proxy([]);

    expect(await listFiles(CloudProvider.OneDrive, call, null, 'https://evil.test/x')).toEqual({ entries: [], next: null });
    expect(call).not.toHaveBeenCalled();
  });

  it('downloads an item and uploads into a folder by id', async () => {
    const { call, seen } = proxy([answer({ name: 'a.png', file: { mimeType: 'image/png' } }), answer(null, { file: 'https://files/a' }), answer({ id: 'n' })]);

    expect(await downloadFile(CloudProvider.OneDrive, call, 'i1', bytesAt([3]))).toEqual({ name: 'a.png', mime: 'image/png', bytes: new Uint8Array([3]) });
    expect(await uploadFile(CloudProvider.OneDrive, call, { folder: '', name: 'b c.png', mime: 'image/png', bytes: new Uint8Array([1]) })).toBe(true);
    expect(seen[1].endpoint).toBe('https://graph.microsoft.com/v1.0/me/drive/items/i1/content');
    expect(seen[2]).toMatchObject({ endpoint: 'https://graph.microsoft.com/v1.0/me/drive/items/root:/b%20c.png:/content', method: 'PUT' });
  });
});
