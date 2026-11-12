import { describe, expect, it } from 'vitest';
import { located, MAX_ROUTES, namesIn, repoOf, routeOf, routesOf } from './repo';

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

describe('located', () => {
  it('a branch with / is told from the folder after it by the real branch list', () => {
    const branches = ['main', 'feature/new-nav', 'feature'];

    expect(located('feature/new-nav/apps/web', branches)).toEqual({ ref: 'feature/new-nav', path: 'apps/web' });
    expect(located('feature/new-nav', branches)).toEqual({ ref: 'feature/new-nav', path: null });
    expect(located('main/apps/v4', branches)).toEqual({ ref: 'main', path: 'apps/v4' });
  });

  it('a ref that is not a known branch (tag, sha) is the first segment', () => {
    expect(located('v2', [])).toEqual({ ref: 'v2', path: null });
    expect(located('v2/apps/web', [])).toEqual({ ref: 'v2', path: 'apps/web' });
    expect(located(null, ['main'])).toEqual({ ref: null, path: null });
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

describe('namesIn', () => {
  it('raccoglie i nomi maiuscoli dichiarati', () => {
    expect(namesIn('function Button() {}\nconst CardTitle = () => null\nclass Panel {}\nconst helper = 1')).toEqual(['Button', 'CardTitle', 'Panel']);
  });

  it('un nome importato anche da un pacchetto è ambiguo e resta fuori', () => {
    const source = "import { Users, Settings as Gear } from 'lucide-react'\nimport Search from '@/x'\nfunction Users() {}\nfunction Search() {}\nfunction Gear() {}";

    expect(namesIn(source)).toEqual(['Search']);
  });
});
