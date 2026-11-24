import { describe, expect, it } from 'vitest';
import { addRevision, listRevisions, readRevisionInput, readVerdictInput, ReviewStatus, reviewOf, RevisionCheck, setVerdict, statusOf, Verdict, VerdictOutcome } from './revisions';
import type { SessionRow } from './sessions';
import { fakeDb } from './testing/fake-db';

const SESSION: SessionRow = {
  id: 'abcdefghij',
  org_id: 'org-1',
  project_id: 'proj-1',
  host_user_id: 'host-1',
  project_name: 'Landing',
  visitor_role: 'viewer',
  status: 'live',
  started_at: '2026-11-21T10:00:00Z',
  closed_at: null,
  expires_at: '2026-11-21T22:00:00Z',
  snapshot_path: null
};
const HOST = { id: 'host-1', name: 'Grace' };
const ADA = { id: 'ada', name: 'Ada', role: 'viewer' as const };
const VERA = { id: 'vera', name: 'Vera', role: 'editor' as const };
const CHANGES = [{ file: 'src/Hero.tsx', added: 3, removed: 1 }];
const UNIQUE = { unique: { share_revisions: ['session_id', 'number'], share_verdicts: ['revision_id', 'reviewer_id'] } };

describe('statusOf', () => {
  it.each([
    [[], ReviewStatus.Open],
    [[Verdict.Approved], ReviewStatus.Approved],
    [[Verdict.Approved, Verdict.Approved], ReviewStatus.Approved],
    [[Verdict.ChangesRequested], ReviewStatus.ChangesRequested],
    [[Verdict.Approved, Verdict.ChangesRequested], ReviewStatus.ChangesRequested]
  ])('%j is %s', (verdicts, status) => {
    expect(statusOf(verdicts)).toBe(status);
  });
});

describe('readRevisionInput', () => {
  it('trims the summary and keeps the changes', () => {
    expect(readRevisionInput({ summary: ' Round two ', changes: CHANGES })).toEqual({ check: RevisionCheck.Valid, input: { summary: 'Round two', changes: CHANGES } });
  });

  it.each([
    [{ summary: ' ', changes: CHANGES }, RevisionCheck.BadSummary],
    [{ summary: 'x'.repeat(2001), changes: CHANGES }, RevisionCheck.BadSummary],
    [{ summary: 'ok', changes: 'nope' }, RevisionCheck.BadChanges],
    [{ summary: 'ok', changes: [{ file: 1 }] }, RevisionCheck.BadChanges],
    [{ summary: 'ok', changes: [{ file: '/etc/passwd', added: 0, removed: 0 }] }, RevisionCheck.BadChanges],
    [null, RevisionCheck.BadSummary]
  ])('rejects %j', (input, check) => {
    expect(readRevisionInput(input)).toEqual({ check });
  });
});

describe('readVerdictInput', () => {
  it('accepts a verdict with a trimmed note', () => {
    expect(readVerdictInput({ verdict: 'approved', note: ' ship ' })).toEqual({ verdict: Verdict.Approved, note: 'ship' });
  });

  it('refuses an unknown verdict', () => {
    expect(readVerdictInput({ verdict: 'maybe' })).toBeNull();
  });
});

describe('revisions', () => {
  it('numbers revisions one after the other', async () => {
    const db = fakeDb({}, UNIQUE);

    const first = await addRevision(db, SESSION, HOST, { summary: 'First', changes: CHANGES });
    const second = await addRevision(db, SESSION, HOST, { summary: 'Second', changes: [] });

    expect([first.number, second.number]).toEqual([1, 2]);
    expect((await listRevisions(db, SESSION.id)).map((revision) => revision.summary)).toEqual(['First', 'Second']);
  });

  it('starts every new revision open, whatever the last one decided', async () => {
    const db = fakeDb({}, UNIQUE);
    const first = await addRevision(db, SESSION, HOST, { summary: 'First', changes: [] });
    await setVerdict(db, SESSION, first.id, ADA, { verdict: Verdict.Approved, note: null });
    await addRevision(db, SESSION, HOST, { summary: 'Second', changes: [] });

    const [one, two] = await listRevisions(db, SESSION.id);

    expect([one.status, two.status]).toEqual([ReviewStatus.Approved, ReviewStatus.Open]);
  });

  it('lets a reviewer change their mind, one verdict each', async () => {
    const db = fakeDb({}, UNIQUE);
    const revision = await addRevision(db, SESSION, HOST, { summary: 'First', changes: [] });

    await setVerdict(db, SESSION, revision.id, ADA, { verdict: Verdict.ChangesRequested, note: 'Too tight' });
    await setVerdict(db, SESSION, revision.id, ADA, { verdict: Verdict.Approved, note: null });
    await setVerdict(db, SESSION, revision.id, VERA, { verdict: Verdict.Approved, note: null });

    const [only] = await listRevisions(db, SESSION.id);
    expect(only.verdicts.map((entry) => [entry.reviewerName, entry.verdict])).toEqual([
      ['Ada', Verdict.Approved],
      ['Vera', Verdict.Approved]
    ]);
    expect(only.status).toBe(ReviewStatus.Approved);
  });

  it('does not let the host approve their own revision', async () => {
    const db = fakeDb({}, UNIQUE);
    const revision = await addRevision(db, SESSION, HOST, { summary: 'First', changes: [] });

    const outcome = await setVerdict(db, SESSION, revision.id, { ...HOST, role: 'host' }, { verdict: Verdict.Approved, note: null });

    expect(outcome).toBe(VerdictOutcome.OwnRevision);
  });

  it('does not decide on a revision of another session', async () => {
    const db = fakeDb({}, UNIQUE);

    expect(await setVerdict(db, SESSION, 'missing', ADA, { verdict: Verdict.Approved, note: null })).toBe(VerdictOutcome.NotFound);
  });
});

describe('reviewOf', () => {
  it('gives the agent the latest verdict and what is still unresolved', async () => {
    const db = fakeDb(
      {
        share_comments: [
          { id: 'c1', session_id: SESSION.id, org_id: 'org-1', author_id: 'ada', author_name: 'Ada', body: 'Fix', selector: 's', source_file: 'a.ts', source_line: 1, source_col: 1, parent_id: null, created_at: '2026-11-21T10:00:00Z', resolved_at: null, resolved_by: null },
          { id: 'c2', session_id: SESSION.id, org_id: 'org-1', author_id: 'ada', author_name: 'Ada', body: 'Done', selector: 's', source_file: 'a.ts', source_line: 2, source_col: 1, parent_id: null, created_at: '2026-11-21T10:00:00Z', resolved_at: '2026-11-21T11:00:00Z', resolved_by: 'host-1' }
        ]
      },
      UNIQUE
    );
    const revision = await addRevision(db, SESSION, HOST, { summary: 'First', changes: [] });
    await setVerdict(db, SESSION, revision.id, ADA, { verdict: Verdict.ChangesRequested, note: 'See comments' });

    const review = await reviewOf(db, SESSION.id);

    expect(review.status).toBe(ReviewStatus.ChangesRequested);
    expect(review.revision?.number).toBe(1);
    expect(review.openComments.map((comment) => comment.id)).toEqual(['c1']);
  });

  it('is open with no revision at all', async () => {
    const review = await reviewOf(fakeDb({}, UNIQUE), SESSION.id);

    expect(review).toMatchObject({ status: ReviewStatus.Open, revision: null, openComments: [] });
  });
});
