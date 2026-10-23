import { beforeEach, describe, expect, it, vi } from 'vitest';

const saved = vi.fn();
const publishMotionEmbed = vi.fn();
const readCanvasShare = vi.fn();
const setCanvasShare = vi.fn();
const embedPublished = vi.fn();

vi.mock('./agent-embed', () => ({
  EmbedFailure: { NotFound: 'motion_node_not_found', Refused: 'refused', Storage: 'storage_failed', Empty: 'nothing_to_publish', NotPublished: 'embed_not_published' },
  savedMotion: (...a: unknown[]) => saved(...a),
  publishMotionEmbed: (...a: unknown[]) => publishMotionEmbed(...a)
}));
vi.mock('./embed', () => ({ embedPublished: (...a: unknown[]) => embedPublished(...a) }));
vi.mock('$lib/server/canvas/canvas-share', () => ({
  ShareState: { On: 'on', Off: 'off' },
  readCanvasShare: (...a: unknown[]) => readCanvasShare(...a),
  setCanvasShare: (...a: unknown[]) => setCanvasShare(...a)
}));

const { frameLink, shareMotionFrame } = await import('./agent-share');

const SCOPE = { orgId: 'org-1', nodeId: 'n1' };
const ORIGIN = 'https://app.test';

beforeEach(() => {
  vi.clearAllMocks();
  saved.mockResolvedValue({ record: { canvasId: 'c1' }, project: { mode: 'standard' }, version: 3 });
  publishMotionEmbed.mockResolvedValue({ ok: true, body: { published: true, url: `${ORIGIN}/e/n1` } });
  embedPublished.mockResolvedValue(false);
  readCanvasShare.mockResolvedValue(null);
  setCanvasShare.mockResolvedValue('minted');
});

describe('shareMotionFrame', () => {
  it('publishes the embed and mints the canvas link when there is none', async () => {
    const answer = await shareMotionFrame({} as never, SCOPE, ORIGIN);

    expect(answer).toEqual({ ok: true, body: { url: `${ORIGIN}/s/minted/n1`, embed_url: `${ORIGIN}/e/n1` } });
    expect(setCanvasShare).toHaveBeenCalledWith(expect.anything(), { orgId: 'org-1', canvasId: 'c1', state: 'on' });
  });

  it('reuses a live canvas link, so links already sent stay valid', async () => {
    readCanvasShare.mockResolvedValue('live');

    const answer = await shareMotionFrame({} as never, SCOPE, ORIGIN);

    expect(answer).toMatchObject({ ok: true, body: { url: `${ORIGIN}/s/live/n1` } });
    expect(setCanvasShare).not.toHaveBeenCalled();
  });

  it('an unknown frame is not found', async () => {
    saved.mockResolvedValue(null);

    expect(await shareMotionFrame({} as never, SCOPE, ORIGIN)).toMatchObject({ ok: false, failure: 'motion_node_not_found' });
  });

  it('a project that may not share is refused before anything is published', async () => {
    saved.mockResolvedValue({ record: { canvasId: 'c1' }, project: { mode: 'uncensored' }, version: 3 });

    expect(await shareMotionFrame({} as never, SCOPE, ORIGIN)).toMatchObject({ ok: false, failure: 'refused', body: { refusal: 'uncensored_not_shareable' } });
    expect(publishMotionEmbed).not.toHaveBeenCalled();
  });

  it('an embed that cannot be published fails the share and mints nothing', async () => {
    publishMotionEmbed.mockResolvedValue({ ok: false, failure: 'nothing_to_publish', body: { error: 'nothing_to_publish' } });

    expect(await shareMotionFrame({} as never, SCOPE, ORIGIN)).toMatchObject({ ok: false, failure: 'nothing_to_publish' });
    expect(setCanvasShare).not.toHaveBeenCalled();
  });
});

describe('shareMotionFrame on a frame that is already published', () => {
  it('keeps the embed as it is instead of rebuilding it', async () => {
    embedPublished.mockResolvedValue(true);

    const answer = await shareMotionFrame({} as never, SCOPE, ORIGIN);

    expect(answer).toMatchObject({ ok: true, body: { url: `${ORIGIN}/s/minted/n1` } });
    expect(publishMotionEmbed).not.toHaveBeenCalled();
  });
});

describe('frameLink', () => {
  it('links a frame whose embed is already published', async () => {
    embedPublished.mockResolvedValue(true);

    expect(await frameLink({} as never, SCOPE, ORIGIN)).toEqual({ ok: true, body: { url: `${ORIGIN}/s/minted/n1`, embed_url: `${ORIGIN}/e/n1` } });
  });

  it('refuses a frame nobody published, and mints nothing', async () => {
    expect(await frameLink({} as never, SCOPE, ORIGIN)).toMatchObject({ ok: false, failure: 'embed_not_published' });
    expect(setCanvasShare).not.toHaveBeenCalled();
  });
});
