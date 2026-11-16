import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ brand: [] as string[], org: [] as string[], kind: 'dazero' as 'dazero' | 'open' }));
const swallowed: string[] = [];

vi.mock('./swallow', () => ({ swallow: (reason: string) => void swallowed.push(reason) }));
vi.mock('./billing', () => ({ billingProvider: async () => ({ kind: calls.kind }) }));
vi.mock('./credits', () => ({
	gateCredits: async (id: string) => void calls.brand.push(id),
	gateOrgCredits: async (id: string) => void calls.org.push(id)
}));

import { Gate, SPEND_SITES, spendGate } from './spend-gate';
import { withBrandContext, withCreditExempt, withOrgContext } from './ai-log';
import { BillingUnavailableError } from '$lib/billing/contract';

beforeEach(() => {
	calls.brand = [];
	calls.org = [];
	calls.kind = 'dazero';
	swallowed.length = 0;
});

describe('spendGate: every provider call has a payer whose balance was read', () => {
	it('gates the brand in scope', async () => {
		await withBrandContext('brand-1', () => spendGate());
		expect(calls.brand).toEqual(['brand-1']);
	});

	it('gates the org in scope when there is no brand', async () => {
		await withOrgContext('org-1', () => spendGate());
		expect(calls.org).toEqual(['org-1']);
	});

	it('an explicit payer wins over the scope', async () => {
		await withOrgContext('org-1', () => spendGate({ orgId: 'org-2' }));
		expect(calls.org).toEqual(['org-2']);
	});

	it('a provider call with nobody to bill is refused and reported', async () => {
		await expect(spendGate()).rejects.toBeInstanceOf(BillingUnavailableError);
		expect(swallowed).toHaveLength(1);
	});

	it('a one-time system flow is exempt', async () => {
		await expect(withCreditExempt(() => spendGate())).resolves.toBeUndefined();
	});

	it('open billing (local mode, BILLING_PROVIDER=open) meters nothing', async () => {
		calls.kind = 'open';
		await expect(spendGate()).resolves.toBeUndefined();
	});
});

const ROOT = join(__dirname, '..', '..', '..');
const SOURCE = join(ROOT, 'src');

function sources(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sources(path);
		return /\.(ts|svelte)$/.test(name) && !/\.test\.ts$|\.fixtures\.ts$/.test(name) ? [path] : [];
	});
}

const PROOF: Record<Gate, (code: string) => boolean> = {
	[Gate.Chokepoint]: (code) => /spendGate\(|gateCredits\(|gateOrgCredits\(/.test(code),
	[Gate.Hold]: (code) => code.includes('holdCredits('),
	[Gate.ViaLlm]: (code) => code.includes("import('$lib/server/llm')") || code.includes("from '$lib/server/llm'"),
	[Gate.Entry]: () => true,
	[Gate.HousePaid]: (code) => /label[^\n]*moderation|moderation\./.test(code),
	[Gate.Free]: (code) => !/provider: '(?!internal)[a-z-]+'/.test(code)
};

describe('no spending module bypasses the gate', () => {
	const spending = sources(SOURCE)
		.filter((path) => readFileSync(path, 'utf8').includes('logAiCall('))
		.map((path) => relative(ROOT, path))
		.filter((path) => path !== 'src/lib/server/ai-log.ts')
		.sort();

	it('every module that records provider spend is declared in SPEND_SITES', () => {
		expect(spending).toEqual(Object.keys(SPEND_SITES).sort());
	});

	it.each(Object.entries(SPEND_SITES))('%s carries the gate it declares', (path, gate) => {
		expect(PROOF[gate](readFileSync(join(ROOT, path), 'utf8'))).toBe(true);
	});

	it('every route a turn is reached from calls the entry gate', () => {
		const entries = [
			'src/routes/api/v1/projects/[projectId]/agent/+server.ts',
			'src/routes/api/v1/projects/[projectId]/motion/[nodeId]/agent/+server.ts',
			'src/routes/api/v1/motion/[nodeId]/ask/+server.ts'
		];
		for (const entry of entries) {
			expect(readFileSync(join(ROOT, entry), 'utf8'), entry).toMatch(/gate(Org)?AiAction\(/);
		}
	});
});
