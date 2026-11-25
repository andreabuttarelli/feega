export const CLOUD_BASE = 'https://oh.feega.app';

const HTTP_UNAUTHORIZED = 401;
const HTTP_PAYMENT_REQUIRED = 402;
const PLAN_REQUIRED = 'plan_required';
const SEATS_EXHAUSTED = 'seats_exhausted';

export enum VisitorRole {
  Viewer = 'viewer',
  Editor = 'editor'
}

export enum CloudFailure {
  NotSignedIn = 'not-signed-in',
  PlanRequired = 'plan-required',
  SeatsExhausted = 'seats-exhausted',
  Http = 'http'
}

export class CloudError extends Error {
  constructor(
    readonly failure: CloudFailure,
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

export type CloudComment = {
  id: string;
  sessionId: string;
  authorId: string;
  authorName: string;
  body: string;
  selector: string;
  sourceFile: string;
  sourceLine: number;
  sourceCol: number;
  parentId: string | null;
  revisionId?: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

export type CommentDraft = { body: string; selector: string; sourceFile: string; sourceLine: number; sourceCol: number; parentId?: string };

export type RevisionChange = { file: string; prop: string; value: string };

export type ReviewStatus = 'open' | 'changes_requested' | 'approved';

export type RevisionVerdict = { reviewerId: string; reviewerName: string; verdict: 'approved' | 'changes_requested'; note: string | null; decidedAt: string };

export type CloudRevision = { id: string; sessionId: string; number: number; authorId: string; summary: string; changes: RevisionChange[]; createdAt: string; verdicts: RevisionVerdict[]; status: ReviewStatus };

export type CloudRevisions = { status: ReviewStatus; revisions: CloudRevision[] };

export type CloudReview = { status: ReviewStatus; revision: CloudRevision | null; openComments: CloudComment[] };

export type ProFile = { path: string; content: string };

export type StartedSession = { id: string; url: string; hostToken: string; expiresAt: string };

export type LiveSession = { id: string; url: string; projectName: string; hostName: string; startedAt: string; expiresAt: string; status: string };

export type CloudDeps = { base?: string; token: () => Promise<string | null>; fetch?: typeof fetch };

export type CloudApi = ReturnType<typeof cloudApi>;

enum Verb {
  Get = 'GET',
  Post = 'POST',
  Patch = 'PATCH'
}

export function cloudApi({ base = CLOUD_BASE, token, fetch: send = fetch }: CloudDeps) {
  async function call<T>(verb: Verb, path: string, body?: unknown): Promise<T> {
    const bearer = await token();
    if (!bearer) {
      throw new CloudError(CloudFailure.NotSignedIn, 'not signed in to Feega');
    }
    const response = await send(`${base}/api/v1${path}`, {
      method: verb,
      headers: { authorization: `Bearer ${bearer}`, ...(body !== undefined && { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (payload.error === SEATS_EXHAUSTED) {
      throw new CloudError(CloudFailure.SeatsExhausted, 'No editor seats left', response.status);
    }
    if (response.status === HTTP_PAYMENT_REQUIRED || payload.error === PLAN_REQUIRED) {
      throw new CloudError(CloudFailure.PlanRequired, 'Feega Cloud needs a paid plan', response.status);
    }
    if (response.status === HTTP_UNAUTHORIZED) {
      throw new CloudError(CloudFailure.NotSignedIn, 'not signed in to Feega', response.status);
    }
    if (!response.ok) {
      throw new CloudError(CloudFailure.Http, payload.error ?? `request failed (${response.status})`, response.status);
    }
    return payload as T;
  }

  const commentsPath = (id: string) => `/sessions/${id}/comments`;

  return {
    startSession: (projectName: string, visitorRole: VisitorRole) => call<StartedSession>(Verb.Post, '/sessions', { projectName, visitorRole }),
    closeSession: (id: string) => call<{ snapshotUploadUrl: string }>(Verb.Post, `/sessions/${id}/close`),
    liveSessions: async () => (await call<{ sessions: LiveSession[] }>(Verb.Get, '/sessions?status=live')).sessions,
    snapshot: (id: string, name: string) => call<{ url: string }>(Verb.Post, `/sessions/${id}/snapshots`, { name }),
    comments: async (id: string, openOnly: boolean) => (await call<{ comments: CloudComment[] }>(Verb.Get, `${commentsPath(id)}${openOnly ? '?open=1' : ''}`)).comments,
    addComment: (id: string, draft: CommentDraft) => call<CloudComment>(Verb.Post, commentsPath(id), draft),
    resolve: (id: string, commentId: string, note?: string) => call<CloudComment>(Verb.Patch, `${commentsPath(id)}/${commentId}`, { resolved: true, ...(note && { note }) }),
    revisions: (id: string) => call<CloudRevisions>(Verb.Get, `/sessions/${id}/revisions`),
    publishRevision: (id: string, summary: string, changes: RevisionChange[]) => call<{ id: string; number: number }>(Verb.Post, `/sessions/${id}/revisions`, { summary, changes }),
    review: (id: string) => call<CloudReview>(Verb.Get, `/sessions/${id}/review`),
    setMember: (id: string, userId: string, role: VisitorRole) => call<unknown>(Verb.Post, `/sessions/${id}/members/${userId}`, { role }),
    libraryPro: async (id: string, framework: string) => (await call<{ files: ProFile[] }>(Verb.Get, `/library/pro/${id}?framework=${framework}`)).files
  };
}
