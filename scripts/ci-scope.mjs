import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const OS_UBUNTU = 'ubuntu-24.04';
export const OS_FULL = [OS_UBUNTU, 'windows-latest', 'macos-latest'];

export const FIXTURES = [
	'react-css',
	'next-css',
	'vue-css',
	'sveltekit-css',
	'vite-vanilla',
	'astro-css',
	'nuxt-css',
	'react-router-css',
];

export const MODE_DIFF = 'diff';
export const MODE_FULL = 'full';
export const MODE_SMOKE = 'smoke';

const REPRESENTATIVE = ['react-css'];
const EDITOR_FIXTURES = ['react-css', 'next-css', 'vue-css', 'sveltekit-css'];
const FRAMEWORK_FIXTURES = ['vite-vanilla', 'astro-css', 'nuxt-css', 'react-router-css'];
const ZERO_SHA = /^0+$/;

const NOTHING = { fixtures: [], fullOs: false, unit: false, relay: false };
const EVERYTHING = { fixtures: FIXTURES, fullOs: true, unit: true, relay: true };
const OS_SENSITIVE = { fixtures: FIXTURES, fullOs: true, unit: true, relay: false };
const CORE = { fixtures: FIXTURES, fullOs: false, unit: true, relay: false };
const only = (fixtures, unit = true) => ({ fixtures, fullOs: false, unit, relay: false });

const RULES = [
	[/\.(md|mdx)$/, NOTHING],
	[/\.test\.(ts|js|mjs)$/, only([], true)],
	[/^(\.github\/workflows\/|scripts\/ci-scope)/, EVERYTHING],
	[/^(package(-lock)?\.json|inspect\/package(-lock)?\.json|npx\/package(-lock)?\.json)$/, OS_SENSITIVE],
	[/^inspect\/launcher\/launch\.mjs$/, OS_SENSITIVE],
	[/^inspect\/src\/host\/(dev-server|dev-proxy|ready|listener|process-tree|orphans|kept-servers|node-platform|platform|launch|server-info|app-root)\.ts$/, OS_SENSITIVE],
	[/^npx\/(src\/(cli|args|editor-server)\.ts|build\.mjs)$/, OS_SENSITIVE],
	[/^packages\/dev-run\//, OS_SENSITIVE],
	[/^inspect\/launcher\/astro\.mjs$/, only(['astro-css'])],
	[/^inspect\/launcher\/nuxt-layer\//, only(['nuxt-css'])],
	[/^(inspect\/launcher\/next-preload\.cjs|packages\/source-map\/src\/next[^/]*)$/, only(['next-css'])],
	[/^inspect\/test\/fixtures\/([^/]+)\//, (m) => only(FIXTURES.filter((f) => f === m[1]), false)],
	[/^inspect\/test\/fixtures\/[^/]+$/, NOTHING],
	[/^npx\/test\/(editor|editing)\.e2e\.mjs$/, only(EDITOR_FIXTURES)],
	[/^npx\/test\/frameworks\.e2e\.mjs$/, only(FRAMEWORK_FIXTURES)],
	[/^npx\/test\/(attach|impact)\.e2e\.mjs$/, only(REPRESENTATIVE)],
	[/^(inspect\/src\/webview\/|packages\/(properties-panel|library|plugin-[^/]+)\/)/, only(REPRESENTATIVE)],
	[/^(relay\/|packages\/share-protocol\/)/, { fixtures: [], fullOs: false, unit: true, relay: true }],
	[/^(inspect|npx|packages\/(source-map|live-edit))\//, CORE],
];

const effectOf = (file) => {
	for (const [pattern, effect] of RULES) {
		const match = file.match(pattern);
		if (match) {
			return typeof effect === 'function' ? effect(match) : effect;
		}
	}
	return NOTHING;
};

const matrixOf = (fixtures, fullOs) => {
	const ordered = FIXTURES.filter((f) => fixtures.has(f));
	const systems = fullOs ? OS_FULL : [OS_UBUNTU];
	return systems.flatMap((os) => ordered.map((fixture) => ({ os, fixture })));
};

export const scope = (files, mode) => {
	if (mode === MODE_FULL) {
		return { matrix: matrixOf(new Set(FIXTURES), true), unit: true, relay: true };
	}
	if (mode === MODE_SMOKE) {
		return { matrix: matrixOf(new Set(FIXTURES), false), unit: true, relay: true };
	}

	const fixtures = new Set();
	let fullOs = false;
	let unit = false;
	let relay = false;

	for (const file of files) {
		const effect = effectOf(file);
		effect.fixtures.forEach((f) => fixtures.add(f));
		fullOs ||= effect.fullOs;
		unit ||= effect.unit;
		relay ||= effect.relay;
	}

	return { matrix: matrixOf(fixtures, fullOs), unit, relay };
};

export const modeFor = ({ event, before, reachable, full }) => {
	if (event === 'workflow_dispatch') {
		return full === 'true' ? MODE_FULL : MODE_SMOKE;
	}
	if (event === 'push' && (ZERO_SHA.test(before) || !reachable)) {
		return MODE_FULL;
	}
	return MODE_DIFF;
};

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

const isReachable = (sha) => {
	try {
		git('cat-file', '-e', `${sha}^{commit}`);
		return true;
	} catch {
		return false;
	}
};

const changedFiles = (base, head) =>
	git('diff', '--name-only', base, head).split('\n').filter(Boolean);

const main = () => {
	const [event, base, head, full = ''] = process.argv.slice(2);
	const reachable = !base || isReachable(base);
	const mode = modeFor({ event, before: base ?? '', reachable, full });
	const files = mode === MODE_DIFF ? changedFiles(base, head) : [];
	const result = scope(files, mode);

	const lines = [
		`matrix=${JSON.stringify({ include: result.matrix })}`,
		`e2e=${result.matrix.length > 0}`,
		`unit=${result.unit}`,
		`relay=${result.relay}`,
	];
	console.log(`mode=${mode}\n${lines.join('\n')}`);
	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
	}
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main();
}
