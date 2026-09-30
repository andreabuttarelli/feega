import { describe, expect, it, vi } from 'vitest';
import { fakeDb, filtersOf } from '$lib/server/db/fake-db';
import type { SocialPublisher, PublishReceipt, RemotePostStatus } from '$lib/server/publishing/port';

vi.mock('$lib/server/ads/provider-media', () => ({
  providerMediaSigner: () => async (media: { path: string }[]) =>
    new Map(media.map((m) => [m.path, m.path.startsWith('http') ? m.path : `https://signed.test/${m.path}`]))
}));

import {
  cancelDelivery,
  deliveryStatus,
  scheduleDelivery
} from './post-delivery';

const ORG = 'org-1';
const BRAND = 'brand-1';
const POST_ID = 'post-1';
const ACCOUNT_IG = 'account-ig';
const ACCOUNT_X = 'account-x';

const postRow = {
  id: POST_ID,
  brand_id: BRAND,
  caption: 'Ciao a tutti',
  per_platform: null,
  media: [{ assetId: 'asset-1', order: 0, role: 'primary' }],
  zernio_post_ids: {}
};

const accountRows = [
  { id: ACCOUNT_IG, brand_id: BRAND, platform: 'instagram', zernio_account_id: 'zern-ig-1', status: 'connected' },
  { id: ACCOUNT_X, brand_id: BRAND, platform: 'x', zernio_account_id: 'zern-x-1', status: 'connected' }
];

const assetRows = [
  { id: 'asset-1', org_id: ORG, type: 'image', url: 'https://cdn.feega.app/asset-1.jpg' }
];

function fakePublisher(overrides: Partial<SocialPublisher> = {}): SocialPublisher {
  return {
    kind: 'zernio',
    createProfile: vi.fn(),
    connectUrl: vi.fn(),
    adsConnectUrl: vi.fn(),
    pendingOAuthData: vi.fn(),
    selectLinkedInOrganization: vi.fn(),
    facebookPages: vi.fn(),
    selectFacebookPage: vi.fn(),
    accounts: vi.fn(),
    publish: vi.fn(async (): Promise<PublishReceipt> => ({ ok: true, postId: 'zernio-new-1' })),
    postStatus: vi.fn(async (): Promise<RemotePostStatus> => ({
      status: 'scheduled',
      url: null,
      error: null,
      scheduledFor: null
    })),
    deletePost: vi.fn(async () => {}),
    disconnectAccount: vi.fn(),
    analyticsPosts: vi.fn(),
    ...overrides
  } as SocialPublisher;
}

describe('scheduleDelivery — media from an uncensored model', () => {
  const rawAssets = [{ ...assetRows[0], uncensored: true }];

  it('is blocked on a platform whose policy forbids adult content, even when confirmed', async () => {
    const { db } = fakeDb({ posts: [postRow], social_accounts: [accountRows[0]], assets: rawAssets });
    const publisher = fakePublisher();

    const result = await scheduleDelivery(db, publisher, { orgId: ORG, postId: POST_ID, accountIds: [ACCOUNT_IG], confirmUncensored: true });

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(result.deliveries).toEqual([{ accountId: ACCOUNT_IG, ok: false, error: 'adult_content_forbidden_on_instagram' }]);
  });

  it('needs an explicit confirmation where the platform allows it, so it is never auto-published', async () => {
    const { db } = fakeDb({ posts: [postRow], social_accounts: [accountRows[1]], assets: rawAssets });
    const publisher = fakePublisher();

    const result = await scheduleDelivery(db, publisher, { orgId: ORG, postId: POST_ID, accountIds: [ACCOUNT_X] });

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(result.deliveries).toEqual([{ accountId: ACCOUNT_X, ok: false, error: 'uncensored_needs_confirmation' }]);
  });

  it('publishes where allowed once confirmed', async () => {
    const { db } = fakeDb({ posts: [postRow], social_accounts: [accountRows[1]], assets: rawAssets });
    const publisher = fakePublisher();

    const result = await scheduleDelivery(db, publisher, { orgId: ORG, postId: POST_ID, accountIds: [ACCOUNT_X], confirmUncensored: true });

    expect(publisher.publish).toHaveBeenCalledOnce();
    expect(result.deliveries[0]).toMatchObject({ ok: true });
  });
});

describe('scheduleDelivery — media from an uncensored project', () => {
  it('is never published, on any platform, confirmed or not', async () => {
    const { db } = fakeDb({ posts: [postRow], social_accounts: [accountRows[1]], assets: [{ ...assetRows[0], uncensored_project: true }] });
    const publisher = fakePublisher();

    const result = await scheduleDelivery(db, publisher, { orgId: ORG, postId: POST_ID, accountIds: [ACCOUNT_X], confirmUncensored: true });

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(result.deliveries).toEqual([{ accountId: ACCOUNT_X, ok: false, error: 'uncensored_not_publishable' }]);
  });
});

