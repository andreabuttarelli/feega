import { describe, expect, it, vi } from 'vitest';
import { embedSource, hostedPage, isSourceEmbed } from '$lib/motion/interactive/bundle';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { ProjectMode } from '$lib/project-mode';
import { RebuildOutcome, rebuildEmbed, type EmbedPlace, type RebuildPorts } from './embed-rebuild';

const NODE = '6f1c2a8e-0b7d-4f1e-9a3c-2d5e8f7a1b40';
const ORIGIN = 'https://oh.feega.app';
const PUBLISHED_AT = '2026-10-09T09:38:32.714Z';

function titled(text: string): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60, props: { text } }, 'title');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

const PUBLISHED = titled('Published words');
const CURRENT = titled('Unpublished draft');

const inputOf = (doc: MotionDoc) => ({ doc, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Saturn', fetchBlob: vi.fn() });

async function legacyPage(doc: MotionDoc): Promise<string> {
  return hostedPage(await embedSource(inputOf(doc)), ORIGIN)!;
}

const PLACE: EmbedPlace = { orgId: 'org', projectId: 'p', canvasId: 'c', brandId: null, title: 'Saturn', mode: ProjectMode.Standard, deleted: false };

function bucket(page: string, overrides: Partial<RebuildPorts> = {}) {
  let stored = { page, updatedAt: PUBLISHED_AT };
  const locks = new Set<string>();
  const write = vi.fn(async (_id: string, html: string) => {
    stored = { page: html, updatedAt: '2026-10-10T00:00:00.000Z' };
    return true;
  });
  const ports: RebuildPorts = {
    stored: vi.fn(async () => stored),
    place: vi.fn(async () => PLACE),
    revisionAt: vi.fn(async (_place, _id, at) => (at === PUBLISHED_AT ? PUBLISHED : null)),
    input: vi.fn(async (_place, doc) => inputOf(doc)),
    claim: vi.fn(async (id) => !locks.has(id) && Boolean(locks.add(id))),
    release: vi.fn(async (id) => void locks.delete(id)),
    write,
    ...overrides
  };
  return { ports, write, current: () => stored.page };
}

describe('rebuilding a legacy hosted embed', () => {
  it('a legacy page is rebuilt from the revision that was the head when it was published, not from the current doc', async () => {
    const { ports, write, current } = bucket(await legacyPage(PUBLISHED));

    expect(await rebuildEmbed(ports, NODE, ORIGIN)).toBe(RebuildOutcome.Rebuilt);

    expect(ports.revisionAt).toHaveBeenCalledWith(PLACE, NODE, PUBLISHED_AT);
    expect(write).toHaveBeenCalledTimes(1);
    expect(isSourceEmbed(current())).toBe(true);
    expect(current()).toContain('Published words');
    expect(current()).not.toContain('Unpublished draft');
  });

  it('a revision that does not compose to the published page is never written over it', async () => {
    const { ports, write } = bucket(await legacyPage(PUBLISHED), { revisionAt: vi.fn(async () => CURRENT) });

    expect(await rebuildEmbed(ports, NODE, ORIGIN)).toBe(RebuildOutcome.Mismatch);
    expect(write).not.toHaveBeenCalled();
  });

  it('without a revision at publish time the legacy page stays and nothing is written', async () => {
    const { ports, write } = bucket(await legacyPage(PUBLISHED), { revisionAt: vi.fn(async () => null) });

    expect(await rebuildEmbed(ports, NODE, ORIGIN)).toBe(RebuildOutcome.NoRevision);
    expect(write).not.toHaveBeenCalled();
  });

  it('the second visit finds the source format and does nothing', async () => {
    const { ports, write } = bucket(await legacyPage(PUBLISHED));

    await rebuildEmbed(ports, NODE, ORIGIN);

    expect(await rebuildEmbed(ports, NODE, ORIGIN)).toBe(RebuildOutcome.Current);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('concurrent visits rebuild once', async () => {
    const { ports, write } = bucket(await legacyPage(PUBLISHED));

    const outcomes = await Promise.all([rebuildEmbed(ports, NODE, ORIGIN), rebuildEmbed(ports, NODE, ORIGIN), rebuildEmbed(ports, NODE, ORIGIN)]);

    expect(write).toHaveBeenCalledTimes(1);
    expect(outcomes.filter((o) => o === RebuildOutcome.Rebuilt)).toHaveLength(1);
  });

  it('a deleted node, an uncensored project or an unpublished embed is never rebuilt', async () => {
    const page = await legacyPage(PUBLISHED);
    const deleted = bucket(page, { place: vi.fn(async () => ({ ...PLACE, deleted: true })) });
    const uncensored = bucket(page, { place: vi.fn(async () => ({ ...PLACE, mode: ProjectMode.Uncensored })) });
    const unpublished = bucket(page, { stored: vi.fn(async () => null) });

    expect(await rebuildEmbed(deleted.ports, NODE, ORIGIN)).toBe(RebuildOutcome.Deleted);
    expect(await rebuildEmbed(uncensored.ports, NODE, ORIGIN)).toBe(RebuildOutcome.Refused);
    expect(await rebuildEmbed(unpublished.ports, NODE, ORIGIN)).toBe(RebuildOutcome.Unpublished);
    expect([deleted.write, uncensored.write, unpublished.write].every((w) => w.mock.calls.length === 0)).toBe(true);
  });

  it('a page republished while rebuilding is left alone, and the lock is released', async () => {
    const page = await legacyPage(PUBLISHED);
    const reads = [{ page, updatedAt: PUBLISHED_AT }, { page, updatedAt: '2026-10-09T10:00:00.000Z' }];
    const { ports, write } = bucket(page, { stored: vi.fn(async () => reads.shift() ?? null) });

    expect(await rebuildEmbed(ports, NODE, ORIGIN)).toBe(RebuildOutcome.Changed);
    expect(write).not.toHaveBeenCalled();
    expect(ports.release).toHaveBeenCalledWith(NODE);
  });
});
