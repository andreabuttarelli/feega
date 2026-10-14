import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { applyOps, diffDoc } from './doc-ops';
import { landed, outgoing, remote } from './frame-sync';

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

const start = () => must(addClip(must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'a' } }, 'a')), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'b' } }, 'b'));

const retext = (doc: MotionDoc, id: string, text: string): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, props: { ...c.props, text } } : c)) }))
});

const text = (doc: MotionDoc, id: string) => findClip(doc, id)?.clip.props.text;

class Server {
  version = 1;
  doc = start();
  commit(ops: ReturnType<typeof diffDoc>) {
    this.doc = applyOps(this.doc, ops);
    this.version++;
    return { version: this.version, doc: this.doc };
  }
}

describe('an editor following a frame others edit too', () => {
  it('takes a remote edit and keeps its own unsaved one on top', () => {
    const base = { version: 1, doc: start() };
    const present = retext(start(), 'a', 'mine');

    const next = remote(base, present, { version: 2, doc: retext(start(), 'b', 'theirs') });

    expect(next?.base.version).toBe(2);
    expect([text(next!.present, 'a'), text(next!.present, 'b')]).toEqual(['mine', 'theirs']);
    expect(outgoing(next!.base, next!.present)).toHaveLength(1);
  });

  it('ignores a head it already has', () => {
    const base = { version: 3, doc: start() };
    expect(remote(base, start(), { version: 3, doc: start() })).toBeNull();
    expect(remote(base, start(), { version: 2, doc: start() })).toBeNull();
  });

  it('keeps what was typed while a save was on the wire', () => {
    const base = { version: 1, doc: start() };
    const sent = retext(start(), 'a', 'sent');
    const typedSince = retext(sent, 'b', 'typed since');

    const next = landed(base, sent, typedSince, { version: 3, doc: retext(retext(start(), 'a', 'sent'), 'b', 'from bo') });

    expect([text(next.present, 'a'), text(next.present, 'b')]).toEqual(['sent', 'typed since']);
    expect(next.base.version).toBe(3);
  });

  it('keeps its doc untouched when the save landed on its own base', () => {
    const base = { version: 1, doc: start() };
    const sent = retext(start(), 'a', 'sent');

    const next = landed(base, sent, sent, { version: 2, doc: structuredClone(sent) });

    expect(next.present).toBe(sent);
  });

  it('two editors converge on different and on the same field', () => {
    const server = new Server();
    let ana = { base: { version: 1, doc: start() }, present: start() };
    let bo = { base: { version: 1, doc: start() }, present: start() };

    ana.present = retext(retext(ana.present, 'a', 'ana'), 'b', 'ana-b');
    bo.present = retext(bo.present, 'b', 'bo-b');

    const anaSent = ana.present;
    ana = landed(ana.base, anaSent, ana.present, server.commit(outgoing(ana.base, anaSent)));
    const boSent = bo.present;
    bo = landed(bo.base, boSent, bo.present, server.commit(outgoing(bo.base, boSent)));
    ana = remote(ana.base, ana.present, { version: server.version, doc: server.doc }) ?? ana;

    expect(ana.present).toEqual(server.doc);
    expect(bo.present).toEqual(server.doc);
    expect([text(server.doc, 'a'), text(server.doc, 'b')]).toEqual(['ana', 'bo-b']);
  });
});
