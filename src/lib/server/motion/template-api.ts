import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import { findNode } from '$lib/server/repos/canvas';
import { agentActor } from '$lib/server/repos/actor';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { motionOf } from '$lib/canvas/motion-node';
import { cardDetail } from '$lib/motion/template/card';
import { templateCard } from '$lib/motion/template/cards';
import { insertTemplate, setTemplateValues, templateFields } from '$lib/motion/template/library';
import { headOrNew, saveMotionDoc } from './editor';
import { templateLibrary } from './templates';
import { withTemplateSounds, type SfxMaker } from './template-sounds';
import { laySfx } from './sfx';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const API_AGENT_KEY = 'mcp';
const ID_LENGTH = 8;

export const addTemplateBody = z.object({
  id: z.string().min(1),
  at: z.number().min(0).default(0),
  vars: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  sound: z.boolean().default(true)
});

type Scope = { orgId: string; userId: string };
type NodeScope = Scope & { nodeId: string };

const newId = () => crypto.randomUUID().slice(0, ID_LENGTH);
const refuse = (error: string, status = HTTP_BAD_REQUEST) => json({ error }, { status });

const withCard = (id: string) => {
  const card = templateCard(id);
  return card ? { card: cardDetail(card) } : {};
};

export async function listTemplates(db: Db, scope: Scope): Promise<Record<string, unknown>> {
  const entries = await templateLibrary(db, { orgId: scope.orgId, actor: agentActor(scope.userId, API_AGENT_KEY) }).list();
  return {
    templates: entries.map((e) => ({
      id: e.id,
      name: e.template.name,
      description: e.template.description,
      seconds: e.template.doc.durationInFrames / e.template.doc.fps,
      ...withCard(e.id),
      fields: e.template.doc.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, group: f.group, min: f.min, max: f.max, options: f.options, default: f.default }))
    }))
  };
}

export async function addTemplate(db: Db, scope: NodeScope, raw: unknown, sfx?: SfxMaker): Promise<Record<string, unknown> | Response> {
  const body = addTemplateBody.safeParse(raw);
  if (!body.success) {
    return refuse('invalid_template_request');
  }
  const record = await findNode(db, { orgId: scope.orgId, nodeId: scope.nodeId });
  const node = record ? motionOf(record) : null;
  if (!record || !node) {
    return refuse('motion_node_not_found', HTTP_NOT_FOUND);
  }
  const actor = agentActor(scope.userId, API_AGENT_KEY);
  const entry = (await templateLibrary(db, { orgId: scope.orgId, actor }).list()).find((e) => e.id === body.data.id);
  if (!entry) {
    return refuse(`no template ${body.data.id}`, HTTP_NOT_FOUND);
  }

  const head = await headOrNew(db, scope, node);
  const placed = insertTemplate(head.doc, entry, { from: Math.round(body.data.at * head.doc.fps), newId });
  if (!placed.ok) {
    return refuse(placed.error);
  }
  const values = Object.fromEntries(Object.entries(body.data.vars).map(([k, v]) => [k, String(v)]));
  const filled = Object.keys(values).length ? setTemplateValues(placed.doc, placed.clipId, values) : placed;
  if (!filled.ok) {
    return refuse(filled.error);
  }
  const make = sfx ?? ((kind) => laySfx(db, { orgId: scope.orgId, projectId: record.projectId, nodeId: record.id, userId: scope.userId, actor }, kind));
  const sounded = body.data.sound ? await withTemplateSounds(filled.doc, placed.clipId, make, newId) : filled;
  const doc = sounded.ok ? sounded.doc : filled.doc;

  const write = await saveMotionDoc(db, { orgId: scope.orgId, nodeId: scope.nodeId, expectedVersion: head.version, doc, actor, summary: `Inserted ${entry.template.name}` });
  if (write.outcome !== RevisionOutcome.Written) {
    return refuse(write.outcome === RevisionOutcome.Invalid ? write.error : 'conflict', HTTP_CONFLICT);
  }
  return { version: write.head.version, clip_id: placed.clipId, sounds: sounded.ok ? null : sounded.error, fields: templateFields(doc, placed.clipId).map((f) => ({ key: f.key, value: f.value })) };
}
