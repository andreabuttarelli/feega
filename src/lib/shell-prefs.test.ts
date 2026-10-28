import { beforeEach, describe, expect, it } from 'vitest';
import { readChatTab, writeChatTab, readRulers, writeRulers } from './shell-prefs';
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
