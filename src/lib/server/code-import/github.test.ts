import { describe, expect, it, vi } from 'vitest';
import type { ProviderAnswer, ProviderCall } from '$lib/server/connections/account-links';
import { archiveOf, branchesOf, MAX_ARCHIVE_BYTES, reposOf, visibilityOf, Visibility } from './github';

const answer = (status: number, data: unknown, extra: Partial<ProviderAnswer> = {}): ProviderAnswer => ({ status, data, headers: {}, file: null, ...extra });

const calling = (byEndpoint: Record<string, ProviderAnswer>) => vi.fn(async (request: ProviderCall) => byEndpoint[request.endpoint] ?? answer(404, null));

const REPO = { owner: 'acme', repo: 'app', ref: null };

describe('reposOf e branchesOf', () => {
  it('elenca i repo dell\'account col ramo predefinito e se sono privati', async () => {
    const call = calling({ '/user/repos': answer(200, [{ full_name: 'acme/app', private: true, default_branch: 'main' }, { full_name: 'acme/site', private: false, default_branch: 'trunk' }]) });

    expect(await reposOf(call)).toEqual([
      { fullName: 'acme/app', private: true, branch: 'main' },
      { fullName: 'acme/site', private: false, branch: 'trunk' }
    ]);
    expect(call.mock.calls[0][0].query).toMatchObject({ sort: 'pushed' });
  });

  it('elenca i rami di un repo', async () => {
    const call = calling({ '/repos/acme/app/branches': answer(200, [{ name: 'main' }, { name: 'dev' }]) });

    expect(await branchesOf(call, REPO)).toEqual(['main', 'dev']);
  });

  it('una risposta che non è una lista è nessun repo', async () => {
    expect(await reposOf(calling({ '/user/repos': answer(401, { message: 'Bad credentials' }) }))).toEqual([]);
  });
});

describe('visibilityOf', () => {
  it('privato, pubblico, o fuori dalla portata dell\'account', async () => {
    expect(await visibilityOf(calling({ '/repos/acme/app': answer(200, { private: true }) }), REPO)).toBe(Visibility.Private);
    expect(await visibilityOf(calling({ '/repos/acme/app': answer(200, { private: false }) }), REPO)).toBe(Visibility.Public);
    expect(await visibilityOf(calling({}), REPO)).toBe(Visibility.Unreachable);
  });
});

describe('archiveOf', () => {
  const tarball = new Uint8Array([31, 139, 8, 0]);
  const fetched = vi.fn(async () => new Response(tarball));

  it('scarica dal link del file che il proxy restituisce, col ref chiesto', async () => {
    const call = calling({ '/repos/acme/app/tarball/v2': answer(200, null, { file: 'https://files.example/t.tgz' }) });

    expect(await archiveOf(call, { ...REPO, ref: 'v2' }, fetched as unknown as typeof fetch)).toEqual(tarball);
    expect(fetched).toHaveBeenCalledWith('https://files.example/t.tgz', expect.anything());
  });

  it('segue il redirect di GitHub quando il proxy non lo segue', async () => {
    const call = calling({ '/repos/acme/app/tarball': answer(302, null, { headers: { location: 'https://codeload.github.com/acme/app/legacy.tar.gz/main?token=x' } }) });

    expect(await archiveOf(call, REPO, fetched as unknown as typeof fetch)).toEqual(tarball);
  });

  it('niente link o un archivio troppo grande: nessun archivio', async () => {
    expect(await archiveOf(calling({}), REPO, fetched as unknown as typeof fetch)).toBeNull();
    const huge = vi.fn(async () => new Response(tarball, { headers: { 'content-length': String(MAX_ARCHIVE_BYTES + 1) } }));
    const call = calling({ '/repos/acme/app/tarball': answer(200, null, { file: 'https://files.example/t.tgz' }) });
    expect(await archiveOf(call, REPO, huge as unknown as typeof fetch)).toBeNull();
  });
});
