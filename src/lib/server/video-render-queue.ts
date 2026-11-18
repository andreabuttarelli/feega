/**
 * Out-of-band clip renders.
 *
 * Submitting returns a task id and nothing else is needed: the job lives on the provider's side and
 * its result stays fetchable from any process, forever. So instead of holding an invocation open
 * to watch it — which is what made clip generation the longest thing in this codebase, and what
 * capped every clip at POLL_TIMEOUT_MS regardless of what it actually needed — the task id is
 * written down and a cron picks the result up whenever it lands.
 *
 * The practical consequence: a render is no longer limited by anything on our side. A clip that
 * takes twenty minutes finishes; before, one that took over ten could not finish at all.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	finishVideoRender,
	type RenderVideoOpts,
	type SubmittedVideoRender,
	type VideoPersistOpts
} from '$lib/server/video';
import { withOrgContext } from '$lib/server/ai-log';

/** Il nome del trasporto nei messaggi di resa: chi apre il registro deve sapere dove guardare. */
const VIDEO_TRANSPORT = 'openrouter';

/** Give up on a task the provider never resolves. Generous: each check costs one cheap HTTP call. */
export const VIDEO_RENDER_MAX_AGE_MS = 60 * 60_000;
/**
 * A claim older than this belonged to a process that died mid-finish.
 *
 * Must exceed the reconciler route's own maxDuration (300s), or a tick still legitimately working
 * gets its claim swept by the next tick and the non-idempotent half — downloading the mp4 and
 * billing the provider's charge — runs twice.
 */
export const VIDEO_RENDER_CLAIM_STALE_MS = 15 * 60_000;
/**
 * Stop retrying a render that keeps throwing. Age alone is not enough: a row that fails in
 * persistMp4 comes straight back to a per-minute cron, so without a count it burns sixty attempts
 * inside the age window — and every one of them is a download from the provider.
 *
 * Counts FAILURES only, never the "the provider is still working" checks. Counting those would make this a
 * second, far tighter deadline than VIDEO_RENDER_MAX_AGE_MS: at one tick a minute, eight checks is
 * eight minutes, so every clip needing longer would be declared dead while the provider rendered and billed
 * it — defeating the entire point of moving the render out-of-band.
 */
export const VIDEO_RENDER_MAX_ATTEMPTS = 8;

export type VideoRenderRow = {
	id: string;
	org_id: string | null;
	user_id: string;
	post_id: string | null;
	thread_id: string | null;
	task_id: string;
	model: string;
	status: string;
	duration_seconds: number | null;
	resolution: string | null;
	cover_url: string | null;
	prompt: string | null;
	persist_opts: VideoPersistOpts;
	submitted_at: string;
	attempts: number;
	/** Last failure seen, kept so giving up can say what kept going wrong. */
	error: string | null;
};

export const PENDING_TASK_PREFIX = 'pending:';
export const RECORD_RETRY_DELAYS_MS = [250, 1_000, 3_000];

type DbResult = { error: { message: string } | null };

async function retrying<T extends DbResult>(
	attempt: () => PromiseLike<T>,
	delaysMs: number[]
): Promise<T> {
	let result = await attempt();
	for (const delay of delaysMs) {
		if (!result.error) {
			return result;
		}
		await new Promise((resolve) => setTimeout(resolve, delay));
		result = await attempt();
	}
	return result;
}

type RenderOwner = {
	orgId?: string | null;
	userId: string;
	postId?: string | null;
	threadId?: string | null;
};

async function reserveVideoRender(
	admin: SupabaseClient,
	owner: RenderOwner,
	model: string,
	delaysMs: number[]
): Promise<string | null> {
	const { data, error } = await retrying(
		() =>
			admin
				.from('video_renders')
				.insert({
					org_id: owner.orgId ?? null,
					user_id: owner.userId,
					post_id: owner.postId ?? null,
					thread_id: owner.threadId ?? null,
					task_id: `${PENDING_TASK_PREFIX}${crypto.randomUUID()}`,
					model
				})
				.select('id')
				.maybeSingle(),
		delaysMs
	);
	if (error) {
		console.error('[video-render] reserve failed, not submitting:', error.message);
		return null;
	}
	return (data?.id as string) ?? null;
}

