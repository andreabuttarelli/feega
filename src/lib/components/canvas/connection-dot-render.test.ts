import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ConnectionDot from './ConnectionDot.svelte';
import { LINK_DOT, LinkState } from '$lib/realtime/connection-link';

const html = (state: LinkState) => render(ConnectionDot, { props: { state } }).body;

describe('the connection dot', () => {
	for (const state of Object.values(LinkState)) {
		it(`${state}: a status dot with its tooltip and tone, no sentence on screen`, () => {
			const body = html(state);

			expect(body).toContain(`data-link="${state}"`);
			expect(body).toContain(`title="${LINK_DOT[state].label}"`);
			expect(body).toContain(`aria-label="${LINK_DOT[state].label}"`);
			expect(body).toContain(`--dot: ${LINK_DOT[state].tone}`);
			expect(body).toContain('role="status"');
			expect(body).not.toMatch(/>[^<]*\w[^<]*</);
		});
	}

	it('every state has its own tone or label, and offline is told apart from live', () => {
		expect(LINK_DOT[LinkState.Offline].tone).not.toBe(LINK_DOT[LinkState.Connected].tone);
		expect(LINK_DOT[LinkState.Reconnecting].tone).not.toBe(LINK_DOT[LinkState.Connected].tone);
	});
});
