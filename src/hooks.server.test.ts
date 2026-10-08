import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_SUPABASE_URL: 'http://localhost:8000',
	PUBLIC_SUPABASE_ANON_KEY: 'anon-key'
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));

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

let mockSession: { session: unknown; user: unknown } = { session: null, user: null };

vi.mock('@supabase/ssr', async (orig) => ({
	...(await orig<object>()),
	createServerClient: () => ({
		auth: {
			getSession: async () => ({ data: { session: mockSession.session } }),
			getUser: async () => ({ data: { user: mockSession.user }, error: null })
		}
	})
}));

vi.mock('$lib/server/nav-cache', () => ({
	verifiedUser: async () => mockSession.user
}));

vi.mock('$lib/server/db/client', async (orig) => ({
	...(await orig<object>()),
	createUserDb: () => ({ mocked: true })
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

let publishingFlag = 'off';

vi.mock('$lib/server/social-publishing', () => ({
	socialPublishing: async () => publishingFlag
}));

const { handle } = await import('./hooks.server');
const { logAiCall } = await import('$lib/server/ai-log');

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
 * Lo stesso posto in cui si stabilisce a quale brand addebitare la spesa stabilisce anche chi
 * l'ha causata: una rotta non può dimenticarsene. Il nome arriva dalla rete, quindi si convalida
 * qui — chiunque può spedire quell'intestazione, e una riga di `ai_calls` attribuita a un tool
 * inventato è peggio di una riga senza nessun tool.
 */
describe('il tool che ha chiesto il lavoro', () => {
	const spendUnder = async (headers: Record<string, string>) => {
		aiCalls.length = 0;
		await handle({
			event: {
				request: new Request('http://localhost/api/v1/brands/demo/posts', { headers }),
				url: new URL('http://localhost/api/v1/brands/demo/posts'),
				route: { id: '/api/v1/brands/[slug]/posts' },
				params: {},
				cookies: { getAll: () => [], get: () => undefined, set: vi.fn() },
				locals: {}
			},
			resolve: async () => {
				logAiCall({ label: 'planStrategy', provider: 'internal', ms: 1, ok: true, orgId: 'org-1' });
				return new Response('ok');
			}
		} as any);

		await vi.waitFor(() => expect(aiCalls).toHaveLength(1));
		return aiCalls[0];
	};

	it('finisce sulla riga della spesa che ha causato', async () => {
		expect((await spendUnder({ 'x-dazero-tool': 'plan_week' })).operation).toBe('planStrategy:tool:plan_week');
	});

	it('accetta anche il nome nuovo dell’intestazione', async () => {
		expect((await spendUnder({ 'x-feega-tool': 'plan_week' })).operation).toBe('planStrategy:tool:plan_week');
	});

	it('non scrive quello che un nome di tool non è', async () => {
		expect((await spendUnder({ 'x-dazero-tool': 'DROP TABLE ai_calls' })).operation).toBe('planStrategy');
	});

	it('senza intestazione la riga resta com’era', async () => {
		expect((await spendUnder({})).operation).toBe('planStrategy');
	});
});

describe('la radice manda dove dice la regola di ingresso', () => {
	const rootRequestTo = async () => {
		try {
			await handle({
				event: {
					request: new Request('http://localhost/'),
					url: new URL('http://localhost/'),
					route: { id: '/' },
					params: {},
					cookies: { getAll: () => [], get: () => undefined, set: vi.fn() },
					locals: {}
				},
				resolve: async () => new Response('never')
			} as any);
			return null;
		} catch (e) {
			return e as Error & { status?: number; location?: string };
		}
	};

	it('senza sessione va al login', async () => {
		mockSession = { session: null, user: null };
		const redirected = await rootRequestTo();
		expect(redirected?.location).toBe('/login');
	});

	it('con sessione va dove homePathFor decide', async () => {
		mockSession = { session: { access_token: 'tok' }, user: { id: 'user-1', email: 'chi@esempio.it' } };
		const redirected = await rootRequestTo();
		expect(redirected?.location).toBe('/p/proj1/c/canvas1');
	});
});

describe('the landing campaign survives the trip to signup', () => {
	const landFrom = async (search: string, jar: Record<string, string> = {}) => {
		const set = vi.fn((name: string, value: string) => {
			jar[name] = value;
		});
		const remove = vi.fn((name: string) => {
			delete jar[name];
		});
		try {
			await handle({
				event: {
					request: new Request(`http://localhost/${search}`),
					url: new URL(`http://localhost/${search}`),
					route: { id: '/' },
					params: {},
					cookies: { getAll: () => [], get: (name: string) => jar[name], set, delete: remove },
					locals: {}
				},
				resolve: async () => new Response('never')
			} as any);
		} catch {
			return { set, jar };
		}
		return { set, jar };
	};

	it('a known campaign is kept in a first-party functional cookie before the login redirect', async () => {
		mockSession = { session: null, user: null };
		const { set } = await landFrom('?utm_source=feega.app&utm_medium=seo&utm_campaign=anime-video-generator');
		expect(set).toHaveBeenCalledWith(
			'feega_campaign',
			'anime-video-generator',
			expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' })
		);
	});

	it('an unknown campaign leaves no cookie', async () => {
		mockSession = { session: null, user: null };
		const { set } = await landFrom('?utm_campaign=spring-sale');
		expect(set).not.toHaveBeenCalledWith('feega_campaign', expect.anything(), expect.anything());
	});

	it('a signed-in visitor hands the campaign to the landing canvas and the cookie is spent', async () => {
		mockSession = { session: { access_token: 'tok' }, user: { id: 'user-1', email: 'chi@esempio.it' } };
		const { homePathFor } = await import('$lib/server/tenancy/entry');
		const { jar } = await landFrom('?utm_campaign=claymation-ai');
		expect(vi.mocked(homePathFor).mock.lastCall?.[5]).toBe('claymation-ai');
		expect(jar.feega_campaign).toBeUndefined();
	});
});

describe('la pubblicazione social dietro il flag', () => {
	const hit = (routeId: string, path: string) =>
		handle({
			event: {
				request: new Request(`http://localhost${path}`, { method: 'POST' }),
				url: new URL(`http://localhost${path}`),
				route: { id: routeId },
				params: {},
				cookies: { getAll: () => [], get: () => undefined, set: vi.fn() },
				locals: {}
			},
			resolve: async () => new Response('ok')
		} as any);

	it('con il flag spento il cron degli account non gira', async () => {
		publishingFlag = 'off';
		await expect(hit('/api/v1/health/accounts/tick', '/api/v1/health/accounts/tick')).rejects.toMatchObject({ status: 404 });
	});

	it('con il flag spento la tela rifiuta di creare un post', async () => {
		publishingFlag = 'off';
		await expect(hit('/p/[projectId]/c/[canvasId]', '/p/p1/c/c1?/create_post')).rejects.toMatchObject({ status: 404 });
	});

	it('con il flag acceso tutto passa come prima', async () => {
		publishingFlag = 'on';
		expect((await hit('/api/v1/health/accounts/tick', '/api/v1/health/accounts/tick')).status).toBe(200);
		expect((await hit('/p/[projectId]/c/[canvasId]', '/p/p1/c/c1?/create_post')).status).toBe(200);
	});
});
