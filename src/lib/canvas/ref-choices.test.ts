import { describe, expect, it } from 'vitest';
import { RefGroup, refChoices } from './ref-choices';

describe('le scelte del selettore di versioni', () => {
  it('rami, tag, PR e commit, ognuno col ref da chiedere e un nome leggibile', () => {
    const groups = refChoices({
      refs: [
        { name: 'main', kind: 'branch', sha: 'aaaaaaa1' },
        { name: 'feega/x', kind: 'branch', sha: 'bbbbbbb2' },
        { name: 'v1', kind: 'tag', sha: 'aaaaaaa1' }
      ],
      pulls: [{ number: 12, title: 'Hero copy', branch: 'feega/x', sha: 'bbbbbbb2' }],
      commits: [{ sha: 'ccccccc3dddd', message: 'Tighten hero', author: 'Ada', at: '2026-11-17' }]
    });

    expect(groups.map((g) => g.group)).toEqual([RefGroup.Branches, RefGroup.Tags, RefGroup.Pulls, RefGroup.Commits]);
    expect(groups[2].choices).toEqual([{ ref: '#12', label: 'PR #12', detail: 'Hero copy' }]);
    expect(groups[3].choices).toEqual([{ ref: 'ccccccc3dddd', label: 'ccccccc', detail: 'Tighten hero · Ada' }]);
  });

  it('un gruppo vuoto non si mostra', () => {
    expect(refChoices({ refs: [], pulls: [], commits: [] })).toEqual([]);
  });
});
