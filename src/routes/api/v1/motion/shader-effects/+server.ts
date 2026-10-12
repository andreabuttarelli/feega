import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { SHADER_EFFECTS, SHADER_EFFECT_IDS, ShaderPlay } from '$lib/motion/shader-effects/catalogue';
import type { RequestHandler } from './$types';

const listing = () =>
  SHADER_EFFECT_IDS.map((id) => {
    const spec = SHADER_EFFECTS[id];
    const knobs = Object.fromEntries(Object.entries(spec.numbers).map(([key, n]) => [key, { label: n.label, min: n.min, max: n.max, default: n.fallback, keyframes: key !== spec.speed }]));
    return { id, category: spec.category, source: spec.source, live: spec.play === ShaderPlay.Live, about: spec.about, knobs, colours: spec.colours };
  });

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  return json({ effects: listing() });
};
