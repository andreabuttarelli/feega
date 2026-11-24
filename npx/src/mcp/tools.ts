import { z } from 'zod';
import { CLOUD_BASE, CloudError, CloudFailure, type CloudApi, type CloudComment } from '../../../inspect/src/host/cloud-api';
import type { ShareHost } from '../../../inspect/src/host/share-port';
import type { Editors } from './editors';

export const BILLING_URL = `${CLOUD_BASE}/app/settings/billing`;

export type CloudDeps = { api: CloudApi; share: ShareHost; editors: Editors; cwd: string };

export type Tool = { description: string; input: z.ZodRawShape; run: (input: any) => Promise<unknown> };

const FAILURE_TEXT: Record<CloudFailure, (error: CloudError) => string> = {
  [CloudFailure.NotSignedIn]: () => 'Not signed in to Feega. Run `npx feega` once and sign in, or set FEEGA_API_KEY to a feega_ key.',
  [CloudFailure.PlanRequired]: () => `Feega Cloud needs a paid plan. Ask the user to upgrade at ${BILLING_URL}.`,
  [CloudFailure.Http]: (error) => error.message
};

export const failureText = (error: unknown): string => (error instanceof CloudError ? FAILURE_TEXT[error.failure](error) : error instanceof Error ? error.message : String(error));

const commentView = (c: CloudComment) => ({
  id: c.id,
  sessionId: c.sessionId,
  author: c.authorName,
  text: c.body,
  place: `${c.sourceFile}:${c.sourceLine}:${c.sourceCol}`,
  file: c.sourceFile,
  line: c.sourceLine,
  column: c.sourceCol,
  selector: c.selector,
  replyTo: c.parentId,
  resolved: c.resolvedAt !== null,
  createdAt: c.createdAt
});

type Shared = { dir: string; ownsEditor: boolean };

export function cloudTools({ api, share, editors, cwd }: CloudDeps): Record<string, Tool> {
  const shared = new Map<string, Shared>();
  const sessionOf = new Map<string, string>();

  async function candidates(sessionId?: string): Promise<string[]> {
    if (sessionId) {
      return [sessionId];
    }
    if (shared.size) {
      return [...shared.keys()];
    }
    return (await api.liveSessions()).map((s) => s.id);
  }

  async function listed(sessionId: string | undefined, openOnly: boolean) {
    const all = await Promise.all((await candidates(sessionId)).map((id) => api.comments(id, openOnly)));
    const comments = all.flat();
    comments.forEach((c) => sessionOf.set(c.id, c.sessionId));
    return comments;
  }

  async function sessionHolding(commentId: string): Promise<string> {
    if (!sessionOf.has(commentId)) {
      await listed(undefined, false);
    }
    const found = sessionOf.get(commentId);
    if (!found) {
      throw new Error(`no comment ${commentId} in your sessions`);
    }
    return found;
  }

  return {
    feega_share: {
      description: 'Share the running Feega editor of a project as a live link teammates can open in the browser and comment on. Starts the editor if none runs. Needs a paid Feega Cloud plan.',
      input: {
        dir: z.string().optional().describe('Project folder; defaults to the current folder'),
        url: z.string().optional().describe('Address of an editor that already runs; skips starting one'),
        visitorsCanEdit: z.boolean().optional().describe('Let visitors edit the design, not only view and comment')
      },
      run: async ({ dir = cwd, url, visitorsCanEdit = false }: { dir?: string; url?: string; visitorsCanEdit?: boolean }) => {
        const editorUrl = url ?? (await editors.ensure(dir)).url;
        const info = await share.start({ dir, editorUrl, visitorsCanEdit });
        shared.set(info.id, { dir, ownsEditor: url === undefined });
        return { url: info.url, id: info.id, expiresAt: info.expiresAt };
      }
    },
    feega_snapshot: {
      description: 'Save a named snapshot of a shared session and return its permanent link.',
      input: { sessionId: z.string().describe('Id returned by feega_share'), name: z.string().describe('Name of the snapshot') },
      run: async ({ sessionId, name }: { sessionId: string; name: string }) => api.snapshot(sessionId, name)
    },
    feega_comments: {
      description: 'List comments left on a shared session, each with file:line:column, selector, author and text, so the code can be fixed. Without a sessionId, lists the sessions shared here, or your live ones.',
      input: { sessionId: z.string().optional(), openOnly: z.boolean().default(true).describe('Only unresolved comments') },
      run: async ({ sessionId, openOnly = true }: { sessionId?: string; openOnly?: boolean }) => ({ comments: (await listed(sessionId, openOnly)).map(commentView) })
    },
    feega_review: {
      description: 'Read the review of a shared session: whether the latest round is open, approved or has changes requested, who decided and why, and the comments still unresolved. Act on the feedback, then resolve the comments.',
      input: { sessionId: z.string().optional().describe('Id returned by feega_share; defaults to the session shared here') },
      run: async ({ sessionId }: { sessionId?: string }) => {
        const [id] = await candidates(sessionId);
        if (!id) {
          throw new Error('No shared session to review. Share one with feega_share.');
        }
        const review = await api.review(id);
        review.openComments.forEach((c) => sessionOf.set(c.id, c.sessionId));
        return {
          sessionId: id,
          status: review.status,
          round: review.revision?.number ?? null,
          summary: review.revision?.summary ?? null,
          verdicts: (review.revision?.verdicts ?? []).map((v) => ({ reviewer: v.reviewerName, verdict: v.verdict, note: v.note })),
          unresolved: review.openComments.map(commentView)
        };
      }
    },
    feega_resolve: {
      description: 'Mark a comment resolved, with an optional note saying what was changed.',
      input: { commentId: z.string(), note: z.string().optional() },
      run: async ({ commentId, note }: { commentId: string; note?: string }) => {
        const resolved = await api.resolve(await sessionHolding(commentId), commentId, note);
        return { id: resolved.id, resolved: true };
      }
    },
    feega_stop: {
      description: 'Stop sharing a session. Visitors then see a read-only snapshot with the comments.',
      input: { sessionId: z.string() },
      run: async ({ sessionId }: { sessionId: string }) => {
        await share.stop(sessionId);
        const held = shared.get(sessionId);
        shared.delete(sessionId);
        const editorStillShared = held && [...shared.values()].some((s) => s.dir === held.dir && s.ownsEditor);
        if (held?.ownsEditor && !editorStillShared) {
          await editors.release(held.dir);
        }
        return { stopped: true };
      }
    }
  };
}
