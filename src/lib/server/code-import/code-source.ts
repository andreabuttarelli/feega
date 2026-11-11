import type { GithubCall } from './github';
import type { RepoRef } from './repo';
import { headOf, openPullRequest, rawReader } from './repo-sync';
import type { FileChange, ReadFile } from './write-back';

export enum SourceKind {
  Github = 'github',
  Folder = 'folder',
  Upload = 'upload'
}

export type PublishAsk = { branch: string; title: string; body: string };

export type Published = { url: string | null; branch: string | null; files: string[] };

export type CodeSource = {
  read: (rev: string) => ReadFile;
  head: (branch: string | null) => Promise<string | null>;
  publish: (base: string, files: FileChange[], ask: PublishAsk) => Promise<Published | null>;
};

export function githubSource(repo: RepoRef, call: GithubCall | null): CodeSource {
  return {
    read: (rev) => rawReader(repo, rev, call),
    head: (branch) => headOf(call, repo, branch),
    publish: async (base, files, ask) => {
      if (!call) {
        return null;
      }
      const pr = await openPullRequest(call, repo, { base, files, ...ask });
      return pr ? { ...pr, files: files.map((f) => f.path) } : null;
    }
  };
}
