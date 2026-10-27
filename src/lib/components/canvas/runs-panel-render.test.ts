// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunListing } from '$lib/canvas/run-graph';
import RunsPanel from './RunsPanel.svelte';

vi.mock('@lucide/svelte/icons/history', () => ({ default: () => {} }));

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');
const source = readFileSync(join(dir, 'RunsPanel.svelte'), 'utf8');

const LONG = 40;
const RUNNING = 3;
const runs: RunListing[] = Array.from({ length: LONG }, (_, i) => ({ id: `r${i}`, nodeId: `n${i}`, name: `Generate image ${i + 1}`, status: i < RUNNING ? 'running' : 'done', startedAt: '2026-10-27T10:00:00Z', costUsd: 0.012 }));

describe('the runs popover with a long list', () => {
  let app: Record<string, unknown> | null = null;

  afterEach(() => {
    if (app) {
      unmount(app);
    }
    document.body.innerHTML = '';
  });

  it('is an icon button with a running count, and opens every run in a list', () => {
    app = mount(RunsPanel, { target: document.body, props: { runs, staleCount: 0, onrunstale: () => {} } });
    const toggle = document.querySelector<HTMLButtonElement>('button[aria-label="Runs"]')!;
    expect(document.querySelector('[data-testid="runs-active"]')?.textContent).toBe(String(RUNNING));

    toggle.click();
    flushSync();

    expect(document.querySelectorAll('ol li')).toHaveLength(LONG);
  });

  it('opens upward, scrolls inside and stays within the viewport', () => {
    const list = source.match(/\n {2}ol \{([^}]*)\}/)?.[1] ?? '';
    expect(list).toMatch(/bottom:\s*calc\(100% \+ 8px\)/);
    expect(list).toMatch(/overflow-y:\s*auto/);
    expect(list).toMatch(/max-height:\s*min\(260px,\s*calc\(100dvh - 140px\)\)/);
    expect(list).toMatch(/width:\s*min\(280px,\s*calc\(100vw - 24px\)\)/);
  });
});
