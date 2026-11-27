import { describe, expect, it } from 'vitest';
import { GitAction, GitFix, ToView } from '../messages';
import { git, gitHeard } from './git-state.svelte';

describe('gitHeard', () => {
  it('keeps the fix of a failed result and ends the pending state', () => {
    git.pending = true;
    gitHeard({ kind: ToView.GitResult, action: GitAction.Push, ok: false, text: 'rejected', fix: GitFix.PullAndPush });

    expect(git.result).toEqual({ action: GitAction.Push, ok: false, text: 'rejected', fix: GitFix.PullAndPush });
    expect(git.pending).toBe(false);
  });
});