async function attachTask(
	admin: SupabaseClient,
	jobId: string,
	submitted: SubmittedVideoRender,
	delaysMs: number[]
): Promise<boolean> {
	const { error } = await retrying(
		() =>
			admin
				.from('video_renders')
				.update({
					task_id: submitted.taskId,
					model: submitted.model,
					prompt: submitted.prompt,
					duration_seconds: submitted.durationSeconds,
					resolution: submitted.resolution,
					cover_url: submitted.coverUrl ?? null,
					persist_opts: submitted.persistOpts,
					submitted_at: new Date(submitted.submittedAt).toISOString()
				})
				.eq('id', jobId),
		delaysMs
	);
	if (error) {
		console.error(
			`[video-render] PAID TASK UNRECORDED job=${jobId} task=${submitted.taskId}:`,
			error.message
		);
		return false;
	}
	return true;
}

export type TrackedVideoRender = SubmittedVideoRender & { jobId: string };

const PROVIDER_REFUSED = 'provider refused';

export async function submitAndTrackVideoRender(
	opts: RenderOwner & {
		admin: SupabaseClient;
		imagePrompt: string;
		render: RenderVideoOpts;
		onSubmitError?: (reason: string) => void;
		retryDelaysMs?: number[];
	}
): Promise<TrackedVideoRender | null> {
	const delays = opts.retryDelaysMs ?? RECORD_RETRY_DELAYS_MS;
	const jobId = await reserveVideoRender(opts.admin, opts, opts.render.model ?? 'unknown', delays);
	if (!jobId) {
		return null;
	}

	const { submitVideoRender } = await import('$lib/server/video');
	let refusal = PROVIDER_REFUSED;
	const submitted = await submitVideoRender(opts.imagePrompt, {
		...opts.render,
		onSubmitError: opts.onSubmitError
	}).catch((e) => {
		if (e instanceof Error && e.name === 'CreditsExhaustedError') {
			throw e;
		}
		const reason = e instanceof Error ? e.message : String(e);
		console.error('[video-render] submit failed:', reason);
		refusal = `${PROVIDER_REFUSED}: ${reason}`;
		return undefined;
	});

	if (!submitted) {
		await opts.admin
			.from('video_renders')
			.update({ status: 'failed', error: refusal, finished_at: new Date().toISOString() })
			.eq('id', jobId)
			.then(undefined, () => {});
		return null;
	}

	const recorded = await attachTask(opts.admin, jobId, submitted, delays);
	if (!recorded) {
		return null;
	}
	return { ...submitted, jobId };
}

function inPayerScope<T>(row: VideoRenderRow, fn: () => Promise<T>): Promise<T> {
	return withOrgContext(String(row.org_id), fn);
}

/** Esportata: il canvas la riusa per finire un `node_runs` video dalla stessa riga `video_renders`. */
export function rowToSubmitted(row: VideoRenderRow): SubmittedVideoRender {
	return {
		taskId: row.task_id,
		model: row.model,
		prompt: row.prompt ?? '',
		durationSeconds: row.duration_seconds ?? 0,
		resolution: row.resolution ?? '480p',
		coverUrl: row.cover_url ?? undefined,
		persistOpts: (row.persist_opts ?? { captions: false, tighten: false }) as VideoPersistOpts,
		submittedAt: Date.parse(row.submitted_at) || Date.now()
	};
}

/**
 * Release claims whose holder died. Without this a process killed between claiming and finishing
 * strands the render at `finishing` forever — the clip exists at the provider and nobody ever collects it.
 */
async function releaseStaleClaims(admin: SupabaseClient): Promise<void> {
	await admin
		.from('video_renders')
		.update({ status: 'rendering', claimed_at: null })
		.eq('status', 'finishing')
		.lt('claimed_at', new Date(Date.now() - VIDEO_RENDER_CLAIM_STALE_MS).toISOString())
		.then(undefined, () => {});
}

async function expireUnsubmitted(admin: SupabaseClient): Promise<void> {
	await admin
		.from('video_renders')
		.update({ status: 'expired', error: 'never submitted', finished_at: new Date().toISOString() })
		.eq('status', 'rendering')
		.like('task_id', `${PENDING_TASK_PREFIX}%`)
		.lt('submitted_at', new Date(Date.now() - VIDEO_RENDER_MAX_AGE_MS).toISOString())
		.then(undefined, () => {});
}

