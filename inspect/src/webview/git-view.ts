import { GitAfter, GitFix, GitScope, GitState, type GitView } from '../messages';

export type GitNotice = { text: string; fix: GitFix };

export type GitUi = { header: string; notice: GitNotice | null; branchLine: string; files: string[]; primary: GitAfter; canCommit: boolean; canPush: boolean; showPush: boolean };

const NO_GIT = 'Git is not installed or not on your PATH. Install it to commit from Feega.';
const NOT_A_REPO = 'This folder is not a git repository.';
const NOTHING = 'Nothing to commit.';
const NO_REMOTE = 'This repository has no remote, so there is nowhere to push.';
const NO_BRANCH = 'No branch checked out';
const NO_AGENT = 'Install an agent';

const COPIED: Partial<Record<GitFix, string>> = {
  [GitFix.SignIn]: 'gh auth login',
  [GitFix.CopyInit]: 'git init',
  [GitFix.CopyRemote]: 'git remote add origin <url>'
};

const AGENT_LABEL: Partial<Record<GitFix, (agent: string) => string>> = {
  [GitFix.Sync]: (agent) => `Ask ${agent} to sync`,
  [GitFix.Agent]: (agent) => `Fix with ${agent}`
};

const FIXED_LABEL: Partial<Record<GitFix, string>> = {
  [GitFix.Pull]: 'Pull',
  [GitFix.PullAndPush]: 'Pull and push',
  [GitFix.Identity]: 'Save'
};

export const copyOf = (fix: GitFix): string | null => COPIED[fix] ?? null;

export function fixLabel(fix: GitFix, agent: string | null): string | null {
  const copied = copyOf(fix);
  if (copied) {
    return `Copy \`${copied}\``;
  }
  const byAgent = AGENT_LABEL[fix];
  if (byAgent) {
    return agent ? byAgent(agent) : NO_AGENT;
  }
  return FIXED_LABEL[fix] ?? null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function branchLineOf(view: GitView): string {
  if (!view.branch) {
    return NO_BRANCH;
  }
  const parts = [view.branch, view.ahead ? `${view.ahead} ahead` : '', view.behind ? `${view.behind} behind` : ''];
  return parts.filter(Boolean).join(' · ');
}

function headerOf(scope: GitScope, files: number, changes: number): string {
  if (scope === GitScope.All) {
    return `Commit all ${plural(files, 'changed file')}`;
  }
  return `Commit ${plural(changes, 'change')} in ${plural(files, 'file')}`;
}

function behindNotice(view: GitView): GitNotice | null {
  if (!view.upstream || !view.behind) {
    return null;
  }
  if (view.ahead) {
    return { text: `${view.branch} and ${view.upstream} have diverged.`, fix: GitFix.Sync };
  }
  return { text: `${view.branch} is ${plural(view.behind, 'commit')} behind ${view.upstream}.`, fix: GitFix.Pull };
}

const OFF: Omit<GitUi, 'notice'> = { header: '', branchLine: '', files: [], primary: GitAfter.Stay, canCommit: false, canPush: false, showPush: false };

export function gitUi(view: GitView, scope: GitScope, message: string, changes: number): GitUi {
  if (view.state === GitState.NoGit) {
    return { ...OFF, notice: { text: NO_GIT, fix: GitFix.None } };
  }
  if (view.state === GitState.NotRepo) {
    return { ...OFF, notice: { text: NOT_A_REPO, fix: GitFix.CopyInit } };
  }
  const files = scope === GitScope.All ? [...view.feega, ...view.others] : view.feega;
  const canPush = Boolean(view.branch && view.remote && (view.ahead > 0 || !view.upstream));
  const notice = behindNotice(view) ?? (!view.remote ? { text: NO_REMOTE, fix: GitFix.CopyRemote } : null) ?? (!files.length ? { text: NOTHING, fix: GitFix.None } : null);
  return {
    header: headerOf(scope, files.length, changes),
    notice,
    branchLine: branchLineOf(view),
    files,
    primary: view.remote ? GitAfter.Push : GitAfter.Stay,
    canCommit: files.length > 0 && message.trim().length > 0,
    canPush,
    showPush: canPush && view.ahead > 0
  };
}
