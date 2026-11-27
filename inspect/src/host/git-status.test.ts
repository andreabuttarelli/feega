import { describe, expect, it } from 'vitest';
import { GitFix } from '../messages';
import { GitFailure, commitMessage, failureOf, fixFor, fixPrompt, parseStatus, splitFiles } from './git-status';

const PORCELAIN = [
  '# branch.oid 1234',
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +2 -1',
  '1 .M N... 100644 100644 100644 aaa bbb src/Hero.svelte',
  '1 A. N... 000000 100644 100644 aaa bbb src/New File.svelte',
  '1 .D N... 100644 100644 000000 aaa bbb src/Gone.svelte',
  '2 R. N... 100644 100644 100644 aaa bbb R100 src/Renamed.svelte\tsrc/Old.svelte',
  'u UU N... 100644 100644 100644 100644 aaa bbb ccc src/Clash.svelte',
  '? src/Fresh.css',
  '! ignored.log'
].join('\n');

describe('parseStatus', () => {
  it('reads branch, upstream and ahead/behind', () => {
    expect(parseStatus(PORCELAIN)).toMatchObject({ branch: 'main', upstream: 'origin/main', ahead: 2, behind: 1 });
  });

  it('lists every changed path, with spaces and renames, and skips ignored files', () => {
    expect(parseStatus(PORCELAIN).paths).toEqual(['src/Hero.svelte', 'src/New File.svelte', 'src/Gone.svelte', 'src/Renamed.svelte', 'src/Clash.svelte', 'src/Fresh.css']);
  });

  it('has no branch while detached and no upstream without one', () => {
    const out = parseStatus('# branch.oid 1234\n# branch.head (detached)\n');

    expect(out).toEqual({ branch: null, upstream: null, ahead: 0, behind: 0, paths: [] });
  });

  it('reads an empty repository without commits', () => {
    expect(parseStatus('# branch.oid (initial)\n# branch.head main\n')).toMatchObject({ branch: 'main', ahead: 0 });
  });
});

describe('splitFiles', () => {
  it('puts Feega-edited paths first and the rest apart', () => {
    expect(splitFiles(['a.svelte', 'b.css', 'c.ts'], new Set(['b.css']))).toEqual({ feega: ['b.css'], others: ['a.svelte', 'c.ts'] });
  });
});

describe('commitMessage', () => {
  const row = (at: string, prop: string) => ({ at, prop, files: [at.split(':')[0]] });

  it('names the properties and the component', () => {
    expect(commitMessage([row('src/Hero.svelte:1:1', 'padding'), row('src/Hero.svelte:2:1', 'fontSize')])).toBe('Update padding and font size in Hero');
  });

  it('counts each property once', () => {
    expect(commitMessage([row('src/Hero.svelte:1:1', 'text'), row('src/Hero.svelte:9:1', 'text')])).toBe('Update text in Hero');
  });

  it('lists two components and summarises more', () => {
    expect(commitMessage([row('src/Hero.svelte:1:1', 'color'), row('src/Nav.svelte:1:1', 'color')])).toBe('Update color in Hero and Nav');
    expect(commitMessage(['A', 'B', 'C'].map((n) => row(`src/${n}.svelte:1:1`, 'gap')))).toBe('Update gap in 3 files');
  });

  it('shortens a long property list', () => {
    expect(commitMessage(['text', 'color', 'gap', 'radius', 'margin'].map((p) => row('src/Hero.svelte:1:1', p)))).toBe('Update text, color, gap and 2 more in Hero');
  });

  it('is empty without changes', () => {
    expect(commitMessage([])).toBe('');
  });
});

describe('failureOf', () => {
  it.each([
    [' ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs', GitFailure.NeedsPull],
    ['! [rejected] main -> main (non-fast-forward)', GitFailure.NeedsPull],
    ['remote: Invalid username or password.\nfatal: Authentication failed for', GitFailure.Auth],
    ['fatal: could not read Username for https://github.com: terminal prompts disabled', GitFailure.Auth],
    ['git@github.com: Permission denied (publickey).', GitFailure.Auth],
    ['fatal: unable to auto-detect email address\n*** Please tell me who you are.', GitFailure.Identity],
    ['fatal: Not possible to fast-forward, aborting.', GitFailure.Diverged],
    ['fatal: no upstream configured', GitFailure.Other]
  ])('classifies %j', (err, expected) => {
    expect(failureOf(err)).toBe(expected);
  });
});

describe('fixFor', () => {
  it.each([
    [GitFailure.NeedsPull, GitFix.PullAndPush],
    [GitFailure.Diverged, GitFix.Sync],
    [GitFailure.Auth, GitFix.SignIn],
    [GitFailure.Identity, GitFix.Identity],
    [GitFailure.Other, GitFix.Agent]
  ])('%s offers %s', (failure, fix) => {
    expect(fixFor(failure)).toBe(fix);
  });
});

describe('fixPrompt', () => {
  const failed = { action: 'push', stderr: '! [rejected] main -> main (fetch first)' };
  const state = { branch: 'main', upstream: 'origin/main', ahead: 1, behind: 2, paths: ['src/Hero.svelte'] };

  it('describes the branch, the changed files and the git error', () => {
    const prompt = fixPrompt(failed, state);

    expect(prompt).toContain('push');
    expect(prompt).toContain('main');
    expect(prompt).toContain('origin/main');
    expect(prompt).toContain('1 ahead');
    expect(prompt).toContain('2 behind');
    expect(prompt).toContain('src/Hero.svelte');
    expect(prompt).toContain('fetch first');
  });

  it('forbids force pushing and asks for a safe resolution', () => {
    expect(fixPrompt(failed, state)).toMatch(/never force push/i);
  });
});
