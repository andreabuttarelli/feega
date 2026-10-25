/**
 * Il percorso del self-host, sui punti dove una svista non si vede finché non si prova a INSTALLARE.
 *
 * Trovato provandolo: con `POSTGRES_PORT=5433` lo stack partiva sano — i servizi si parlano su
 * `db:${POSTGRES_PORT}` dentro la rete — ma dall'host il database era irraggiungibile, perché la
 * pubblicazione era `${POSTGRES_PORT}:5432` e dentro il container Postgres ascoltava su 5433.
 * `npm run db:migrate` moriva con ECONNRESET, cioè il primo comando della guida.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PKG = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

const ENV_EXAMPLE = readFileSync('.env.example', 'utf8');

const COMPOSE = readFileSync('infra/compose/docker-compose.yml', 'utf8');
const KONG = readFileSync('infra/compose/volumes/api/kong.yml', 'utf8');
const APP_DOCKERFILE = readFileSync('infra/app/Dockerfile', 'utf8');

const bundledModules = (dir = 'src'): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const path = `${dir}/${e.name}`;
		if (e.isDirectory()) return bundledModules(path);
		if (!/\.(ts|svelte)$/.test(e.name) || /\.test\.ts$/.test(e.name)) return [];
		return [path];
	});

const publishedPorts = (): string[] => [...COMPOSE.matchAll(/^\s*-\s*'([^']+:[^']+)'/gm)].map((m) => m[1]);

describe('docker-compose del self-host', () => {
	it('nessun modulo pretende env al momento della build: l’immagine si costruisce senza .env', () => {
		const offenders = bundledModules().filter((f) =>
			/^import .* from '\$env\/static\/public';/m.test(readFileSync(f, 'utf8'))
		);

		expect(offenders, `usano $env/static/public: ${offenders.join(', ')}`).toEqual([]);
	});

	it('app e migrate: l’app parte solo dopo che schema e demo sono nel database', () => {
		const block = (service: string) =>
			COMPOSE.match(new RegExp(`\\n  ${service}:\\n([\\s\\S]*?)(?=\\n  [\\w-]+:\\n|\\n\\w|$)`))?.[1] ?? '';

		expect(PKG.scripts['build:node']).toContain('max-old-space-size=8192');
		expect(block('app')).toMatch(/^\s{4}build:/m);
		expect(block('app')).toMatch(/migrate:\s*\n\s*condition: service_completed_successfully/);
		expect(block('migrate')).toContain('infra/setup/Dockerfile');
	});

	it('l’app condivide la rete di kong: browser e server raggiungono Supabase allo stesso indirizzo', () => {
		expect(COMPOSE).toMatch(/network_mode: 'service:kong'/);
		expect(COMPOSE).toMatch(/PUBLIC_SUPABASE_URL: \$\{SUPABASE_PUBLIC_URL:-http:\/\/localhost:8000\}/);
	});

	it('ogni porta pubblicata sta su 127.0.0.1: i segreti demo non escono dalla macchina', () => {
		expect(publishedPorts().filter((p) => !p.startsWith('127.0.0.1:'))).toEqual([]);
	});

	it('la porta del database è la stessa dentro e fuori: cambiarla non lo stacca dall’host', () => {
		const mapping = publishedPorts().find((p) => p.includes('POSTGRES_PORT')) ?? '';
		const sides = mapping.replace(/^127\.0\.0\.1:/, '').match(/^(\$\{[^}]*\}|\d+):(\$\{[^}]*\}|\d+)(\/tcp)?$/);

		expect(sides, `pubblicazione illeggibile: ${mapping}`).not.toBeNull();
		expect(sides?.[1]).toBe(sides?.[2]);
	});

	it('ogni servizio raggiunge il database sulla porta configurata, non su una cablata', () => {
		const dbRefs = [...COMPOSE.matchAll(/@db:(\d+|\$\{POSTGRES_PORT[^}]*\})/g)].map((m) => m[1]);

		expect(dbRefs.length).toBeGreaterThan(0);
		expect(dbRefs.filter((ref) => !ref.startsWith('${POSTGRES_PORT'))).toEqual([]);
	});
});

describe('avviare la build di produzione', () => {
	it('installa i workspace package prima di npm ci', () => {
		expect(APP_DOCKERFILE).toContain('COPY packages ./packages');
	});

	/**
	 * `$env/dynamic/private` legge `process.env` a runtime, e `node build` non legge nessun `.env`:
	 * lo carica Vite, che a quel punto non c'è più. La guida dice `npm run build:node && npm run
	 * start` e basta — chi la segue ottiene un'app che risponde 200 e non ha database
	 * («SUPABASE_SERVICE_ROLE_KEY not configured» su /api/status), il che sembra un guasto suo.
	 */
	it('`start` carica il .env, o l’app parte senza niente di privato configurato', () => {
		expect(PKG.scripts.start).toContain('--env-file');
	});
});