describe('scheduleDelivery', () => {
  it('pubblica una volta per account e scrive il puntatore per quell account', async () => {
    const { db } = fakeDb({ posts: [postRow], social_accounts: [accountRows[0]], assets: assetRows });
    const publisher = fakePublisher();

    const result = await scheduleDelivery(db, publisher, {
      orgId: ORG,
      postId: POST_ID,
      accountIds: [ACCOUNT_IG]
    });

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'zern-ig-1', platform: 'instagram', content: 'Ciao a tutti' })
    );
    expect(result.deliveries).toEqual([{ accountId: ACCOUNT_IG, ok: true, zernioPostId: 'zernio-new-1' }]);
  });

  it('una consegna per account: due account, due chiamate a publish', async () => {
    const { db } = fakeDb({ posts: [postRow], social_accounts: accountRows, assets: assetRows });
    const publisher = fakePublisher();

    await scheduleDelivery(db, publisher, {
      orgId: ORG,
      postId: POST_ID,
      accountIds: [ACCOUNT_IG, ACCOUNT_X]
    });

    expect(publisher.publish).toHaveBeenCalledTimes(2);
  });

  it('passa scheduledFor a Zernio quando c e, publishNow altrimenti', async () => {
    const { db } = fakeDb({ posts: [postRow], social_accounts: accountRows, assets: assetRows });
    const publisher = fakePublisher();

    await scheduleDelivery(db, publisher, {
      orgId: ORG,
      postId: POST_ID,
      accountIds: [ACCOUNT_IG],
      scheduledFor: '2030-01-01T10:00:00.000Z'
    });

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledFor: '2030-01-01T10:00:00.000Z' })
    );
  });

  it('scrive zernio_post_ids scoperto per org_id: mai una consegna sul post di un altra org', async () => {
    const { db, calls } = fakeDb({ posts: [postRow], social_accounts: accountRows, assets: assetRows });
    const publisher = fakePublisher();

    await scheduleDelivery(db, publisher, { orgId: ORG, postId: POST_ID, accountIds: [ACCOUNT_IG] });

    const updateCall = calls.find((c) => c.table === 'posts' && c.op === 'update');
    expect(filtersOf([updateCall!], 'update')).toMatchObject({ org_id: ORG, id: POST_ID });
  });

  it('un media che non sta sulla piattaforma è rifiutato, non pubblicato troncato', async () => {
    const twoImages = {
      ...postRow,
      media: [
        { assetId: 'asset-1', order: 0, role: 'primary' },
        { assetId: 'asset-2', order: 1, role: 'primary' }
      ]
    };
    const threadsAccount = { id: 'account-threads', brand_id: BRAND, platform: 'threads', zernio_account_id: 'zern-th-1', status: 'connected' };
    const { db } = fakeDb({
      posts: [twoImages],
      social_accounts: [threadsAccount],
      assets: [assetRows[0], { id: 'asset-2', org_id: ORG, type: 'image', url: 'https://cdn.feega.app/asset-2.jpg' }]
    });
    const publisher = fakePublisher();

    const result = await scheduleDelivery(db, publisher, {
      orgId: ORG,
      postId: POST_ID,
      accountIds: [threadsAccount.id]
    });

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(result.deliveries[0]).toMatchObject({ accountId: threadsAccount.id, ok: false });
  });

  it('firma un asset che è un percorso di storage prima di mandarlo a Zernio, mai il percorso nudo', async () => {
    const storedAsset = { id: 'asset-stored', org_id: ORG, type: 'image', url: 'org-1/project-1/asset-stored.jpg' };
    const postWithStoredAsset = { ...postRow, media: [{ assetId: 'asset-stored', order: 0, role: 'primary' }] };
    const { db } = fakeDb({ posts: [postWithStoredAsset], social_accounts: [accountRows[0]], assets: [storedAsset] });
    const publisher = fakePublisher();

    await scheduleDelivery(db, publisher, {
      orgId: ORG,
      postId: POST_ID,
      accountIds: [ACCOUNT_IG]
    });

    const [call] = (publisher.publish as ReturnType<typeof vi.fn>).mock.calls;
    const mediaUrls = call[0].mediaUrls as string[];
    expect(mediaUrls).toHaveLength(1);
    expect(mediaUrls[0]).toMatch(/^https:\/\//);
    expect(mediaUrls[0]).not.toBe(storedAsset.url);
  });

  it('un fallimento Zernio su un account non impedisce la consegna sugli altri', async () => {
    const { db } = fakeDb({ posts: [postRow], social_accounts: accountRows, assets: assetRows });
    const publisher = fakePublisher({
      publish: vi
        .fn()
        .mockRejectedValueOnce(new Error('Zernio 500: boom'))
        .mockResolvedValueOnce({ ok: true, postId: 'zernio-x-1' })
    });

    const result = await scheduleDelivery(db, publisher, {
      orgId: ORG,
      postId: POST_ID,
      accountIds: [ACCOUNT_IG, ACCOUNT_X]
    });

    expect(result.deliveries).toEqual([
      { accountId: ACCOUNT_IG, ok: false, error: 'Zernio 500: boom' },
      { accountId: ACCOUNT_X, ok: true, zernioPostId: 'zernio-x-1' }
    ]);
  });
});

