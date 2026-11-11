import { readFileSync } from 'node:fs';

const US_PER_MS = 1000;

const WASM_PHASES = [
  { name: 'wasm plan / display list', match: /World>::(scene|screen|overlay)|Library>::plan|plan_at|overlay_at|groups::/ },
  { name: 'wasm raster / bake', match: /raster_batch|raster_rest|overlay_texture|Engine>::(draw|hold)|vello|scene::build_items|fill_coarse|fill_reserve|fill_canvas|warm_tiles/ },
  { name: 'wasm present / composite', match: /present_tiles|Reprojector|draw_tiles|Compositor>::frame|reproject/ },
  { name: 'wasm tiles bookkeeping', match: /tiles::|Tiles>::/ },
];
const LEAVES = [
  { name: 'wasm other', match: /gpu_core|wasm-function|\.wasm/ },
  { name: 'GC', match: /^\(garbage collector\)$/ },
  { name: 'native (browser, GPU calls, style)', match: /^\(program\)$/ },
  { name: 'idle', match: /^\(idle\)$/ }
];
const JS = 'main-thread JS / Svelte';

const label = (frame) => `${frame.functionName} ${frame.url}`;

export function buckets(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) {
    for (const c of n.children ?? []) {
      parent.set(c, n.id);
    }
  }
  const owner = (id) => {
    for (let at = id; at !== undefined; at = parent.get(at)) {
      const phase = WASM_PHASES.find((b) => b.match.test(label(byId.get(at).callFrame)));
      if (phase) {
        return phase.name;
      }
    }
    return LEAVES.find((b) => b.match.test(label(byId.get(id).callFrame)))?.name ?? JS;
  };
  const ms = {};
  profile.samples.forEach((id, i) => {
    const name = owner(id);
    ms[name] = (ms[name] ?? 0) + (profile.timeDeltas[i] ?? 0) / US_PER_MS;
  });
  return ms;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , file, frames = '1'] = process.argv;
  const ms = buckets(JSON.parse(readFileSync(file, 'utf8')));
  for (const [name, total] of Object.entries(ms).sort((a, b) => b[1] - a[1])) {
    console.log(`${(total / Number(frames)).toFixed(2).padStart(8)} ms/frame  ${Math.round(total).toString().padStart(6)} ms  ${name}`);
  }
}
