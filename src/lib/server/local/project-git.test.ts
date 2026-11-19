import { afterAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from '$lib/server/code-push/git-cli';
import { commitProject, compareUrl, projectDirOf, projectGit, pushProject } from './project-git';

const made: string[] = [];

afterAll(async () => {
  await Promise.all(made.map((d) => rm(d, { recursive: true, force: true })));
});

async function scratch() {
  const dir = await mkdtemp(join(tmpdir(), 'feega-project-git-'));
  made.push(dir);
  return dir;
}

async function repo() {
  const dir = await scratch();
  await git(dir, ['init', '-q', '-b', 'main']);
  await git(dir, ['config', 'user.email', 't@t']);
  await git(dir, ['config', 'user.name', 't']);
  await writeFile(join(dir, 'README.md'), 'hi\n');
  await git(dir, ['add', '.']);
  await git(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

async function canvasEdit(dir: string, name = 'a.json') {
  await mkdir(join(dir, '.feega', 'nodes'), { recursive: true });
  await writeFile(join(dir, '.feega', 'nodes', name), '{}\n');
}

describe('git del progetto aperto, non solo dei frame importati', () => {
  it('una cartella fuori da git non mostra il gruppo git', async () => {
    expect(await projectGit(await scratch())).toEqual({ git: false });
  });

  it('un repo mostra subito il ramo, anche senza frame importati', async () => {
    const status = await projectGit(await repo());
    expect(status).toMatchObject({ git: true, branch: 'main', changes: 0, ahead: 0, origin: null });
  });

  it('conta solo le modifiche della tela, non il resto del repo', async () => {
    const dir = await repo();
    await canvasEdit(dir);
    await writeFile(join(dir, 'other.txt'), 'x');
    expect(await projectGit(dir)).toMatchObject({ changes: 1 });
  });

  it('il commit prende solo .feega/ e lascia fuori il resto', async () => {
    const dir = await repo();
    await canvasEdit(dir);
    await writeFile(join(dir, 'other.txt'), 'x');

    await commitProject(dir, 'Update canvas');

    expect((await git(dir, ['log', '-1', '--format=%s'])).out.trim()).toBe('Update canvas');
    expect((await git(dir, ['show', '--name-only', '--format=', 'HEAD'])).out.trim()).toBe('.feega/nodes/a.json');
    expect(await projectGit(dir)).toMatchObject({ changes: 0 });
  });

  it('push su origin porta il ramo e azzera i commit avanti', async () => {
    const remote = await scratch();
    await git(remote, ['init', '-q', '--bare']);
    const dir = await repo();
    await git(dir, ['remote', 'add', 'origin', remote]);
    await canvasEdit(dir);
    await commitProject(dir, 'Update canvas');

    await pushProject(dir);

    expect(await projectGit(dir)).toMatchObject({ ahead: 0, origin: { github: null } });
    expect((await git(remote, ['rev-parse', 'main'])).out.trim()).toBe((await git(dir, ['rev-parse', 'HEAD'])).out.trim());
  });

  it('origin su GitHub espone il repo per la pull request', async () => {
    const dir = await repo();
    await git(dir, ['remote', 'add', 'origin', 'git@github.com:acme/site.git']);
    expect(await projectGit(dir)).toMatchObject({ origin: { github: 'acme/site' } });
  });

  it('senza token la PR si apre dalla pagina compare di GitHub', () => {
    expect(compareUrl('acme/site', 'main', 'feega/logo')).toBe('https://github.com/acme/site/compare/main...feega%2Flogo?expand=1');
  });

  it('la cartella del progetto è la cartella stessa, o quella che contiene il vecchio file .feega', async () => {
    const dir = await scratch();
    const file = join(dir, 'site.feega');
    await writeFile(file, '');
    expect(await projectDirOf(dir)).toBe(dir);
    expect(await projectDirOf(file)).toBe(dir);
  });
});
