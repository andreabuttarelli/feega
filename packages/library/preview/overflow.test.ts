import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PREVIEW_DIR = dirname(fileURLToPath(import.meta.url));

describe('preview', () => {
	it('has no horizontal overflow at 360, 375, 768, 1024 and 1280', async () => {
		execFileSync('node', [join(PREVIEW_DIR, 'build.mjs')]);
		const { findOverflow } = await import('./overflow.mjs');
		expect(await findOverflow()).toEqual([]);
	}, 120_000);
});
