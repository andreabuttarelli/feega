import { ToView, type ViewMessage } from '../messages';
import type { CloudApi, CloudComment, CommentDraft } from './cloud-api';

export type CommentsCloud = {
  api: Pick<CloudApi, 'comments' | 'addComment' | 'resolve'>;
  sessionId: () => string | null;
};

export function commentsHost(cloud: CommentsCloud | undefined, post: (message: ViewMessage) => unknown) {
  let last: CloudComment[] = [];

  const disabled = () => post({ kind: ToView.Comments, enabled: false, comments: [] });

  async function show() {
    const session = cloud?.sessionId();
    if (!cloud || !session) {
      await disabled();
      return;
    }
    try {
      last = await cloud.api.comments(session, false);
      await post({ kind: ToView.Comments, enabled: true, comments: last });
    } catch (failure) {
      await post({ kind: ToView.Comments, enabled: true, comments: last, error: (failure as Error).message });
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
      await post({ kind: ToView.Comments, enabled: true, comments: last, error: (failure as Error).message });
      return;
    }
    await show();
  }

  return {
    show,
    add: (draft: CommentDraft) => change((api, session) => api.addComment(session, draft)),
    resolve: (id: string) => change((api, session) => api.resolve(session, id))
  };
}
