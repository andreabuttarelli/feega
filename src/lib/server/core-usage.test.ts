import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { ActorKind, CoreEvent, MotionEditKind } from '$lib/core-usage';
import { diffDoc } from '$lib/motion/doc-ops';
import { commitOps } from '$lib/server/motion/frame-ops';
import { appendRevision } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';
import { Build, coreEvent, postHogSink, useCoreSink, type CoreBody } from './core-usage';

vi.mock('$lib/server/repos/canvas', async (real) => ({ ...(await real<object>()), patchNodeData: vi.fn(async () => ({ ok: true })) }));

const ORG = 'org-a';
const NODE = 'node-1';
const user = { kind: 'user' as const, id: 'u1' };

let sent: Omit<CoreBody, 'api_key'>[] = [];

beforeEach(() => {
  sent = [];
  useCoreSink((body) => sent.push(body));
});

afterEach(() => useCoreSink(null));

const names = () => sent.map((b) => b.event);

describe('frame_created / frame_edited, dove la revisione atterra', () => {
  it('la prima revisione è frame_created, le successive frame_edited una volta sola per frame', async () => {
    const { db } = revisionsDb();
    const doc = newMotionDoc(MotionFormat.Square);

    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc, actor: user });
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 1, doc, actor: user });
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 2, doc, actor: user });

    expect(names()).toEqual([CoreEvent.FrameCreated, CoreEvent.FrameEdited]);
    expect(sent[0]).toMatchObject({ distinct_id: 'u1', properties: { frame_id: NODE, actor: ActorKind.User, $process_person_profile: false } });
  });

  it('una scrittura in conflitto non conta', async () => {
    const { db } = revisionsDb();
    const doc = newMotionDoc(MotionFormat.Square);

    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc, actor: user });
    sent = [];
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc, actor: user });

    expect(sent).toEqual([]);
  });
});

function clipped(): MotionDoc {
  const made = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'a' } }, 'a');
  if (!made.ok) {
    throw new Error(made.error);
  }
  return made.doc;
}

const reclip = (doc: MotionDoc, change: Record<string, unknown>): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'a' ? { ...c, ...change } : c)) })) });

describe('motion_edited, dove gli op del frame atterrano', () => {
  async function edited(change: Record<string, unknown>) {
    const { db } = revisionsDb();
    const scope = { orgId: ORG, nodeId: NODE, node: { format: MotionFormat.Landscape } as never };
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: clipped(), actor: user });
    sent = [];
    await commitOps(db, { ...scope, baseVersion: 1, ops: diffDoc(clipped(), reclip(clipped(), change)), actor: user, summary: null });
    return sent.filter((b) => b.event === CoreEvent.MotionEdited).map((b) => b.properties.kind);
  }

  it('un keyframe è keyframe, uno spostamento nel tempo è timeline, un testo non è motion', async () => {
    expect(await edited({ keyframes: { opacity: [{ frame: 0, value: 0 }, { frame: 30, value: 1 }] } })).toEqual([MotionEditKind.Keyframe]);
    expect(await edited({ from: 12 })).toEqual([MotionEditKind.Timeline]);
    expect(await edited({ props: { text: 'b' } })).toEqual([]);
  });
});

describe('postHogSink', () => {
  it('in locale manda solo export e frame, con l id anonimo, e mai con FEEGA_TELEMETRY=0', () => {
    const local = { PUBLIC_FEEGA_LOCAL: '1', FEEGA_TELEMETRY_ID: 'install-1', FEEGA_TELEMETRY_KEY: 'phc_x' };

    expect(postHogSink({ ...local, FEEGA_TELEMETRY: '0' }, Build.Release)).toBeNull();
    expect(postHogSink({ ...local, DO_NOT_TRACK: '1' }, Build.Release)).toBeNull();
    expect(postHogSink({ PUBLIC_FEEGA_LOCAL: '1' }, Build.Release)).toBeNull();
    expect(postHogSink(local, Build.Release)).not.toBeNull();
    expect(postHogSink(local, Build.Dev)).toBeNull();
  });

  it('un deploy di preview non scrive nel progetto dei clienti', () => {
    expect(postHogSink({ PUBLIC_POSTHOG_KEY: 'phc_x', VERCEL_ENV: 'preview' }, Build.Release)).toBeNull();
    expect(postHogSink({ PUBLIC_POSTHOG_KEY: 'phc_x', VERCEL_ENV: 'production' }, Build.Release)).not.toBeNull();
  });

  it('senza utente non parte niente', () => {
    coreEvent(null, CoreEvent.CanvasOpened, { canvas_id: 'c' });
    expect(sent).toEqual([]);
  });
});
