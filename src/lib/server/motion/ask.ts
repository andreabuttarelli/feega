import { json } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { findNode, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { findProjectById } from '$lib/server/repos/projects';
import { createRun, failRun, runsByIds, settleRun, type NodeRun } from '$lib/server/repos/node-runs';
import { agentActor } from '$lib/server/repos/actor';
import { motionAsk, offeredChatModels, resolveChoice } from '$lib/server/chat-model/catalogue';
import { runInBackground } from '$lib/server/background-work';
import { motionEditorPath, motionOf, type MotionNode } from '$lib/canvas/motion-node';
import { Restore, headOrNew, restoreRevision } from '$lib/server/motion/editor';
import { listRevisions } from '$lib/server/repos/motion-revisions';
import { docSummary } from '$lib/server/motion/motion-tools';
import { MOTION_ASK_KIND } from '$lib/server/motion/ask-kind';
import { Browser, startMotionTurn, type MotionTurn, type TurnOutcome } from '$lib/server/motion/turn';
import { ATTACHMENT_PORTS, AttachmentFailure, resolveSources, type AttachmentSource } from '$lib/server/chat-attachments/register';
import type { ChatAttachment } from '$lib/chat-attachments';
import { failed } from '$lib/server/chat-attachments/route-scope';
import { loadTurns, openNodeThread } from '$lib/server/repos/chat';
import { Mark, answerText, pickOf, type PickAsk } from '$lib/reference-pick';

export const MCP_AGENT_KEY = 'mcp';
const HTTP_NOT_FOUND = 404;
const HTTP_UNAVAILABLE = 503;
const HTTP_CONFLICT = 409;

type Motion = { record: CanvasNodeRecord; node: MotionNode };

async function findMotion(db: Db, scope: { orgId: string; nodeId: string }): Promise<Motion | null> {
  const record = await findNode(db, scope);
  const node = record ? motionOf(record) : null;
  return record && node ? { record, node } : null;
}

const editorUrl = (record: CanvasNodeRecord) => motionEditorPath({ projectId: record.projectId, canvasId: record.canvasId, nodeId: record.id });

const notFound = () => json({ error: 'motion_node_not_found' }, { status: HTTP_NOT_FOUND });

async function attached(db: Db, scope: Parameters<typeof resolveSources>[1], sources: AttachmentSource[]): Promise<ChatAttachment[] | Response> {
  try {
    return await resolveSources(db, scope, sources, ATTACHMENT_PORTS);
  } catch (e) {
    if (e instanceof AttachmentFailure) {
      return failed(e);
    }
    throw e;
  }
}

export type PickReply = { follow: string[]; avoid: string[]; note?: string };

const noPickAsked = () => json({ error: 'no_reference_pick_asked' }, { status: HTTP_CONFLICT });

async function askedPick(db: Db, scope: { orgId: string; userId: string; projectId: string; nodeId: string; brandId: string | null }): Promise<PickAsk | null> {
  const threadId = await openNodeThread(db, scope);
  const turns = await loadTurns(db, { orgId: scope.orgId, threadId });
  const last = turns.findLast((t) => t.role === 'assistant');
  return last ? pickOf(last) : null;
}

function pickPrompt(ask: PickAsk, reply: PickReply, prompt: string): string {
  const marks = Object.fromEntries([...reply.follow.map((id) => [id, Mark.Follow]), ...reply.avoid.map((id) => [id, Mark.Avoid])]);
  const answer = answerText(ask, marks, reply.note ?? '');
  return prompt ? `${prompt}\n\n${answer}` : answer;
}

export type AskStarted = { runId: string; model: string; refusedModel: string | null };

export async function askMotion(db: Db, input: { orgId: string; userId: string; nodeId: string; prompt: string; attachments?: AttachmentSource[]; agentKey?: string; choice?: { model?: unknown; reasoning?: unknown }; pick?: PickReply }): Promise<AskStarted | Response> {
  const { orgId, userId, nodeId, attachments: sources = [], agentKey = MCP_AGENT_KEY, choice: asked = {} } = input;
  const motion = await findMotion(db, { orgId, nodeId });
  const project = motion ? await findProjectById(db, { orgId, projectId: motion.record.projectId }) : null;
  if (!motion || !project) {
    return notFound();
  }

  const pickAsked = input.pick ? await askedPick(db, { orgId, userId, projectId: project.id, nodeId, brandId: project.brandId }) : null;
  if (input.pick && !pickAsked) {
    return noPickAsked();
  }
  const prompt = input.pick && pickAsked ? pickPrompt(pickAsked, input.pick, input.prompt) : input.prompt;

  const attachments = await attached(db, { orgId, projectId: project.id, mode: project.mode }, sources);
  if (attachments instanceof Response) {
    return attachments;
  }

  const guarded = motionAsk(asked);
  const choice = resolveChoice(await offeredChatModels(), guarded.asked);
  if (!choice.ok) {
    return json({ error: choice.error }, { status: HTTP_UNAVAILABLE });
  }

  const turn = await startMotionTurn({
    db,
    userId,
    orgId,
    project,
    motion,
    message: prompt,
    attachments,
    selection: [],
    model: choice.choice.model,
    reasoning: choice.choice.reasoning,
    requester: agentActor(userId, agentKey),
    browser: Browser.Absent
  });
  if (turn instanceof Response) {
    return turn;
  }

  const run = await createRun(db, { orgId, nodeId, prompt, model: choice.choice.model, params: { kind: MOTION_ASK_KIND }, actorKind: 'agent', actorId: userId });
  runInBackground(() => settleAsk(db, run, turn), MOTION_ASK_KIND);
  return { runId: run.id, model: choice.choice.model, refusedModel: guarded.refused };
}

async function settleAsk(db: Db, run: NodeRun, turn: MotionTurn): Promise<void> {
  try {
    await turn.stream.pipeTo(new WritableStream());
    const outcome: TurnOutcome = await turn.done;
    await settleRun(db, { orgId: run.orgId, runId: run.id, params: { kind: MOTION_ASK_KIND, ...outcome }, costUsd: outcome.costUsd });
  } catch (e) {
    await failRun(db, { orgId: run.orgId, runId: run.id, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function askStatus(db: Db, input: { orgId: string; runId: string }): Promise<Record<string, unknown> | Response> {
  const [run] = await runsByIds(db, { ids: [input.runId] });
  const motion = run?.orgId === input.orgId && run.params.kind === MOTION_ASK_KIND ? await findMotion(db, { orgId: input.orgId, nodeId: run.nodeId }) : null;
  if (!run || !motion) {
    return json({ error: 'run_not_found' }, { status: HTTP_NOT_FOUND });
  }

  const outcome = run.params as Partial<TurnOutcome>;
  return {
    run_id: run.id,
    node_id: run.nodeId,
    status: run.status,
    prompt: run.prompt,
    reply: outcome.reply ?? null,
    summary: outcome.summary ?? null,
    version: outcome.version ?? null,
    revision: outcome.revision ?? null,
    reference_pick: outcome.pick ?? null,
    cost_usd: run.costUsd,
    error: run.error,
    editor_url: editorUrl(motion.record),
    started_at: run.startedAt,
    finished_at: run.finishedAt
  };
}

export async function motionSummary(db: Db, input: { orgId: string; nodeId: string }): Promise<Record<string, unknown> | Response> {
  const motion = await findMotion(db, input);
  if (!motion) {
    return notFound();
  }

  const head = await headOrNew(db, input, motion.node);
  return { node_id: motion.record.id, name: motion.record.displayName, version: head.version, last_change: head.summary, last_actor: head.actorKind, editor_url: editorUrl(motion.record), doc: docSummary(head.doc, []) };
}

export async function motionRevisions(db: Db, input: { orgId: string; nodeId: string }): Promise<Record<string, unknown> | Response> {
  const motion = await findMotion(db, input);
  if (!motion) {
    return notFound();
  }
  return { revisions: await listRevisions(db, input) };
}

const RESTORE_REFUSAL: Record<Restore.Missing | Restore.Conflict, () => Response> = {
  [Restore.Missing]: () => json({ error: 'no_such_version' }, { status: HTTP_NOT_FOUND }),
  [Restore.Conflict]: () => json({ error: 'conflict' }, { status: HTTP_CONFLICT })
};

export async function restoreMotion(db: Db, input: { orgId: string; userId: string; nodeId: string; version: number }): Promise<Record<string, unknown> | Response> {
  const motion = await findMotion(db, input);
  if (!motion) {
    return notFound();
  }
  const out = await restoreRevision(db, { orgId: input.orgId, nodeId: input.nodeId, node: motion.node, version: input.version, actor: agentActor(input.userId, MCP_AGENT_KEY) });
  if (out.outcome !== Restore.Restored) {
    return RESTORE_REFUSAL[out.outcome]();
  }
  return { version: out.head.version, restored: input.version };
}
