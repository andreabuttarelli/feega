import type { Db } from '$lib/server/db/client';
import { agentInstruction, asksAgent } from '$lib/canvas/comment-agent';
import { addComment, commentNodeId } from '$lib/server/canvas/canvas-comments';

const REPLY_MAX = 2000;

export type AgentJob = { prompt: string; nodeIds: string[]; canvasId: string; projectId: string };

export type AgentAnswer = { ok: true; text: string } | { ok: false; message: string };

export type CommentAgent = (job: AgentJob) => Promise<AgentAnswer>;

export enum MentionOutcome {
  Ignored = 'ignored',
  Answered = 'answered',
  Failed = 'failed'
}

type Mention = { orgId: string; projectId: string; canvasId: string; userId: string; commentId: string; parentId: string | null; nodeId: string | null; body: string };

async function pinnedNode(db: Db, input: Mention): Promise<string | null> {
  if (!input.parentId) {
    return input.nodeId;
  }

  return commentNodeId(db, { orgId: input.orgId, canvasId: input.canvasId, id: input.parentId });
}

function promptFor(instruction: string, nodeId: string | null): string {
  const place = nodeId ? `pinned to node ${nodeId}` : 'on the canvas';
  return `A teammate left a canvas comment ${place} and asked you: "${instruction}". Do it, then answer in one or two plain sentences saying what you did.`;
}

async function runAgent(agent: CommentAgent, job: AgentJob): Promise<AgentAnswer> {
  try {
    return await agent(job);
  } catch (cause) {
    return { ok: false, message: cause instanceof Error ? cause.message : 'unexpected error' };
  }
}

const replyBody = (answer: AgentAnswer): string => (answer.ok ? answer.text : `I could not run this: ${answer.message}`).slice(0, REPLY_MAX);

export async function answerMention(deps: { db: Db; agent: CommentAgent }, input: Mention): Promise<MentionOutcome> {
  if (!asksAgent(input.body)) {
    return MentionOutcome.Ignored;
  }

  const nodeId = await pinnedNode(deps.db, input);
  const answer = await runAgent(deps.agent, {
    prompt: promptFor(agentInstruction(input.body), nodeId),
    nodeIds: nodeId ? [nodeId] : [],
    canvasId: input.canvasId,
    projectId: input.projectId
  });

  await addComment(deps.db, {
    orgId: input.orgId,
    canvasId: input.canvasId,
    parentId: input.parentId ?? input.commentId,
    body: replyBody(answer),
    actor: { kind: 'user', id: input.userId },
    byAgent: true
  });

  return answer.ok ? MentionOutcome.Answered : MentionOutcome.Failed;
}
