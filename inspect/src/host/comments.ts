import { ToView, type ChangeRow, type ViewMessage } from '../messages';
import type { CloudApi, CloudComment, CloudRevisions, CommentDraft, RevisionChange } from './cloud-api';

export type CommentsCloud = {
  api: Pick<CloudApi, 'comments' | 'addComment' | 'resolve' | 'revisions' | 'publishRevision'>;
  sessionId: () => string | null;
};

const NO_REVIEW: CloudRevisions = { status: 'open', revisions: [] };

export function revisionChangesOf(rows: ChangeRow[]): RevisionChange[] {
  return rows.flatMap((row) => row.files.map((file) => ({ file, prop: row.prop, value: row.value })));
}

export function commentsHost(cloud: CommentsCloud | undefined, post: (message: ViewMessage) => unknown, changes: () => ChangeRow[]) {
  let last: CloudComment[] = [];
  let review: CloudRevisions = NO_REVIEW;

  const disabled = () => post({ kind: ToView.Comments, enabled: false, comments: [] });

  async function show() {
    const session = cloud?.sessionId();
    if (!cloud || !session) {
      await disabled();
      return;
    }
    try {
      last = await cloud.api.comments(session, false);
      review = await cloud.api.revisions(session);
      await post({ kind: ToView.Comments, enabled: true, comments: last, review });
    } catch (failure) {
      await post({ kind: ToView.Comments, enabled: true, comments: last, review, error: (failure as Error).message });
    }
  }

  async function change(run: (api: CommentsCloud['api'], session: string) => Promise<unknown>) {
    const session = cloud?.sessionId();
    if (!cloud || !session) {
      await disabled();
      return;
    }
    try {
      await run(cloud.api, session);
    } catch (failure) {
      await post({ kind: ToView.Comments, enabled: true, comments: last, review, error: (failure as Error).message });
      return;
    }
    await show();
  }

  return {
    show,
    add: (draft: CommentDraft) => change((api, session) => api.addComment(session, draft)),
    resolve: (id: string) => change((api, session) => api.resolve(session, id)),
    publish: (summary: string) => change((api, session) => api.publishRevision(session, summary, revisionChangesOf(changes())))
  };
}
