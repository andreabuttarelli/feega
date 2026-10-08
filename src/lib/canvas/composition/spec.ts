import { z } from 'zod';
import { CARD_ASPECTS } from './card-look';
import type { LayoutDefinition } from './index';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const MAX_SPEC_SLOTS = 200;
const MAX_ANIMATIONS = 12;
const FULL_TURN = Math.PI * 2;

const num = z.union([z.number(), z.object({ param: z.string() })]);
type Num = z.infer<typeof num>;

const rangeParam = z.object({ name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/), label: z.string().min(1).max(40), kind: z.literal('range'), min: z.number(), max: z.number(), step: z.number().positive(), default: z.number() });

const place = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('grid'), columns: num, gapX: num, gapY: num }),
	z.object({ kind: z.literal('ring'), radius: num }),
	z.object({ kind: z.literal('line'), gap: num, axis: z.enum(['x', 'y', 'z']).default('x') }),
	z.object({ kind: z.literal('scatter'), spread: num, depth: num, seed: z.number().int().default(1) })
]);

const ANIMATED = ['x', 'y', 'z', 'rotX', 'rotY', 'rotZ', 'scale', 'opacity'] as const;
type Animated = (typeof ANIMATED)[number];

const animation = z.object({
	prop: z.enum(ANIMATED),
	fn: z.enum(['sin', 'linear', 'ease']).default('sin'),
	amp: num,
	freq: num,
	phase: z.object({ column: z.number().default(0), row: z.number().default(0), index: z.number().default(0) }).default({ column: 0, row: 0, index: 0 })
});

export const layoutSpecSchema = z
	.object({
		kind: z.literal('spec'),
		cards: z.enum(CARD_ASPECTS).default('1:1'),
		camera: z.enum(['fixed', 'selected']).default('fixed'),
		motion: z.enum(['cycle', 'ping-pong', 'linear']).default('cycle'),
		slots: num,
		params: z.array(rangeParam).max(12).default([]),
		place,
		tilt: z.object({ x: num, y: num, z: num }).partial().default({}),
		scale: num.default(1),
		animate: z.array(animation).max(MAX_ANIMATIONS).default([])
	})
	.superRefine((spec, ctx) => {
		const names = new Set(spec.params.map((p) => p.name));
		const refs = JSON.stringify(spec).match(/"param":"([^"]+)"/g) ?? [];
		for (const ref of refs) {
			const name = ref.slice('"param":"'.length, -1);
			if (!names.has(name)) {
				ctx.addIssue({ code: 'custom', message: `${name} is not one of the params` });
			}
		}
		if (typeof spec.slots === 'number' && spec.slots > MAX_SPEC_SLOTS) {
			ctx.addIssue({ code: 'custom', message: `at most ${MAX_SPEC_SLOTS} slots` });
		}
		for (const p of spec.params) {
			if (p.min >= p.max || p.default < p.min || p.default > p.max) {
				ctx.addIssue({ code: 'custom', message: `${p.name}: min < max and default within` });
			}
		}
	});

export type LayoutSpec = z.input<typeof layoutSpecSchema>;
type Spec = z.output<typeof layoutSpecSchema>;

export type ParsedSpec = { ok: true; spec: Spec } | { ok: false; problems: string[] };

