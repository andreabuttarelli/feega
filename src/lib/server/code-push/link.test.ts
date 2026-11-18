import { describe, expect, it } from 'vitest';
import { FileMove } from './git-host';
import { EntryKind, LinkState, entryPath, followRenames, linkSchema, linkStatus, type CodeLink } from './link';

const link = (over: Partial<CodeLink> = {}): CodeLink =>
  linkSchema.parse({ repo: 'acme/app', appRoot: 'apps/web', entryKind: EntryKind.Page, entry: 'app/page.tsx', route: '/', baseBranch: 'main', baseSha: 'c1', files: ['app/page.tsx', 'components/Button.tsx'], ...over });

describe('il link di un frame', () => {
  it('monorepo con due app/page.tsx: il percorso si risolve sulla app root giusta', () => {
    expect(entryPath(link())).toBe('apps/web/app/page.tsx');
    expect(entryPath(link({ appRoot: 'apps/admin' }))).toBe('apps/admin/app/page.tsx');
    expect(entryPath(link({ appRoot: '' }))).toBe('app/page.tsx');
  });

  it('un rinomino a monte viene seguito: link aggiornato, nessun orfano', () => {
    const moved = followRenames(link({ appRoot: '', entryKind: EntryKind.Component, entry: 'Button.tsx', files: ['Button.tsx'] }), [{ path: 'ui/Button.tsx', move: FileMove.Renamed, from: 'Button.tsx' }]);

    expect(moved).toMatchObject({ entry: 'ui/Button.tsx', files: ['ui/Button.tsx'] });
    expect(linkStatus({ link: moved, upstream: [{ path: 'ui/Button.tsx', move: FileMove.Renamed, from: 'Button.tsx' }], modified: [], writable: true })).not.toBe(LinkState.Orphan);
  });

  it('una copia su un’altra tela non è scrivibile', () => {
    expect(linkSchema.parse({ ...link(), writable: false }).writable).toBe(false);
    expect(link().writable).toBe(true);
  });
});

describe('linkStatus: calcolato, con la priorità decisa', () => {
  const upstream = (path: string, move = FileMove.Modified) => [{ path, move, from: null }];

  it.each([
    ['conflitto batte tutto', { upstream: upstream('apps/web/app/page.tsx'), modified: ['apps/web/app/page.tsx'], writable: false }, LinkState.Conflict],
    ['orfano se il file è sparito', { upstream: upstream('apps/web/app/page.tsx', FileMove.Removed), modified: [], writable: false }, LinkState.Orphan],
    ['accesso perso', { upstream: [], modified: [], writable: false }, LinkState.AccessLost],
    ['più recente a monte', { upstream: upstream('apps/web/components/Button.tsx'), modified: [], writable: true }, LinkState.NewerUpstream],
    ['modificato', { upstream: [], modified: ['apps/web/app/page.tsx'], writable: true }, LinkState.Modified],
    ['in PR', { upstream: [], modified: [], writable: true, inPull: true }, LinkState.InPull],
    ['in sync', { upstream: [], modified: [], writable: true }, LinkState.InSync]
  ])('%s', (_name, facts, state) => {
    expect(linkStatus({ link: link(), ...facts })).toBe(state);
  });

  it('una PR chiusa senza merge lascia le modifiche: lo stato è modificato', () => {
    expect(linkStatus({ link: link(), upstream: [], modified: ['apps/web/app/page.tsx'], writable: true, inPull: false })).toBe(LinkState.Modified);
  });

  it('un file a monte fuori dal grafo del frame non lo tocca', () => {
    expect(linkStatus({ link: link(), upstream: upstream('apps/admin/app/page.tsx'), modified: [], writable: true })).toBe(LinkState.InSync);
  });
});
