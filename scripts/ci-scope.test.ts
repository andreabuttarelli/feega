import { describe, expect, it } from 'vitest';
import { FIXTURES, MODE_DIFF, MODE_FULL, MODE_SMOKE, OS_FULL, OS_UBUNTU, modeFor, scope } from './ci-scope.mjs';

const cell = (os: string, fixture: string) => ({ os, fixture });

const ubuntuOnly = (fixtures: string[]) => fixtures.map((f) => cell(OS_UBUNTU, f));

const everyOs = (fixtures: string[]) =>
	OS_FULL.flatMap((os: string) => fixtures.map((f) => cell(os, f)));

const CASES: { name: string; files: string[]; matrix: unknown[]; unit: boolean; relay: boolean }[] = [
	{ name: 'solo docs: niente', files: ['web-docs/src/a.md', 'landing/x.ts', 'README.md'], matrix: [], unit: false, relay: false },
	{ name: 'markdown dentro inspect: niente', files: ['inspect/README.md', 'inspect/CHANGELOG.md'], matrix: [], unit: false, relay: false },
	{ name: 'solo test: solo unit', files: ['inspect/src/host/ready.test.ts'], matrix: [], unit: true, relay: false },
	{ name: 'webview: unit e react-css su ubuntu', files: ['inspect/src/webview/Properties.svelte'], matrix: ubuntuOnly(['react-css']), unit: true, relay: false },
	{ name: 'properties-panel come webview', files: ['packages/properties-panel/src/a.ts'], matrix: ubuntuOnly(['react-css']), unit: true, relay: false },
	{ name: 'impact e2e: solo react-css', files: ['npx/test/impact.e2e.mjs'], matrix: ubuntuOnly(['react-css']), unit: true, relay: false },
	{ name: 'library come webview', files: ['packages/library/items/x.json'], matrix: ubuntuOnly(['react-css']), unit: true, relay: false },
	{ name: 'astro: solo astro-css su ubuntu', files: ['inspect/launcher/astro.mjs'], matrix: ubuntuOnly(['astro-css']), unit: true, relay: false },
	{ name: 'nuxt layer: solo nuxt-css', files: ['inspect/launcher/nuxt-layer/nuxt.config.ts'], matrix: ubuntuOnly(['nuxt-css']), unit: true, relay: false },
	{ name: 'next preload: solo next-css', files: ['inspect/launcher/next-preload.cjs'], matrix: ubuntuOnly(['next-css']), unit: true, relay: false },
	{ name: 'fixture: solo quella', files: ['inspect/test/fixtures/vue-css/src/App.vue'], matrix: ubuntuOnly(['vue-css']), unit: false, relay: false },
	{ name: 'launcher: tutti i fixture su ogni OS', files: ['inspect/launcher/launch.mjs'], matrix: everyOs(FIXTURES), unit: true, relay: false },
	{ name: 'dev-server: matrice piena', files: ['inspect/src/host/dev-server.ts'], matrix: everyOs(FIXTURES), unit: true, relay: false },
	{ name: 'process-tree: matrice piena', files: ['inspect/src/host/process-tree.ts'], matrix: everyOs(FIXTURES), unit: true, relay: false },
	{ name: 'npx start: matrice piena', files: ['npx/src/cli.ts'], matrix: everyOs(FIXTURES), unit: true, relay: false },
	{ name: 'lockfile: matrice piena', files: ['package-lock.json'], matrix: everyOs(FIXTURES), unit: true, relay: false },
	{ name: 'workflow: matrice piena e relay', files: ['.github/workflows/inspect-os.yml'], matrix: everyOs(FIXTURES), unit: true, relay: true },
	{ name: 'la tabella stessa: matrice piena e relay', files: ['scripts/ci-scope.mjs'], matrix: everyOs(FIXTURES), unit: true, relay: true },
	{ name: 'source-map core: tutti i fixture su ubuntu', files: ['packages/source-map/src/runtime.js'], matrix: ubuntuOnly(FIXTURES), unit: true, relay: false },
	{ name: 'source-map next: solo next-css', files: ['packages/source-map/src/next.ts'], matrix: ubuntuOnly(['next-css']), unit: true, relay: false },
	{ name: 'relay: relay e unit', files: ['relay/src/index.ts'], matrix: [], unit: true, relay: true },
	{ name: 'test e2e del relay: relay e unit', files: ['relay/e2e/tunnel.e2e.test.ts'], matrix: [], unit: true, relay: true },
	{ name: 'test del gate di condivisione: relay e unit', files: ['inspect/src/host/share/gate.test.ts'], matrix: [], unit: true, relay: true },
	{ name: 'client di condivisione: relay e unit', files: ['inspect/src/host/share/client.ts'], matrix: [], unit: true, relay: true },
	{ name: 'protocollo di condivisione: relay e unit', files: ['packages/share-protocol/src/frame.ts'], matrix: [], unit: true, relay: true },
	{ name: 'sessione: relay piu tutti i fixture su ubuntu', files: ['inspect/src/host/session.ts'], matrix: ubuntuOnly(FIXTURES), unit: true, relay: true },
	{ name: 'core piu launcher: OS pieno', files: ['packages/source-map/src/runtime.js', 'inspect/launcher/launch.mjs'], matrix: everyOs(FIXTURES), unit: true, relay: false },
	{ name: 'webview piu astro: unione', files: ['inspect/src/webview/App.svelte', 'inspect/launcher/astro.mjs'], matrix: ubuntuOnly(['react-css', 'astro-css']), unit: true, relay: false },
	{ name: 'file inspect sconosciuto: tutti su ubuntu', files: ['inspect/src/host/new-thing.ts'], matrix: ubuntuOnly(FIXTURES), unit: true, relay: false },
	{ name: 'solo fuori area: niente', files: ['src/routes/a.ts', 'supabase/migrations/1.sql'], matrix: [], unit: false, relay: false },
];