describe('deliveryStatus', () => {
  it('chiede lo stato a Zernio per ogni id nel puntatore, non lo legge da una colonna nostra', async () => {
    const withPointer = { ...postRow, zernio_post_ids: { [ACCOUNT_IG]: 'zernio-ig-1', [ACCOUNT_X]: 'zernio-x-1' } };
    const { db } = fakeDb({ posts: [withPointer], social_accounts: accountRows });
    const publisher = fakePublisher({
      postStatus: vi.fn(async (id: string) => ({
        status: id === 'zernio-ig-1' ? 'scheduled' : 'published',
        url: id === 'zernio-x-1' ? 'https://x.com/p/1' : null,
        error: null,
        scheduledFor: null
      }))
    });

    const result = await deliveryStatus(db, publisher, { orgId: ORG, postId: POST_ID });

    expect(publisher.postStatus).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { accountId: ACCOUNT_IG, platform: 'instagram', status: 'scheduled', url: null, error: null, scheduledFor: null },
      { accountId: ACCOUNT_X, platform: 'x', status: 'published', url: 'https://x.com/p/1', error: null, scheduledFor: null }
    ]);
  });

  it('un post senza puntatore non e programmato: nessuna chiamata a Zernio', async () => {
    const { db } = fakeDb({ posts: [postRow], social_accounts: accountRows });
    const publisher = fakePublisher();

    const result = await deliveryStatus(db, publisher, { orgId: ORG, postId: POST_ID });

    expect(publisher.postStatus).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('Zernio irraggiungibile si dichiara, non finge una riga vuota', async () => {
    const withPointer = { ...postRow, zernio_post_ids: { [ACCOUNT_IG]: 'zernio-ig-1' } };
    const { db } = fakeDb({ posts: [withPointer], social_accounts: accountRows });
    const publisher = fakePublisher({ postStatus: vi.fn().mockRejectedValue(new Error('Zernio 503: down')) });

    const result = await deliveryStatus(db, publisher, { orgId: ORG, postId: POST_ID });

    expect(result).toEqual([
      { accountId: ACCOUNT_IG, platform: 'instagram', status: 'unreachable', url: null, error: 'Zernio 503: down', scheduledFor: null }
    ]);
  });
});

describe('cancelDelivery', () => {
  it('cancella su Zernio e toglie SOLO quell account dal puntatore', async () => {
    const withPointer = { ...postRow, zernio_post_ids: { [ACCOUNT_IG]: 'zernio-ig-1', [ACCOUNT_X]: 'zernio-x-1' } };
    const { db, calls } = fakeDb({ posts: [withPointer], social_accounts: accountRows });
    const publisher = fakePublisher();

    await cancelDelivery(db, publisher, { orgId: ORG, postId: POST_ID, accountId: ACCOUNT_IG });

    expect(publisher.deletePost).toHaveBeenCalledWith('zernio-ig-1');
    const updateCall = calls.find((c) => c.table === 'posts' && c.op === 'update');
    expect(updateCall?.payload).toMatchObject({ zernio_post_ids: { [ACCOUNT_X]: 'zernio-x-1' } });
  });

  it('se la cancellazione su Zernio fallisce, il puntatore non si tocca — non si perde la riga che lo racconta', async () => {
    const withPointer = { ...postRow, zernio_post_ids: { [ACCOUNT_IG]: 'zernio-ig-1' } };
    const { db, calls } = fakeDb({ posts: [withPointer], social_accounts: accountRows });
    const publisher = fakePublisher({ deletePost: vi.fn().mockRejectedValue(new Error('Zernio 500: boom')) });

    await expect(
      cancelDelivery(db, publisher, { orgId: ORG, postId: POST_ID, accountId: ACCOUNT_IG })
    ).rejects.toThrow('Zernio 500: boom');

    expect(calls.some((c) => c.table === 'posts' && c.op === 'update')).toBe(false);
  });
});
