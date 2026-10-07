import { INPUT_GUIDE } from './inputs';

export const EXPRESSION_GUIDE = [
  'A safe JavaScript subset: numbers, + - * / % **, comparisons, && || !, a ? b : c, const/let lines, [lists]; no loops, functions or globals.',
  'Names: time (seconds from the clip start), frame, value (keyframed value now), index (layer number, 1 = top), thisLayer.<prop>, layer("id" or name or index).<prop> (another clip at the same frame, read-only; loops are refused).',
  'Functions: wiggle(freq, amp, octaves?, seed?), loopOut(type?) / loopIn(type?) with cycle|pingpong|offset|continue, linear/ease/easeIn/easeOut(t, tMin, tMax, v1, v2) or (t, v1, v2), clamp(v, min, max), random(seed, min?, max?), degreesToRadians, radiansToDegrees, Math.sin/cos/abs/min/max/floor/round/sqrt/pow/atan2/PI.',
  'Audio: audio.amp(ref?, smoothing?) is the loudness 0..1 of the music now (ref: an audio clip id, its index among audio clips, or a track id; none = the loudest audio playing), averaged over smoothing frames; audio.beat(ref?) is 1 on a beat falling to 0 by mid-beat; audio.onset(ref?) is 1 on each hit falling to 0 in 0.25 s; with no ref both follow the music bed (the longest audio clip with a tempo). They read the stored analysis, so they are deterministic.',
  INPUT_GUIDE,
  'Everything is deterministic: the same frame always gives the same number, and results are clamped into the property range.'
].join(' ');

export const EXPRESSION_EXAMPLES = [
  'Examples — camera shake: set_expression camera true, prop rotateZ, "wiggle(6, 1.5)" and x "wiggle(4, 0.01)";',
  'continuous rotation: prop rotateZ, "time * 90" (90°/s);',
  'follow another layer: prop x, \'layer("logo").x + 0.1\';',
  'loop keyframes: "loopOut(\\"pingpong\\")";',
  'pulse: prop scale, "value + Math.sin(time * 6) * 0.05".',
  'Prefer keyframes for a single move; use an expression for continuous, procedural or linked motion.'
].join(' ');
