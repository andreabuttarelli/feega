import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from 'svelte/compiler';

const TOP_BAR = new URL('./CanvasTopBar.svelte', import.meta.url);
const DOT_RULE = /\.top-box\.right\.svelte-\w+ > \.connection-dot \{([^}]*)\}/;

describe('the connection dot in the top bar pill', () => {
	it('sits where the pill icons sit: centred in a control-sized slot', () => {
		const { css } = compile(readFileSync(TOP_BAR, 'utf8'), { filename: 'CanvasTopBar.svelte' });
		const rule = DOT_RULE.exec(css?.code ?? '');

		expect(rule?.[1]).toContain('margin-inline-start: calc((var(--ui-control-h) - 8px) / 2)');
	});
});
