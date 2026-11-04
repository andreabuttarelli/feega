import { beforeEach, describe, expect, it } from 'vitest';
import { readChatTab, writeChatTab, readRulers, writeRulers, readStylesSplit, writeStylesSplit, STYLES_SPLIT, readFrameViews, writeFrameViews } from './shell-prefs';
import { FRAME_VIEW_DEFAULT, FrameView } from './canvas/frame-view';

function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    clear: () => store.clear()
  };
}

let testLocalStorage: ReturnType<typeof fakeLocalStorage>;

describe('quale scheda del pannello chat era aperta (Chat o Guide)', () => {
  beforeEach(() => {
    testLocalStorage = fakeLocalStorage();
    (globalThis as { localStorage?: unknown }).localStorage = testLocalStorage;
  });

  it('senza nulla salvato, la scheda è chat', () => {
    expect(readChatTab()).toBe('chat');
  });

  it('scrivere guide e rileggere torna guide', () => {
    writeChatTab('guide');
    expect(readChatTab()).toBe('guide');
  });

  it('scrivere properties e rileggere torna properties', () => {
    writeChatTab('properties');
    expect(readChatTab()).toBe('properties');
  });

  it('un valore fuori vocabolario ripiega su chat', () => {
    testLocalStorage.setItem('feega.chatTab', 'qualcosa-altro');
    expect(readChatTab()).toBe('chat');
  });

  it('legge ancora una chiave scritta prima della rinomina', () => {
    testLocalStorage.setItem('dazero.chatTab', 'guide');
    expect(readChatTab()).toBe('guide');
  });
});

describe('i righelli della tela', () => {
  beforeEach(() => {
    testLocalStorage = fakeLocalStorage();
    (globalThis as { localStorage?: unknown }).localStorage = testLocalStorage;
  });

  it('sono spenti di default', () => {
    expect(FRAME_VIEW_DEFAULT[FrameView.Rulers]).toBe(false);
    expect(readRulers()).toBe(false);
  });

  it('accesi e riletti restano accesi', () => {
    writeRulers(true);
    expect(readRulers()).toBe(true);
  });
});

describe('the Styles panel split between text and colour', () => {
  beforeEach(() => {
    testLocalStorage = fakeLocalStorage();
    (globalThis as { localStorage?: unknown }).localStorage = testLocalStorage;
  });

  it('starts at half', () => {
    expect(readStylesSplit()).toBe(0.5);
  });

  it('reads back what was written', () => {
    writeStylesSplit(0.3);
    expect(readStylesSplit()).toBe(0.3);
  });

  it('clamps so neither region vanishes', () => {
    writeStylesSplit(0.99);
    expect(readStylesSplit()).toBe(STYLES_SPLIT.MAX);
    testLocalStorage.setItem('feega.stylesSplit', 'nope');
    expect(readStylesSplit()).toBe(0.5);
  });
});

describe('the frame views a user toggled', () => {
  beforeEach(() => {
    testLocalStorage = fakeLocalStorage();
    (globalThis as { localStorage?: unknown }).localStorage = testLocalStorage;
  });

  it('start from the defaults', () => {
    expect(readFrameViews()).toEqual(FRAME_VIEW_DEFAULT);
  });

  it('a layout grid turned off stays off after a reload', () => {
    writeFrameViews({ ...FRAME_VIEW_DEFAULT, [FrameView.Guides]: false });
    expect(readFrameViews()[FrameView.Guides]).toBe(false);
  });

  it('a damaged value falls back to the defaults', () => {
    testLocalStorage.setItem('feega.frameViews', '{oops');
    expect(readFrameViews()).toEqual(FRAME_VIEW_DEFAULT);
  });
});
