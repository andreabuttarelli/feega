import { describe, expect, it } from 'vitest';
import { classifySocialInput, classifySocialLines } from './social-url-classifier';

describe('classifySocialInput — profili', () => {
  it.each([
    ['nike', 'instagram', null],
    ['@nike', 'instagram', null],
    ['https://www.instagram.com/nike/', 'instagram', null],
    ['https://instagram.com/nike?hl=en', 'instagram', null],
    ['https://m.instagram.com/nike/', 'instagram', null],
    ['https://www.tiktok.com/@nike', 'tiktok', null],
    ['tiktok.com/@nike/', 'tiktok', null],
    ['https://x.com/nike', 'x', null],
    ['https://twitter.com/nike', 'x', null],
    ['https://www.threads.com/@nike', 'threads', null],
    ['https://www.threads.net/@nike', 'threads', null],
    ['https://www.youtube.com/@nike/videos', 'youtube', null],
    ['https://www.youtube.com/@nike', 'youtube', null],
    ['https://www.youtube.com/channel/UCabcdefghij1234567890', 'youtube', null],
    ['https://www.youtube.com/c/NikeChannel', 'youtube', null],
    ['https://www.youtube.com/user/nikefootball', 'youtube', null],
    ['https://www.linkedin.com/company/nike/', 'linkedin', null],
    ['https://www.linkedin.com/in/johndoe/', 'linkedin', null],
    ['https://www.facebook.com/nike', 'facebook', null],
    ['https://www.facebook.com/nike/', 'facebook', null],
    ['https://m.facebook.com/nike', 'facebook', null]
  ])('%s → platform %s profile', (raw, platform) => {
    const result = classifySocialInput(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.platform).toBe(platform);
    expect(result.entry.kind).toBe('profile');
  });

  it('estrae correttamente handle e id per ogni piattaforma', () => {
    expect(classifySocialInput('@nike')).toMatchObject({ ok: true, entry: { handle: 'nike' } });
    expect(classifySocialInput('https://www.youtube.com/channel/UCabc123')).toMatchObject({
      ok: true,
      entry: { id: 'UCabc123', handle: null }
    });
    expect(classifySocialInput('https://www.youtube.com/@nike')).toMatchObject({
      ok: true,
      entry: { handle: 'nike' }
    });
    expect(classifySocialInput('https://www.linkedin.com/company/nike/')).toMatchObject({
      ok: true,
      entry: { handle: 'nike' }
    });
    expect(classifySocialInput('https://www.linkedin.com/in/johndoe/')).toMatchObject({
      ok: true,
      entry: { handle: 'johndoe' }
    });
  });
});

describe('classifySocialInput — post singoli', () => {
  it.each([
    ['https://www.instagram.com/p/C6qwOakoGCM/', 'instagram'],
    ['https://www.instagram.com/reel/C4bBkK7t6RJ/', 'instagram'],
    ['https://www.instagram.com/tv/C4bBkK7t6RJ/', 'instagram'],
    ['https://www.tiktok.com/@nike/video/7441152690236771640', 'tiktok'],
    ['https://x.com/nike/status/1234567890', 'x'],
    ['https://twitter.com/nike/status/1234567890', 'x'],
    ['https://www.threads.com/@nike/post/C1234567890', 'threads'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'youtube'],
    ['https://www.facebook.com/nike/posts/1234567890', 'facebook'],
    ['https://www.facebook.com/reel/1535656380759655', 'facebook'],
    ['https://www.facebook.com/watch/?v=1234567890', 'facebook']
  ])('%s → platform %s post', (raw, platform) => {
    const result = classifySocialInput(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.platform).toBe(platform);
    expect(result.entry.kind).toBe('post');
  });

  it('estrae id del post', () => {
    expect(classifySocialInput('https://www.tiktok.com/@nike/video/7441152690236771640')).toMatchObject({
      ok: true,
      entry: { id: '7441152690236771640', handle: 'nike' }
    });
    expect(classifySocialInput('https://x.com/nike/status/1234567890')).toMatchObject({
      ok: true,
      entry: { id: '1234567890', handle: 'nike' }
    });
    expect(classifySocialInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({
      ok: true,
      entry: { id: 'dQw4w9WgXcQ' }
    });
    expect(classifySocialInput('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({
      ok: true,
      entry: { id: 'dQw4w9WgXcQ' }
    });
  });
});

describe('classifySocialInput — hashtag', () => {
  it.each([
    ['#running', 'instagram'],
    ['https://www.instagram.com/explore/tags/running/', 'instagram'],
    ['https://www.tiktok.com/tag/running', 'tiktok']
  ])('%s → platform %s hashtag', (raw, platform) => {
    const result = classifySocialInput(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.platform).toBe(platform);
    expect(result.entry.kind).toBe('hashtag');
    expect(result.entry.id).toBe('running');
  });

  it('un cancelletto senza piattaforma nell’URL sceglie instagram di default', () => {
    const result = classifySocialInput('#running');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.platform).toBe('instagram');
  });
});

describe('classifySocialInput — non supportati', () => {
  it('un URL reddit o pinterest torna not_supported con un messaggio chiaro', () => {
    const reddit = classifySocialInput('https://www.reddit.com/r/nike/');
    expect(reddit).toMatchObject({ ok: false, reason: 'not_supported' });
    const pinterest = classifySocialInput('https://www.pinterest.com/nike/');
    expect(pinterest).toMatchObject({ ok: false, reason: 'not_supported' });
  });

  it('una stringa vuota o irriconoscibile torna unrecognized', () => {
    expect(classifySocialInput('')).toMatchObject({ ok: false, reason: 'unrecognized' });
    expect(classifySocialInput('   ')).toMatchObject({ ok: false, reason: 'unrecognized' });
    expect(classifySocialInput('https://example.com/whatever')).toMatchObject({ ok: false, reason: 'unrecognized' });
  });
});

describe('classifySocialLines — più righe', () => {
  it('separa per newline e virgola, ignora vuoti, ogni entry porta la sua origine', () => {
    const result = classifySocialLines('@nike, https://www.tiktok.com/@nike/video/7441152690236771640\nhttps://www.reddit.com/r/nike/\n\n#running');
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]).toMatchObject({ platform: 'instagram', kind: 'profile', source: '@nike' });
    expect(result.entries[1]).toMatchObject({ platform: 'tiktok', kind: 'post', source: 'https://www.tiktok.com/@nike/video/7441152690236771640' });
    expect(result.entries[2]).toMatchObject({ platform: 'instagram', kind: 'hashtag', source: '#running' });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ source: 'https://www.reddit.com/r/nike/', reason: 'not_supported' });
  });

  it('una singola riga bare handle resta compatibile con normalizeHandle', () => {
    const result = classifySocialLines('nike');
    expect(result.entries).toEqual([
      expect.objectContaining({ platform: 'instagram', kind: 'profile', handle: 'nike' })
    ]);
  });
});
