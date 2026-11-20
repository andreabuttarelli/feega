import { describe, expect, it } from 'vitest';
import { PREVIEW_CONCURRENCY, previewQueue } from './icon-previews';

const svgOf = (name: string) => `<svg id="${name}"></svg>`;

function server(failing: string[] = []) {
  const stats = { asked: [] as string[], active: 0, peak: 0 };
  const fetcher = async (_: string, init?: RequestInit) => {
    const args = JSON.parse(String(init?.body)).params.arguments;
    stats.asked.push(`${args.name}:${args.size}:${args.stroke}`);
    stats.active++;
    stats.peak = Math.max(stats.peak, stats.active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    stats.active--;
    return failing.includes(args.name) ? new Response('no', { status: 500 }) : new Response(JSON.stringify({ result: { content: [{ type: 'text', text: svgOf(args.name) }] } }));
  };
  return { fetcher, stats };
}

describe('previewQueue', () => {
  it('draws each requested name', async () => {
    const drawn: [string, string | null][] = [];
    const request = previewQueue(server().fetcher, async (name, svg) => void drawn.push([name, svg]));
    await request(['a', 'b']);

    expect(drawn.sort()).toEqual([['a', svgOf('a')], ['b', svgOf('b')]]);
  });

  it('never has more than the concurrency limit in flight', async () => {
    const { fetcher, stats } = server();
    const request = previewQueue(fetcher, async () => undefined);
    await request(Array.from({ length: 40 }, (_, i) => `n${i}`));

    expect(stats.asked).toHaveLength(40);
    expect(stats.peak).toBe(PREVIEW_CONCURRENCY);
  });

  it('asks once for a name requested twice, in the same batch or later', async () => {
    const { fetcher, stats } = server();
    const drawn: string[] = [];
    const request = previewQueue(fetcher, async (name) => void drawn.push(name));
    await Promise.all([request(['a', 'a']), request(['a'])]);
    await request(['a']);

    expect(stats.asked).toHaveLength(1);
    expect(drawn).toHaveLength(4);
  });

  it('draws null for a name that fails, and asks again next time', async () => {
    const { fetcher, stats } = server(['broken']);
    const drawn: [string, string | null][] = [];
    const request = previewQueue(fetcher, async (name, svg) => void drawn.push([name, svg]));
    await request(['broken', 'ok']);
    await request(['broken']);

    expect(drawn.filter(([name]) => name === 'broken')).toEqual([['broken', null], ['broken', null]]);
    expect(stats.asked.filter((a) => a.startsWith('broken'))).toHaveLength(2);
  });
});
