import { describe, expect, it, vi, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const submitVideoRender = vi.fn();
const finishVideoRender = vi.fn();

vi.mock('$lib/server/video', () => ({
	submitVideoRender: (...args: unknown[]) => submitVideoRender(...args),
	finishVideoRender: (...args: unknown[]) => finishVideoRender(...args)
}));
vi.mock('$lib/server/ai-log', () => ({
	withBrandContext: <T>(_id: string, fn: () => T) => fn(),
	withOrgContext: <T>(_id: string, fn: () => T) => fn()
}));
vi.mock('$lib/server/brand-media', () => ({
	saveRenderedVideoToLibrary: async () => ({ mediaId: 'media-1' })
}));

const TIMEOUT = { message: 'canceling statement due to statement timeout' };

function makeDb(opts: { failInserts?: number; failUpdates?: number } = {}) {
	const rows: Row[] = [];
	let insertsToFail = opts.failInserts ?? 0;
	let updatesToFail = opts.failUpdates ?? 0;

	function query(mode: 'select' | 'update', patch?: Row) {
		const filters: Array<(r: Row) => boolean> = [];
		const run = () => {
			if (mode === 'update' && patch?.task_id && updatesToFail > 0) {
				updatesToFail -= 1;
				return { data: null, error: TIMEOUT };
			}
			const hits = rows.filter((r) => filters.every((f) => f(r)));
			if (mode === 'update') {
				hits.forEach((r) => Object.assign(r, patch));
			}
			return { data: hits, error: null };
		};
		const api: Row = {
			eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
			in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), api),
			lt: (c: string, v: string) => (filters.push((r) => r[c] != null && r[c] < v), api),
			like: (c: string, p: string) => (
				filters.push((r) => String(r[c]).startsWith(p.replace('%', ''))), api
			),
			not: (c: string, _op: string, p: string) => (
				filters.push((r) => !String(r[c]).startsWith(p.replace('%', ''))), api
			),
			order: () => api,
			limit: () => api,
			select: () => api,
			maybeSingle: async () => {
				const out = run();
				return { data: out.data?.[0] ?? null, error: out.error };
			},
			then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
				Promise.resolve(run()).then(res, rej)
		};
		return api;
	}

	const client = {
		from: () => ({
			select: () => query('select'),
			update: (patch: Row) => query('update', patch),
			insert: (row: Row) => ({
				select: () => ({
					maybeSingle: async () => {
						if (insertsToFail > 0) {
							insertsToFail -= 1;
							return { data: null, error: TIMEOUT };
						}
						const created = {
							id: `row-${rows.length + 1}`,
							attempts: 0,
							status: 'rendering',
							...row
						};
						rows.push(created);
						return { data: created, error: null };
					}
				})
			})
		})
	};
	return { rows, client };
}

function submission(taskId = 'openrouter:task-1') {
	return {
		taskId,
		model: 'bytedance/seedance-2-5',
		prompt: 'a clip',
		durationSeconds: 5,
		resolution: '720p',
		persistOpts: { captions: false, tighten: false },
		submittedAt: Date.now()
	};
}

async function track(client: unknown) {
	const { submitAndTrackVideoRender } = await import('./video-render-queue');
	return submitAndTrackVideoRender({
		admin: client as never,
		brandId: 'brand-1',
		userId: 'user-1',
		imagePrompt: 'a clip',
		render: {},
		retryDelaysMs: [0, 0, 0]
	});
}

beforeEach(() => {
	submitVideoRender.mockReset();
	finishVideoRender.mockReset();
});

describe('submitAndTrackVideoRender', () => {
	it('records the render before the provider is asked to bill it', async () => {
		const { rows, client } = makeDb();
		let recordedAtSubmit = 0;
		submitVideoRender.mockImplementation(async () => {
			recordedAtSubmit = rows.length;
			return submission();
		});

		await track(client);

		expect(recordedAtSubmit).toBe(1);
	});

	it('never submits when the render cannot be recorded', async () => {
		const { client } = makeDb({ failInserts: 10 });
		submitVideoRender.mockResolvedValue(submission());

		const out = await track(client);

		expect(out).toBeNull();
		expect(submitVideoRender).not.toHaveBeenCalled();
	});

	it('keeps a paid task when writing its id times out, and reconciles it once', async () => {
		const { rows, client } = makeDb({ failUpdates: 2 });
		submitVideoRender.mockResolvedValue(submission('openrouter:task-7'));

		const out = await track(client);

		expect(out?.jobId).toBe(rows[0].id);
		expect(rows[0].task_id).toBe('openrouter:task-7');
		expect(submitVideoRender).toHaveBeenCalledOnce();

		finishVideoRender.mockResolvedValue({ status: 'done', url: 'https://cdn/clip.mp4' });
		const { reconcileVideoRenders } = await import('./video-render-queue');
		await reconcileVideoRenders(client as never);

		expect(finishVideoRender).toHaveBeenCalledOnce();
		expect(rows[0]).toMatchObject({ status: 'done', media_url: 'https://cdn/clip.mp4' });
	});

	it('does not ask the provider about a render that never got a task id', async () => {
		const { rows, client } = makeDb();
		submitVideoRender.mockResolvedValue(undefined);

		await track(client);
		const { reconcileVideoRenders } = await import('./video-render-queue');
		await reconcileVideoRenders(client as never);

		expect(finishVideoRender).not.toHaveBeenCalled();
		expect(rows[0].status).toBe('failed');
	});
});
