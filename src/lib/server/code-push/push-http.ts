import { json } from '@sveltejs/kit';
import { httpStatusOf, type FramesRefused } from './frames-push';

const HTTP_BAD_REQUEST = 400;

export const answer = <T extends { ok: true }>(out: T | FramesRefused) => (out.ok ? json(out) : json(out, { status: httpStatusOf(out.refusal) }));

export const invalid = () => json({ ok: false, refusal: 'invalid' }, { status: HTTP_BAD_REQUEST });
