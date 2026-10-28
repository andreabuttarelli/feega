import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { fakeDb } from '$lib/server/db/fake-db';
import { canvasNodeOf, connectVerdict, connectRefusal, EMPTY_ELEMENT_SOURCE } from './node-model';

describe('canvasNodeOf — una riga di nodes nel vocabolario di canConnect', () => {
  it('legge il medium dal type', () => {
    expect(canvasNodeOf({ type: 'text', data: {} })?.kind).toBe('text');
    expect(canvasNodeOf({ type: 'video', data: {} })?.kind).toBe('video');
  });

  it('legge l\'operazione di un nodo audio dai suoi params', () => {
    const node = canvasNodeOf({ type: 'audio', data: { params: { operation: 'voice_changer' } } });
    expect(node?.operation).toBe('voice_changer');
  });

  it('senza operazione salvata assume text to speech', () => {
    const node = canvasNodeOf({ type: 'audio', data: {} });
    expect(node?.operation).toBe('text_to_speech');
  });

  it('null per una riga assente', () => {
    expect(canvasNodeOf(null)).toBeNull();
  });
});

describe('connectVerdict — lo stesso canConnect della tela, lato server', () => {
  it('un testo verso un nodo audio in text to speech passa', () => {
    const source = { type: 'text', data: {} };
    const target = { type: 'audio', data: { params: { operation: 'text_to_speech' } } };
    expect(connectVerdict(source, target)).toBeNull();
  });

  it('un video verso lo stesso nodo si rifiuta, e nomina l\'operazione', () => {
    const source = { type: 'video', data: {} };
    const target = { type: 'audio', data: { params: { operation: 'text_to_speech' } } };
    const refusal = connectVerdict(source, target);
    expect(refusal).not.toBeNull();
    expect(refusal).toContain('text_to_speech');
  });

  it('lo stesso video verso un nodo in voice_changer passa', () => {
    const source = { type: 'video', data: {} };
    const target = { type: 'audio', data: { params: { operation: 'voice_changer' } } };
    expect(connectVerdict(source, target)).toBeNull();
  });

  it('una riga assente non rifiuta: non si sa abbastanza per dire no', () => {
    expect(connectVerdict(null, { type: 'audio', data: {} })).toBeNull();
  });
});

describe('connectRefusal — a free element feeds a node only while it holds one image', () => {
  const ORG = 'org-1';
  const row = (id: string, type: string, data: Record<string, unknown>) => ({ id, org_id: ORG, canvas_id: 'c', project_id: 'p', type, display_name: null, x: 0, y: 0, z: 0, width: null, height: null, data, version: 1, deleted_at: null });

  const docOf = (component: string, props: Record<string, unknown>) => {
    const doc = newMotionDoc(MotionFormat.Landscape);
    doc.tracks[0].clips = [newClip({ id: 'c1', from: 0, durationInFrames: 30, component: component as never, props })];
    return doc;
  };

  const refusalFor = (doc: unknown) => {
    const { db } = fakeDb({
      nodes: [row('el', 'element', { docHeadRevision: 1 }), row('img', 'image', { prompt: '' })],
      motion_revisions: [{ org_id: ORG, node_id: 'el', version: 1, doc, summary: null, actor_kind: 'user' }]
    }, { filter: true });

    return connectRefusal(db, { orgId: ORG, sourceNodeId: 'el', targetNodeId: 'img' });
  };

  it('lets an element holding an image feed an image node', async () => {
    expect(await refusalFor(docOf('Image', { assetId: 'a1' }))).toBeNull();
  });

  it('refuses an element that holds no image', async () => {
    expect(await refusalFor(docOf('Text', { text: 'hi' }))).toBe(EMPTY_ELEMENT_SOURCE);
  });
});
