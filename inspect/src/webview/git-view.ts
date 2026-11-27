import { GitScope, GitState, type GitView } from '../messages';

export type GitUi = { notice: string | null; branchLine: string; files: string[]; canCommit: boolean; canPush: boolean; canPull: boolean };

const NO_GIT = 'Git is not installed or not on your PATH. Install it to commit from Feega.';
const NOT_A_REPO = 'This folder is not a git repository. Run `git init` in a terminal to start tracking it.';
const NOTHING = 'Nothing to commit.';
const NO_REMOTE = 'This repository has no remote, so there is nowhere to push.';
const NO_BRANCH = 'No branch checked out';

const OFF: Omit<GitUi, 'notice'> = { branchLine: '', files: [], canCommit: false, canPush: false, canPull: false };

function branchLineOf(view: GitView): string {
  if (!view.branch) {
    return NO_BRANCH;
  }
  const parts = [view.branch, view.ahead ? `${view.ahead} ahead` : '', view.behind ? `${view.behind} behind` : ''];
  return parts.filter(Boolean).join(' · ');
}

export function gitUi(view: GitView, scope: GitScope, message: string): GitUi {
  if (view.state === GitState.NoGit) {
    return { ...OFF, notice: NO_GIT };
  }
  if (view.state === GitState.NotRepo) {
    return { ...OFF, notice: NOT_A_REPO };
  }
  const files = scope === GitScope.All ? [...view.feega, ...view.others] : view.feega;
  const canPush = Boolean(view.branch && view.remote && (view.ahead > 0 || !view.upstream));
  const notice = !files.length ? NOTHING : !view.remote ? NO_REMOTE : null;
  return { notice, branchLine: branchLineOf(view), files, canCommit: files.length > 0 && message.trim().length > 0, canPush, canPull: Boolean(view.upstream && view.behind > 0) };
}