export function parseLayoutSpec(input: unknown): ParsedSpec {
	const result = layoutSpecSchema.safeParse(input);
	return result.success ? { ok: true, spec: result.data } : { ok: false, problems: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}

type Slot = { index: number; column: number; row: number; x: number; y: number; z: number; yaw: number };

type Read = (value: Num) => number;

function reader(spec: Spec, raw: LayoutParams): Read {
	const values = Object.fromEntries(spec.params.map((p) => [p.name, Math.min(p.max, Math.max(p.min, Number(raw[p.name] ?? p.default)))]));
	return (value) => (typeof value === 'number' ? value : (values[value.param] ?? 0));
}

function seeded(seed: number): () => number {
	let s = seed >>> 0 || 1;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
}

const PLACE: { [K in Spec['place']['kind']]: (p: Extract<Spec['place'], { kind: K }>, count: number, read: Read) => Slot[] } = {
	grid: (p, count, read) => {
		const columns = Math.max(1, Math.round(read(p.columns)));
		const rows = Math.ceil(count / columns);
		const [gapX, gapY] = [read(p.gapX), read(p.gapY)];
		return Array.from({ length: count }, (_, index) => {
			const column = index % columns;
			const row = Math.floor(index / columns);
			return { index, column, row, x: -((columns - 1) * gapX) / 2 + column * gapX, y: ((rows - 1) * gapY) / 2 - row * gapY, z: 0, yaw: 0 };
		});
	},
	ring: (p, count, read) =>
		Array.from({ length: count }, (_, index) => {
			const angle = (index / count) * FULL_TURN;
			return { index, column: index, row: 0, x: Math.sin(angle) * read(p.radius), y: 0, z: Math.cos(angle) * read(p.radius), yaw: angle };
		}),
	line: (p, count, read) =>
		Array.from({ length: count }, (_, index) => {
			const offset = (index - (count - 1) / 2) * read(p.gap);
			return { index, column: index, row: 0, x: p.axis === 'x' ? offset : 0, y: p.axis === 'y' ? -offset : 0, z: p.axis === 'z' ? -offset : 0, yaw: 0 };
		}),
	scatter: (p, count, read) => {
		const random = seeded(p.seed);
		return Array.from({ length: count }, (_, index) => ({ index, column: index, row: 0, x: (random() - 0.5) * read(p.spread), y: (random() - 0.5) * read(p.spread), z: (random() - 0.5) * read(p.depth), yaw: 0 }));
	}
};

const WAVE: Record<Spec['animate'][number]['fn'], (angle: number) => number> = {
	sin: (angle) => Math.sin(angle),
	linear: (angle) => -angle / FULL_TURN,
	ease: (angle) => {
		const phase = (((-angle / FULL_TURN) % 1) + 1) % 1;
		return phase < 0.5 ? 4 * phase ** 3 : 1 - (-2 * phase + 2) ** 3 / 2;
	}
};

function offsets(spec: Spec, slot: Slot, t: number, read: Read): Record<Animated, number> {
	const out = Object.fromEntries(ANIMATED.map((p) => [p, 0])) as Record<Animated, number>;
	for (const a of spec.animate) {
		const angle = a.phase.column * slot.column + a.phase.row * slot.row + a.phase.index * slot.index - t * read(a.freq) * FULL_TURN;
		out[a.prop] += read(a.amp) * WAVE[a.fn](angle);
	}
	return out;
}

export function specTransforms(spec: Spec, count: number, raw: LayoutParams, t: number): Transform[] {
	if (count <= 0) {
		return [];
	}

	const read = reader(spec, raw);
	const base = read(spec.scale);
	const tilt = { x: read(spec.tilt.x ?? 0), y: read(spec.tilt.y ?? 0), z: read(spec.tilt.z ?? 0) };
	return PLACE[spec.place.kind](spec.place as never, count, read).map((slot) => {
		const o = offsets(spec, slot, t, read);
		const scale = base + o.scale;
		return {
			position: { x: slot.x + o.x, y: slot.y + o.y, z: slot.z + o.z },
			rotation: { x: tilt.x + o.rotX, y: tilt.y + slot.yaw + o.rotY, z: tilt.z + o.rotZ },
			scale: { x: scale, y: scale, z: scale },
			...(o.opacity ? { opacity: Math.min(1, Math.max(0, 1 + o.opacity)) } : {})
		};
	});
}

export function specDefinition(input: LayoutSpec): LayoutDefinition {
	const parsed = parseLayoutSpec(input);
	if (!parsed.ok) {
		throw new Error(parsed.problems.join('; '));
	}

	const spec = parsed.spec;
	const params: LayoutParam[] = spec.params;
	return {
		label: 'Custom',
		description: 'A layout written for this workspace.',
		motion: spec.motion,
		camera: spec.camera,
		cards: spec.cards,
		params,
		instances: (mediaCount, raw) => (mediaCount > 0 ? Math.max(mediaCount, Math.min(MAX_SPEC_SLOTS, Math.round(reader(spec, raw)(spec.slots)))) : 0),
		transforms: (count, raw, t) => specTransforms(spec, count, raw, t)
	};
}