describe('scope sulle pull request', () => {
	for (const c of CASES) {
		it(c.name, () => {
			const r = scope(c.files, MODE_DIFF);
			expect(r.matrix).toEqual(c.matrix);
			expect(r.unit).toBe(c.unit);
			expect(r.relay).toBe(c.relay);
		});
	}
});

describe('modalita senza diff', () => {
	it('full: matrice piena, unit e relay', () => {
		expect(scope([], MODE_FULL)).toEqual({ matrix: everyOs(FIXTURES), unit: true, relay: true });
	});

	it('smoke: tutti i fixture su ubuntu, unit e relay', () => {
		expect(scope([], MODE_SMOKE)).toEqual({ matrix: ubuntuOnly(FIXTURES), unit: true, relay: true });
	});
});

describe('modeFor', () => {
	const SHA = 'a'.repeat(40);
	const ZEROS = '0'.repeat(40);

	it('pull request: diff', () => {
		expect(modeFor({ event: 'pull_request', before: '', reachable: true, full: '' })).toBe(MODE_DIFF);
	});

	it('push normale: diff', () => {
		expect(modeFor({ event: 'push', before: SHA, reachable: true, full: '' })).toBe(MODE_DIFF);
	});

	it('push con before a zeri: full', () => {
		expect(modeFor({ event: 'push', before: ZEROS, reachable: true, full: '' })).toBe(MODE_FULL);
	});

	it('push con before irraggiungibile (force-push): full', () => {
		expect(modeFor({ event: 'push', before: SHA, reachable: false, full: '' })).toBe(MODE_FULL);
	});

	it('dispatch con full true: full', () => {
		expect(modeFor({ event: 'workflow_dispatch', before: '', reachable: true, full: 'true' })).toBe(MODE_FULL);
	});

	it('dispatch senza full: smoke', () => {
		expect(modeFor({ event: 'workflow_dispatch', before: '', reachable: true, full: 'false' })).toBe(MODE_SMOKE);
	});
});
