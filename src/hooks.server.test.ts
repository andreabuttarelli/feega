import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_SUPABASE_URL: 'http://localhost:8000',
	PUBLIC_SUPABASE_ANON_KEY: 'anon-key'
}));

vi.mock('$env/dynamic/private', () => ({ env: { VERCEL_ENV: 'production' } }));

vi.mock('@sentry/sveltekit', () => ({
	sentryHandle: () => ({ event, resolve }: { event: unknown; resolve: (event: unknown) => unknown }) =>
		resolve(event),
	handleErrorWithSentry: () => () => undefined
}));

vi.mock('@sveltejs/kit/hooks', () => ({
	sequence: (...handlers: Array<(input: { event: any; resolve: any }) => any>) =>
		({ event, resolve }: { event: any; resolve: any }) => {
			const run = (index: number, nextEvent: any): any => {
				if (index === handlers.length) return resolve(nextEvent);
				return handlers[index]({
					event: nextEvent,
					resolve: (resolvedEvent: any) => run(index + 1, resolvedEvent)
				});
			};

			return run(0, event);
		}
}));

const tracked = vi.hoisted(() => [] as Array<[string, unknown, unknown]>);
vi.mock('$lib/server/product-events/track', async (orig) => ({
	...(await orig<object>()),
	track: async (event: string, actor: unknown, props: unknown) => void tracked.push([event, actor, props])
}));

let mockSession: { session: unknown; user: unknown } = { session: null, user: null };
let refreshed: unknown = null;

vi.mock('@supabase/ssr', async (orig) => ({
	...(await orig<object>()),
	createServerClient: () => ({
		auth: {
			getSession: async () => ({ data: { session: mockSession.session } }),
			refreshSession: async () => ({ data: { session: refreshed }, error: null }),
			getUser: async () => ({ data: { user: mockSession.user }, error: null })
		}
	})
}));

vi.mock('$lib/server/nav-cache', () => ({
	verifiedUser: async () => mockSession.user
}));

vi.mock('$lib/server/db/client', async (orig) => ({
	...(await orig<object>()),
	createUserDb: (token: string) => ({ mocked: true, token })
}));

vi.mock('$lib/server/tenancy/entry', async (orig) => ({
	...(await orig<object>()),
	homePathFor: vi.fn(async () => '/p/proj1/c/canvas1')
}));

const aiCalls: Record<string, unknown>[] = [];

vi.mock('$lib/server/supabase-admin', () => ({
	createAdminClient: () => ({
		from: () => ({
			insert: (row: Record<string, unknown>) => {
				aiCalls.push(row);
				return {
					select: () => ({
						single: async () => ({ data: { id: 'ai-call-1' }, error: null })
					})
				};
			}
		})
	})
}));

const { handle } = await import('./hooks.server');

const nowS = () => Math.floor(Date.now() / 1000);
const statusEvent = () => ({
	request: new Request('http://localhost/status'),
	url: new URL('http://localhost/status'),
	route: { id: '/status' },
	params: {},
	cookies: { getAll: () => [], get: () => undefined, set: vi.fn() },
	locals: {}
});

describe('a session about to expire is refreshed before a long turn runs on it', () => {
	afterEach(() => {
		mockSession = { session: null, user: null };
	});

	it('a token with five minutes left is swapped for a fresh one, as when a 20-minute trailer build died on "JWT expired"', async () => {
		mockSession = { session: { access_token: 'old', expires_at: nowS() + 300 }, user: { id: 'u1' } };
		refreshed = { access_token: 'fresh', expires_at: nowS() + 3600 };
		let db: unknown = null;

		await handle({ event: statusEvent(), resolve: async (event: any) => { db = await event.locals.db(); return new Response('ok'); } } as any);

		expect(db).toEqual({ mocked: true, token: 'fresh' });
	});

	it('a token with most of its hour left is used as it is', async () => {
		mockSession = { session: { access_token: 'young', expires_at: nowS() + 3500 }, user: { id: 'u1' } };
		refreshed = { access_token: 'fresh', expires_at: nowS() + 3600 };
		let db: unknown = null;

		await handle({ event: statusEvent(), resolve: async (event: any) => { db = await event.locals.db(); return new Response('ok'); } } as any);

		expect(db).toEqual({ mocked: true, token: 'young' });
	});
});

describe('server session recovery', () => {
	it('serves the request when the session cookie is invalid Base64-URL', async () => {
		const response = await handle({
			event: {
				request: new Request('http://localhost/status'),
				url: new URL('http://localhost/status'),
				route: { id: '/status' },
				params: {},
				cookies: {
					getAll: () => [{ name: 'sb-localhost-auth-token', value: 'base64-*' }],
					get: () => undefined,
					set: vi.fn()
				},
				locals: {}
			},
			resolve: async (event: any) => {
				expect(await event.locals.safeGetSession()).toEqual({ session: null, user: null });
				return new Response('ok');
			}
		} as any);

		expect(response.status).toBe(200);
	});
});

/**
 * Chi ha causato la spesa si stabilisce qui: una rotta non può dimenticarsene. Il nome arriva dalla rete, quindi si convalida
 * qui — chiunque può spedire quell'intestazione, e una riga di `ai_calls` attribuita a un tool
 * inventato è peggio di una riga senza nessun tool.
 */
