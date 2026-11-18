import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from './git-cli';
import { GitError, GitFailure } from './git-host';

const VERSIONS_DIR = 'feega-versions';
const DEPENDENCIES = 'node_modules';
const ROOT_HASH_CHARS = 12;

const placeOf = (root: string, sha: string) => join(tmpdir(), VERSIONS_DIR, `${createHash('sha1').update(root).digest('hex').slice(0, ROOT_HASH_CHARS)}-${sha}`);

export async function checkoutAt(root: string, sha: string): Promise<string> {
  const at = placeOf(root, sha);
  if (existsSync(at)) {
    return at;
  }

  await mkdir(join(tmpdir(), VERSIONS_DIR), { recursive: true });
  const added = await git(root, ['worktree', 'add', '-q', '--detach', at, sha]);
  if (added.code) {
    throw new GitError(GitFailure.NotFound, added.code);
  }
  if (existsSync(join(root, DEPENDENCIES))) {
    await symlink(join(root, DEPENDENCIES), join(at, DEPENDENCIES), 'dir');
  }
  return at;
}