async function settle(
	admin: SupabaseClient,
	row: VideoRenderRow,
	patch: Record<string, unknown>
): Promise<void> {
	const { error } = await admin
		.from('video_renders')
		.update({ ...patch, finished_at: new Date().toISOString() })
		.eq('id', row.id);
	if (error) {
		console.error(`[video-render] settle failed id=${row.id}:`, error.message);
	}
}

/**
 * One pass: check every outstanding render once and finish whichever the provider has completed.
 *
 * No loop, no sleep, no per-render budget — a tick is a handful of HTTP calls, which is exactly
 * why the give-up window can be an hour instead of ten minutes.
 */
export async function reconcileVideoRenders(
	admin: SupabaseClient,
	opts: { limit?: number } = {}
): Promise<{ checked: number; done: number; failed: number; expired: number }> {
	await releaseStaleClaims(admin);
	await expireUnsubmitted(admin);

	const { data: rows } = await admin
		.from('video_renders')
		.select(
			'id, org_id, user_id, post_id, thread_id, task_id, model, status, duration_seconds, resolution, cover_url, prompt, persist_opts, submitted_at, attempts, error'
		)
		.eq('status', 'rendering')
		.not('task_id', 'like', `${PENDING_TASK_PREFIX}%`)
		.order('submitted_at', { ascending: true })
		.limit(opts.limit ?? 20);

	let checked = 0;
	let done = 0;
	let failed = 0;
	let expired = 0;

	for (const raw of (rows ?? []) as VideoRenderRow[]) {
		const age = Date.now() - (Date.parse(raw.submitted_at) || Date.now());
		const exhausted = raw.attempts >= VIDEO_RENDER_MAX_ATTEMPTS;
		if (age > VIDEO_RENDER_MAX_AGE_MS || exhausted) {
			const why = exhausted
				? `gave up after ${raw.attempts} attempts (${raw.error ?? 'repeated failures'})`
				: `${VIDEO_TRANSPORT} never resolved this task`;
			await settle(admin, raw, { status: 'expired', error: why });
			expired += 1;
			continue;
		}

		// Claim before doing anything non-idempotent: persistMp4 writes a file and the billing call
		// charges the payer, and two overlapping ticks must not do either twice.
		// Note: attempts is NOT bumped here. Most claims are "is it done yet?" checks against a
		// perfectly healthy render, and counting those turns the retry cap into a deadline of
		// MAX_ATTEMPTS minutes. Only real failures below increment it.
		const { data: claimed } = await admin
			.from('video_renders')
			.update({ status: 'finishing', claimed_at: new Date().toISOString() })
			.eq('id', raw.id)
			.eq('status', 'rendering')
			.select('id')
			.maybeSingle();
		if (!claimed) continue;

		checked += 1;
		try {
			// Lo scope di chi paga, così la fattura dentro finishVideoRender atterra sul suo registro.
			// Sbagliarlo scrive una riga in `ai_calls` che nessuna somma trova: spesa vera, invisibile.
			const outcome = await inPayerScope(raw, () =>
				finishVideoRender(admin, raw.user_id, rowToSubmitted(raw))
			);

			if (outcome.status === 'pending') {
				// Not ready: hand it straight back so the next tick sees it.
				await admin
					.from('video_renders')
					.update({ status: 'rendering', claimed_at: null })
					.eq('id', raw.id)
					.then(undefined, () => {});
				continue;
			}

			if (outcome.status === 'failed') {
				await settle(admin, raw, { status: 'failed', error: outcome.error.slice(0, 2000) });
				failed += 1;
				continue;
			}

			await settle(admin, raw, { status: 'done', media_url: outcome.url });
			done += 1;
		} catch (e) {
			// Unknown failure: give the row back rather than burying it. The age check above is what
			// stops a permanently broken task from being retried forever.
			const message = e instanceof Error ? e.message : String(e);
			console.error(`[video-render] reconcile failed id=${raw.id}:`, message);
			await admin
				.from('video_renders')
				.update({
					status: 'rendering',
					claimed_at: null,
					attempts: raw.attempts + 1,
					error: message.slice(0, 2000)
				})
				.eq('id', raw.id)
				.then(undefined, () => {});
		}
	}

	return { checked, done, failed, expired };
}
