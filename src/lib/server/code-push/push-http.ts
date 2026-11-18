import { json } from '@sveltejs/kit';
import { httpStatusOf } from './frames-push';

const HTTP_BAD_REQUEST = 400;

type Refused = { ok: false; refusal: string };

export const answer = <T extends { ok: true }>(out: T | Refused) => (out.ok ? json(out) : json(out, { status: httpStatusOf(out.refusal) }));

export const invalid = () => json({ ok: false, refusal: 'invalid' }, { status: HTTP_BAD_REQUEST });
