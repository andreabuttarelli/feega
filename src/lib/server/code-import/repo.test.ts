import { describe, expect, it } from 'vitest';
import { DevServer, devServerOf, managerOf, MAX_ROUTES, namesIn, PackageManager, repoOf, routeOf, routesOf } from './repo';

describe('repoOf', () => {
  it('legge proprietario, repo e ref da un link GitHub', () => {
    expect(repoOf('https://github.com/satnaing/shadcn-admin')).toEqual({ owner: 'satnaing', repo: 'shadcn-admin', ref: null });
    expect(repoOf('https://github.com/a/b.git')).toEqual({ owner: 'a', repo: 'b', ref: null });
    expect(repoOf('https://github.com/a/b/tree/v2')).toEqual({ owner: 'a', repo: 'b', ref: 'v2' });
  });

  it('rifiuta host diversi da github.com e schemi diversi da https', () => {
    expect(repoOf('https://gitlab.com/a/b')).toBeNull();
    expect(repoOf('http://github.com/a/b')).toBeNull();
    expect(repoOf('https://github.com.evil.test/a/b')).toBeNull();
    expect(repoOf('https://github.com/a/b;rm -rf')).toBeNull();
  });
});

describe('routeOf', () => {
  it('una rotta vuota è la radice, una rotta con .. o senza / iniziale no', () => {
    expect(routeOf(undefined)).toBe('/');
    expect(routeOf('/settings/profile')).toBe('/settings/profile');
    expect(routeOf('/../etc')).toBeNull();
    expect(routeOf('https://evil.test')).toBeNull();
  });
});

describe('routesOf', () => {
  it('nessuna rotta è la radice, i doppioni contano una volta', () => {
    expect(routesOf([])).toEqual(['/']);
    expect(routesOf(['/', ' /settings ', '/settings'])).toEqual(['/', '/settings']);
  });

  it('una rotta non valida o troppe rotte rifiutano tutto', () => {
    expect(routesOf(['/', '/../x'])).toBeNull();
    expect(routesOf(Array.from({ length: MAX_ROUTES + 1 }, (_, i) => `/r${i}`))).toBeNull();
  });
});

describe('managerOf e devServerOf', () => {
  it('il lockfile sceglie il gestore, npm se manca', () => {
    expect(managerOf(['package.json', 'pnpm-lock.yaml'])).toBe(PackageManager.Pnpm);
    expect(managerOf(['package.json'])).toBe(PackageManager.Npm);
  });

  it('next vince su vite, vite sugli altri', () => {
    expect(devServerOf({ dependencies: { next: '15', react: '19' } })).toBe(DevServer.Next);
    expect(devServerOf({ devDependencies: { vite: '7' } })).toBe(DevServer.Vite);
    expect(devServerOf({})).toBe(DevServer.Other);
  });
});

describe('namesIn', () => {
  it('raccoglie i nomi maiuscoli dichiarati', () => {
    expect(namesIn('function Button() {}\nconst CardTitle = () => null\nclass Panel {}\nconst helper = 1')).toEqual(['Button', 'CardTitle', 'Panel']);
  });

  it('un nome importato anche da un pacchetto è ambiguo e resta fuori', () => {
    const source = "import { Users, Settings as Gear } from 'lucide-react'\nimport Search from '@/x'\nfunction Users() {}\nfunction Search() {}\nfunction Gear() {}";

    expect(namesIn(source)).toEqual(['Search']);
  });
});
