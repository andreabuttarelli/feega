import { describe, expect, it } from 'vitest';
import { newNodeRow } from '$lib/canvas-node-data';
import { FieldKind, inputValueOf, inspectorOf, parseFieldInput, commitHandleField, FEED_FIELDS } from './node-inspector';

const row = (type: string, data: Record<string, unknown>) => ({ id: 'n', type, data });

describe('inspectorOf: una riga per tipo, nessun if sparso', () => {
  it('social_account_feed ha un inspector, gli altri tipi no', () => {
    expect(inspectorOf(row('social_account_feed', newNodeRow('social_account_feed')))?.fields).toBe(FEED_FIELDS);
    expect(inspectorOf(row('image', newNodeRow('image')))).toBeNull();
  });

  it('i campi chiesti ci sono tutti', () => {
    expect(FEED_FIELDS.map((f) => f.path)).toEqual([
      'platform',
      'handle',
      'limit',
      'filters.from',
      'filters.to',
      'filters.media',
      'filters.min_likes',
      'filters.min_views',
      'filters.include',
      'filters.exclude',
      'filters.sort'
    ]);
  });

  it('scrivere un filtro produce il data del nodo, filtri annidati compresi', () => {
    const view = inspectorOf(row('social_account_feed', { platform: 'instagram', handle: 'nike' }))!;
    const data = view.dataWith('filters.media', 'video');
    expect(data.filters).toMatchObject({ media: 'video', sort: 'newest' });
    expect(data.handle).toBe('nike');
  });

  it('legge il valore corrente per il campo', () => {
    const view = inspectorOf(row('social_account_feed', { platform: 'tiktok', handle: 'nike', filters: { min_likes: 4 } }))!;
    expect(inputValueOf(view.values, 'platform')).toBe('tiktok');
    expect(inputValueOf(view.values, 'filters.min_likes')).toBe(4);
  });

  it('sincronizzare non parte senza handle o url', () => {
    expect(inspectorOf(row('social_account_feed', { platform: 'instagram', handle: '' }))?.canSync).toBe(false);
    expect(inspectorOf(row('social_account_feed', { platform: 'instagram', handle: 'nike' }))?.canSync).toBe(true);
  });
});

describe('parseFieldInput', () => {
  const field = (path: string) => FEED_FIELDS.find((f) => f.path === path)!;

  it('un handle incollato come URL diventa il nome utente', () => {
    expect(parseFieldInput(field('handle'), 'https://www.tiktok.com/@nike')).toBe('nike');
  });

  it('un filtro numerico vuoto si toglie, un numero si legge', () => {
    expect(parseFieldInput(field('filters.min_likes'), '')).toBeNull();
    expect(parseFieldInput(field('filters.min_likes'), '12')).toBe(12);
    expect(parseFieldInput(field('filters.min_likes'), 'abc')).toBeUndefined();
  });

  it('il limite è obbligatorio e positivo', () => {
    expect(field('limit').kind).toBe(FieldKind.Number);
    expect(parseFieldInput(field('limit'), '')).toBeUndefined();
    expect(parseFieldInput(field('limit'), '0')).toBeUndefined();
    expect(parseFieldInput(field('limit'), '30')).toBe(30);
  });

  it('una data vuota si toglie', () => {
    expect(parseFieldInput(field('filters.from'), '')).toBeNull();
    expect(parseFieldInput(field('filters.from'), '2026-01-02')).toBe('2026-01-02');
  });
});

describe('commitHandleField: incollare un URL del feed capisce piattaforma e tipo', () => {
  const view = (data: Record<string, unknown>) => inspectorOf(row('social_account_feed', data))!;

  it('un URL di profilo riconosciuto imposta piattaforma, handle e un riassunto', () => {
    const data = commitHandleField(view({ platform: 'instagram', handle: '' }), 'https://www.tiktok.com/@nike');
    expect(data.platform).toBe('tiktok');
    expect(data.handle).toBe('nike');
    expect(data.sync_summary).toBe('TikTok · profile @nike');
    expect(data.sync_error).toBeNull();
  });

  it('un handle nudo senza dominio usa la piattaforma già scelta nel nodo, non l’ipotesi del classificatore', () => {
    const data = commitHandleField(view({ platform: 'youtube', handle: '' }), 'nike');
    expect(data.platform).toBe('youtube');
    expect(data.handle).toBe('nike');
  });

  it('un post singolo resta scritto così com’è: syncSocialFeedEntries lo riclassifica alla sincronizzazione', () => {
    const data = commitHandleField(view({ platform: 'instagram', handle: 'old' }), 'https://www.instagram.com/p/ABC123/');
    expect(data.handle).toBe('https://www.instagram.com/p/ABC123/');
    expect(data.sync_summary).toBe('Instagram · 1 post');
    expect(data.sync_error).toBeNull();
  });

  it('un hashtag resta scritto così com’è, con un riassunto', () => {
    const data = commitHandleField(view({ platform: 'instagram', handle: 'old' }), '#running');
    expect(data.handle).toBe('#running');
    expect(data.sync_summary).toBe('Instagram · hashtag #running');
  });

  it('più righe restano scritte così come sono, il riassunto le elenca tutte', () => {
    const data = commitHandleField(
      view({ platform: 'instagram', handle: 'old' }),
      '@nike\nhttps://www.tiktok.com/@nike/video/7441152690236771640'
    );
    expect(data.handle).toBe('@nike\nhttps://www.tiktok.com/@nike/video/7441152690236771640');
    expect(data.sync_summary).toContain('Instagram · profile @nike');
    expect(data.sync_summary).toContain('TikTok · 1 post');
  });

  it('un dominio sconosciuto non aggiorna handle: sync_error spiega perché', () => {
    const data = commitHandleField(view({ platform: 'instagram', handle: 'old' }), 'https://www.pinterest.com/nike/');
    expect(data.handle).toBe('old');
    expect(data.sync_error).toContain('pinterest');
  });

  it('svuotare il campo pulisce riassunto ed errore', () => {
    const data = commitHandleField(view({ platform: 'instagram', handle: 'nike', sync_summary: 'x', sync_error: 'y' }), '');
    expect(data.handle).toBe('');
    expect(data.sync_summary).toBeNull();
    expect(data.sync_error).toBeNull();
  });
});

describe('patchWith: a field edit sends only what it changed', () => {
  it('editing the limit of a feed node leaves the filters out of the patch', () => {
    const data = { ...newNodeRow('social_account_feed'), limit: 3, filters: { include: 'stale here' } };
    const patch = inspectorOf(row('social_account_feed', data))?.patchWith('limit', 9);

    expect(patch).toEqual({ limit: 9 });
  });

  it('editing a filter sends the filters, nothing else', () => {
    const patch = inspectorOf(row('social_account_feed', { ...newNodeRow('social_account_feed'), limit: 3 }))?.patchWith('filters.include', 'shoes');

    expect(Object.keys(patch ?? {})).toEqual(['filters']);
  });
});
