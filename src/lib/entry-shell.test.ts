import { describe, expect, it } from 'vitest';
import { EntryShell, entryShell } from './entry-shell';

const MOTION = '/p/p1/c/c1/motion/n1';

describe('entryShell', () => {
  it("il prompt di /app verso l'editor mostra lo scheletro motion, non la tela", () => {
    expect(entryShell({ from: '/app', to: MOTION, signedIn: true })).toBe(EntryShell.Motion);
  });

  it('una tela mostra lo scheletro della tela', () => {
    expect(entryShell({ from: '/app', to: '/p/p1/c/c1', signedIn: true })).toBe(EntryShell.Canvas);
  });

  it('dentro lo stesso progetto non copre la navigazione', () => {
    expect(entryShell({ from: '/p/p1/c/c1', to: MOTION, signedIn: true })).toBe(EntryShell.None);
  });

  it('dentro la dashboard non copre la shell già montata', () => {
    expect(entryShell({ from: '/app', to: '/app/canvases', signedIn: true })).toBe(EntryShell.None);
    expect(entryShell({ from: '/app/canvases', to: '/app', signedIn: true })).toBe(EntryShell.None);
  });

  it("verso /app mostra la shell dell'app", () => {
    expect(entryShell({ from: '/', to: '/app/upscale', signedIn: false })).toBe(EntryShell.App);
  });

  it('il login copre il rimbalzo solo con una sessione', () => {
    expect(entryShell({ from: '/', to: '/login', signedIn: true })).toBe(EntryShell.App);
    expect(entryShell({ from: '/', to: '/login', signedIn: false })).toBe(EntryShell.None);
  });

  it('una pagina pubblica non mostra nulla', () => {
    expect(entryShell({ from: '/', to: '/gallery', signedIn: true })).toBe(EntryShell.None);
  });
});
