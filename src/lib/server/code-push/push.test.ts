import { describe, expect, it } from 'vitest';
import { fakeGithub } from './fake-github.testkit';
import { githubHost } from './github-host';
import { GitFailure } from './git-host';
import { memoryLock } from './push-lock';
import { checkoutBranch, Fallback, openPull, PullKind, PushRefusal, pushFiles, pushStatus, readyPull, saveWip, sessionBranch, undoPush, type PushAsk, type Pushed } from './push';

const REPO = { owner: 'acme', repo: 'app', ref: null };

const setup = (opts: { push?: boolean } = {}) => {
  const gh = fakeGithub(opts);
  return { gh, host: githubHost(gh.call, REPO), lock: memoryLock() };
};

const ask = (over: Partial<PushAsk> = {}): PushAsk => ({
  name: 'Hero Redesign',
  files: [{ path: 'src/Hero.tsx', content: 'export const Hero = () => null;' }],
  title: 'UI edits from Feega',
  body: 'From the canvas',
  coAuthors: ['Ada <ada@acme.dev>'],
  ...over
});

const pushed = (out: unknown) => out as Pushed;

describe('pushFiles', () => {
  it('il ramo è feega/<nome>, mai il default', () => {
    expect(sessionBranch('Hero Redesign!')).toBe('feega/hero-redesign');
  });

  it('la prima spinta crea ramo e PR, la seconda aggiorna la stessa PR', async () => {
    const { gh, host, lock } = setup();

    const first = pushed(await pushFiles(host, lock, ask()));
    const second = pushed(await pushFiles(host, lock, ask({ files: [{ path: 'src/Hero.tsx', content: 'v2' }], since: { branch: first.branch, sha: first.sha } })));

    expect(first).toMatchObject({ ok: true, branch: 'feega/hero-redesign', touched: ['src/Hero.tsx'] });
    expect(second.pull!.number).toBe(first.pull!.number);
    expect(gh.pulls).toHaveLength(1);
    expect(gh.files('feega/hero-redesign')['src/Hero.tsx']).toBe('v2');
    expect(gh.files('main')['src/Hero.tsx']).toBeUndefined();
  });

  it('dopo il merge la modifica successiva apre un ramo e una PR nuovi', async () => {
    const { gh, host, lock } = setup();
    const first = pushed(await pushFiles(host, lock, ask()));
    gh.endPull(first.pull!.number, true);

    const next = pushed(await pushFiles(host, lock, ask({ since: { branch: first.branch, sha: first.sha } })));

    expect(next.branch).toBe('feega/hero-redesign-2');
    expect(next.pull!.number).not.toBe(first.pull!.number);
  });

  it('i co-autori finiscono nel messaggio del commit', async () => {
    const { gh, host, lock } = setup();
    await pushFiles(host, lock, ask());

    const commit = gh.calls.find((c) => c.endpoint.endsWith('/git/commits') && c.method === 'POST');
    expect((commit?.body as { message: string }).message).toContain('Co-authored-by: Ada <ada@acme.dev>');
  });

  it('force-push sul ramo: niente fast-forward forzato, si spinge sul ramo -sync', async () => {
    const { gh, host, lock } = setup();
    const first = pushed(await pushFiles(host, lock, ask()));
    gh.forcePush('feega/hero-redesign', { other: 'x' });

    const again = pushed(await pushFiles(host, lock, ask({ since: { branch: first.branch, sha: first.sha } })));

    expect(again).toMatchObject({ ok: true, branch: 'feega/hero-redesign-sync', fallback: Fallback.Diverged });
    expect(gh.files('feega/hero-redesign')).toEqual({ other: 'x' });
  });

  it('un ramo cancellato dopo una spinta finisce sul ramo -sync', async () => {
    const { gh, host, lock } = setup();
    const first = pushed(await pushFiles(host, lock, ask()));
    gh.deleteBranch('feega/hero-redesign');

    expect(await pushFiles(host, lock, ask({ since: { branch: first.branch, sha: first.sha } }))).toMatchObject({ ok: true, branch: 'feega/hero-redesign-sync', fallback: Fallback.BranchGone });
  });

  it('token revocato a metà spinta: nessun ramo parziale, unauthorized', async () => {
    const { gh, host, lock } = setup();
    gh.failAfter(5, 401);

    expect(await pushFiles(host, lock, ask())).toEqual({ ok: false, refusal: GitFailure.Unauthorized });
    expect(gh.branches()).toEqual(['main']);
  });

  it('due spinte in parallelo sulla stessa sessione: una passa, l’altra è busy, nessun errore muto', async () => {
    const { host, lock } = setup();

    const outs = await Promise.all([pushFiles(host, lock, ask()), pushFiles(host, lock, ask())]);

    expect(outs.map((o) => (o.ok ? 'ok' : o.refusal)).sort()).toEqual(['busy', 'ok']);
  });

  it('chi non può scrivere riceve read_only senza scritture', async () => {
    const { gh, host, lock } = setup({ push: false });

    expect(await pushFiles(host, lock, ask())).toMatchObject({ ok: false, refusal: PushRefusal.ReadOnly });
    expect(gh.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('non tocca mai un file .env', async () => {
    const { host, lock } = setup();

    expect(await pushFiles(host, lock, ask({ files: [{ path: 'apps/web/.env.local', content: 'A=1' }], confirmSensitive: true }))).toEqual({ ok: false, refusal: PushRefusal.EnvFile, paths: ['apps/web/.env.local'] });
  });

  it('config, lockfile e dotfile chiedono conferma prima', async () => {
    const { host, lock } = setup();
    const files = [
      { path: 'package-lock.json', content: '{}' },
      { path: 'tailwind.config.ts', content: 'x' },
      { path: '.eslintrc', content: 'x' },
      { path: 'src/Hero.tsx', content: 'x' }
    ];

    expect(await pushFiles(host, lock, ask({ files }))).toEqual({ ok: false, refusal: PushRefusal.NeedsConfirm, paths: ['package-lock.json', 'tailwind.config.ts', '.eslintrc'] });
    expect(await pushFiles(host, lock, ask({ files, confirmSensitive: true }))).toMatchObject({ ok: true });
  });

  it('un segreto finto incollato in un testo ferma la spinta prima di GitHub', async () => {
    const { gh, host, lock } = setup();

    const out = await pushFiles(host, lock, ask({ files: [{ path: 'src/Hero.tsx', content: `<p>${['sk', 'live', '51HxYzAbCdEfGhIjKlMnOpQr'].join('_')}</p>` }] }));

    expect(out).toEqual({ ok: false, refusal: PushRefusal.Secret, paths: ['src/Hero.tsx'] });
    expect(gh.calls).toEqual([]);
  });
});

describe('ramo di lavoro scelto', () => {
  it('il commit va sul ramo scelto, senza aprire PR', async () => {
    const { gh, host, lock } = setup();

    expect(await pushFiles(host, lock, ask({ branch: 'design/hero' }))).toMatchObject({ ok: true, branch: 'design/hero', pull: null });
    expect(gh.files('design/hero')['src/Hero.tsx']).toBeDefined();
    expect(gh.pulls).toHaveLength(0);
  });

  it('committare su main è un caso normale', async () => {
    const { gh, host, lock } = setup();

    expect(await pushFiles(host, lock, ask({ branch: 'main' }))).toMatchObject({ ok: true, branch: 'main' });
    expect(gh.files('main')['src/Hero.tsx']).toBeDefined();
  });

  it('un ramo protetto è rifiutato come protected, senza ripiego', async () => {
    const { gh, host, lock } = setup();
    gh.protect('main');

    expect(await pushFiles(host, lock, ask({ branch: 'main' }))).toEqual({ ok: false, refusal: PushRefusal.Protected });
    expect(gh.branches()).toEqual(['main']);
  });

  it('un commit altrui su un altro file resta: il nostro va sopra', async () => {
    const { gh, host, lock } = setup();
    const first = pushed(await pushFiles(host, lock, ask({ branch: 'main' })));
    gh.seed('main', { ...gh.files('main'), 'src/Other.tsx': 'by hand' });

    const next = await pushFiles(host, lock, ask({ branch: 'main', files: [{ path: 'src/Hero.tsx', content: 'v2' }], since: { branch: 'main', sha: first.sha } }));

    expect(next).toMatchObject({ ok: true });
    expect(gh.files('main')).toMatchObject({ 'src/Other.tsx': 'by hand', 'src/Hero.tsx': 'v2' });
  });

  it('un commit altrui sullo stesso file è conflict, nulla viene sovrascritto', async () => {
    const { gh, host, lock } = setup();
    const first = pushed(await pushFiles(host, lock, ask({ branch: 'main' })));
    gh.seed('main', { ...gh.files('main'), 'src/Hero.tsx': 'by hand' });

    expect(await pushFiles(host, lock, ask({ branch: 'main', files: [{ path: 'src/Hero.tsx', content: 'v2' }], since: { branch: 'main', sha: first.sha } }))).toEqual({ ok: false, refusal: PushRefusal.Conflict, paths: ['src/Hero.tsx'] });
    expect(gh.files('main')['src/Hero.tsx']).toBe('by hand');
  });

  it('una PR già aperta dal ramo viene restituita, mai aperta di nuovo', async () => {
    const { gh, host, lock } = setup();
    await pushFiles(host, lock, ask({ branch: 'design/hero' }));
    await openPull(host, { branch: 'design/hero', base: 'main', title: 'Hero', body: '', kind: PullKind.Draft });

    expect(await pushFiles(host, lock, ask({ branch: 'design/hero', files: [{ path: 'src/Hero.tsx', content: 'v3' }] }))).toMatchObject({ ok: true, pull: { number: 1 } });
    expect(gh.pulls).toHaveLength(1);
  });
});

describe('commit riconoscibili', () => {
  it('Feega è co-autore e il commit dice da quale tela viene', async () => {
    const { gh, host, lock } = setup();

    await pushFiles(host, lock, ask({ branch: 'main', canvasUrl: 'https://feega.app/p/p1/c/c1' }));

    const commit = gh.calls.find((c) => c.endpoint.endsWith('/git/commits') && c.method === 'POST');
    const message = (commit?.body as { message: string }).message;
    expect(message).toContain('Co-authored-by: Feega <hi@feega.app>');
    expect(message).toContain('Feega-Canvas: https://feega.app/p/p1/c/c1');
    expect(message).toContain('Co-authored-by: Ada <ada@acme.dev>');
  });
});

describe('autosave sul ref di lavoro', () => {
  it('scrive refs/feega/wip/<ramo> e lascia il ramo dov’è; il secondo salvataggio sostituisce il primo', async () => {
    const { gh, host, lock } = setup();
    const head = await host.headOf('main');

    const first = await saveWip(host, lock, { branch: 'main', files: [{ path: 'src/Hero.tsx', content: 'v1' }] });
    const second = await saveWip(host, lock, { branch: 'main', files: [{ path: 'src/Hero.tsx', content: 'v2' }] });

    expect(first).toMatchObject({ ok: true, ref: 'refs/feega/wip/main' });
    expect(await host.headOf('main')).toBe(head);
    expect(gh.files(gh.ref('refs/feega/wip/main')!)['src/Hero.tsx']).toBe('v2');
    expect(second.ok && (await host.isAncestor(head, second.sha))).toBe(true);
  });

  it('un ramo che non esiste ancora non si scrive: wip vuole un ramo scelto', async () => {
    const { host, lock } = setup();

    expect(await saveWip(host, lock, { branch: 'nope', files: [{ path: 'a', content: 'a' }] })).toEqual({ ok: false, refusal: GitFailure.BranchGone });
  });
});

describe('checkout e pull request', () => {
  it('un ramo esistente si sceglie com’è, uno nuovo nasce dalla base', async () => {
    const { host } = setup();
    const head = await host.headOf('main');

    expect(await checkoutBranch(host, { branch: 'main' })).toEqual({ ok: true, branch: 'main', head, created: false, pull: null });
    expect(await checkoutBranch(host, { branch: 'design/hero', from: 'main' })).toEqual({ ok: true, branch: 'design/hero', head, created: true, pull: null });
    expect(await host.headOf('design/hero')).toBe(head);
  });

  it('la PR si apre verso la base scelta, in bozza, e pronta la segna pronta', async () => {
    const { gh, host, lock } = setup();
    await pushFiles(host, lock, ask({ branch: 'design/hero' }));

    const pr = await openPull(host, { branch: 'design/hero', base: 'main', title: 'Hero', body: '', kind: PullKind.Draft });

    expect(pr).toMatchObject({ ok: true, pull: { number: 1 } });
    expect(gh.pulls[0]).toMatchObject({ base: 'main', draft: true });
    expect(await readyPull(host, 1)).toEqual({ ok: true, number: 1 });
    expect(gh.pulls[0].draft).toBe(false);
  });

  it('una PR dal ramo verso sé stesso è rifiutata', async () => {
    const { host } = setup();

    expect(await openPull(host, { branch: 'main', base: 'main', title: 't', body: '', kind: PullKind.Ready })).toEqual({ ok: false, refusal: PushRefusal.SameBranch });
  });
});

describe('undoPush', () => {
  it('annullare è un commit in avanti che ripristina solo i file toccati da quella spinta', async () => {
    const { gh, host, lock } = setup();
    gh.seed('main', { 'README.md': 'hi', 'src/Nav.tsx': 'nav v1' });
    const first = pushed(await pushFiles(host, lock, ask({ files: [{ path: 'src/Nav.tsx', content: 'nav v2' }, { path: 'src/Hero.tsx', content: 'hero' }] })));
    gh.seed('feega/hero-redesign', { ...gh.files('feega/hero-redesign'), 'src/Other.tsx': 'by hand' });

    const undone = await undoPush(host, lock, { branch: first.branch, parent: first.parent, paths: first.touched });

    expect(undone.ok).toBe(true);
    expect(gh.files('feega/hero-redesign')).toEqual({ 'README.md': 'hi', 'src/Nav.tsx': 'nav v1', 'src/Other.tsx': 'by hand' });
  });
});

describe('pushStatus', () => {
  it('dice PR, check, diverged e i file cambiati a monte: il polling vede ciò che un webhook perso non dice', async () => {
    const { gh, host, lock } = setup();
    const base = await host.headOf('main');
    const first = pushed(await pushFiles(host, lock, ask()));
    gh.checks[first.sha] = [{ name: 'test', status: 'completed', conclusion: 'success' }];

    expect(await pushStatus(host, { branch: first.branch, sha: first.sha, baseSha: base })).toMatchObject({ ok: true, diverged: false, upstream: [], pull: { number: 1, status: 'open', checks: [{ name: 'test', conclusion: 'success' }] } });

    gh.seed('main', { 'README.md': 'changed upstream' });
    expect(await pushStatus(host, { branch: first.branch, sha: first.sha, baseSha: base })).toMatchObject({ ok: true, upstream: [{ path: 'README.md', move: 'modified' }] });
  });

  it('un force-push sul ramo si vede come diverged', async () => {
    const { gh, host, lock } = setup();
    const base = await host.headOf('main');
    const first = pushed(await pushFiles(host, lock, ask()));
    gh.forcePush('feega/hero-redesign', { a: 'b' });

    expect(await pushStatus(host, { branch: first.branch, sha: first.sha, baseSha: base })).toMatchObject({ ok: true, diverged: true });
  });

  it('una PR chiusa senza merge resta leggibile come closed', async () => {
    const { gh, host, lock } = setup();
    const base = await host.headOf('main');
    const first = pushed(await pushFiles(host, lock, ask()));
    gh.endPull(first.pull!.number, false);

    expect(await pushStatus(host, { branch: first.branch, sha: first.sha, baseSha: base })).toMatchObject({ ok: true, pull: { status: 'closed' } });
  });
});
