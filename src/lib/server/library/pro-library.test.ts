import { describe, expect, it } from 'vitest';
import { ProFetch, proFiles, type ProStore } from './pro-library';

const HERO = { id: 'hero', version: 'v1', frameworks: { svelte: ['Hero.svelte'], html: ['index.html', 'style.css'] } };

function store(contents: Record<string, string>, latest = HERO): ProStore & { reads: string[] } {
  const reads: string[] = [];

  return {
    reads,
    async latest(id) {
      reads.push(`latest:${id}`);

      return id === latest.id ? latest : null;
    },
    async file(id, version, framework, path) {
      reads.push(`${id}/${version}/${framework}/${path}`);

      return contents[`${framework}/${path}`] ?? null;
    }
  };
}

const entitled = (answer: boolean) => async () => answer;

describe('proFiles', () => {
  it('serves the files of the latest version of an item', async () => {
    const result = await proFiles(store({ 'html/index.html': '<h1>', 'html/style.css': 'h1{}' }), entitled(true), 'hero', 'html');

    expect(result).toEqual({
      kind: ProFetch.Served,
      id: 'hero',
      version: 'v1',
      framework: 'html',
      files: [
        { path: 'index.html', content: '<h1>' },
        { path: 'style.css', content: 'h1{}' }
      ]
    });
  });

  it('asks for a plan before reading anything', async () => {
    const source = store({ 'svelte/Hero.svelte': '<h1 />' });

    expect(await proFiles(source, entitled(false), 'hero', 'svelte')).toEqual({ kind: ProFetch.PlanRequired });
    expect(source.reads).toEqual([]);
  });

  it('refuses an id that could leave the item folder', async () => {
    const source = store({});

    expect(await proFiles(source, entitled(true), '../secrets', 'svelte')).toEqual({ kind: ProFetch.BadRequest });
    expect(source.reads).toEqual([]);
  });

  it('refuses a framework it does not know', async () => {
    expect(await proFiles(store({}), entitled(true), 'hero', 'angular')).toEqual({ kind: ProFetch.BadRequest });
  });

  it('answers not found for an item that was never uploaded', async () => {
    expect(await proFiles(store({}), entitled(true), 'nope', 'svelte')).toEqual({ kind: ProFetch.ItemNotFound });
  });

  it('answers not found for a framework the item does not ship', async () => {
    expect(await proFiles(store({}), entitled(true), 'hero', 'vue')).toEqual({ kind: ProFetch.FrameworkNotFound });
  });

  it('answers not found when a listed file is missing from the bucket', async () => {
    expect(await proFiles(store({}), entitled(true), 'hero', 'svelte')).toEqual({ kind: ProFetch.FrameworkNotFound });
  });
});