describe('.env.example', () => {
	/**
	 * adapter-node distingue «non impostata» da «vuota»: con `ORIGIN=` rifiuta di partire
	 * («Invalid ORIGIN: ''»), e il template la spediva vuota proprio mentre il commento sopra dice
	 * «lasciala non impostata». Finché `.env` non veniva letto a runtime nessuno se ne accorgeva.
	 */
	it('non spedisce ORIGIN vuota: adapter-node non parte', () => {
		expect(ENV_EXAMPLE).not.toMatch(/^ORIGIN=\s*$/m);
	});
});

describe('healthcheck dell’app', () => {
	/**
	 * wget --spider di busybox considera 3xx un errore. La homepage, con HIDE_MARKETING=1,
	 * risponde 303 verso /app: un healthcheck su `/` farebbe restare l'app forever-unhealthy
	 * nel momento in cui si accende la flag. robots.txt è sempre 200, senza sessione.
	 */
	it('non picchia la homepage: HIDE_MARKETING la reindirizza', () => {
		expect(COMPOSE).toMatch(/127\.0\.0\.1:\$\{APP_PORT:-3000\}\/robots\.txt/);
		expect(COMPOSE).not.toMatch(/127\.0\.0\.1:\$\{APP_PORT:-3000\}\/'/);
	});
});

describe('Realtime dello stack locale', () => {
	it('usa il servizio Realtime dello stesso compose e propaga il flag kit all’app', () => {
		expect(COMPOSE).toContain('BILLING_PROVIDER: ${BILLING_PROVIDER:-open}');
		expect(COMPOSE).not.toContain('container_name:');
		expect(KONG).toContain('url: http://realtime-dev:4000/socket');
		expect(KONG).not.toContain('realtime-dev.feega-realtime');
		expect(KONG.match(/Host: realtime-dev/g) ?? []).toHaveLength(2);
	});
});

describe('lo schema di un’installazione nuova', () => {
	/**
	 * Provato installando: su un database appena migrato ogni riga di `ai_calls` veniva rifiutata
	 * («Could not find the 'cached_tokens' column»), e il rifiuto è un `console.warn` — l'app
	 * funziona, il conto di quanto costa non esiste. Le migration legacy descrivono un altro
	 * prodotto: lo schema di una nuova installazione è `supabase/baseline`.
	 */
	it('ogni colonna che ai-log.ts inserisce esiste nel baseline', () => {
		const source = readFileSync('src/lib/server/ai-log.ts', 'utf8');
		const insert = source.slice(source.indexOf('const row: AiCallInsert = {'));
		const columns = [...insert.slice(0, insert.indexOf('};')).matchAll(/^\s{8}([a-z_]+):/gm)].map((m) => m[1]);
		const baseline = readFileSync('supabase/baseline/0001_tables.sql', 'utf8');
		const aiCalls = baseline.slice(baseline.indexOf('create table public.ai_calls'), baseline.indexOf('create table public.ai_models'));

		expect(columns.length).toBeGreaterThan(10);
		expect(columns.filter((c) => !new RegExp(`^  ${c} `, 'm').test(aiCalls))).toEqual([]);
	});
});
