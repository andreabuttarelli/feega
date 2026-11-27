import { inside } from "../src/launch/editor/layout";
import { pointerAt, type Click } from "../src/launch/Pointer";
import { COLLAB_CLICKS, COLLAB_TALL_CLICKS } from "../src/launch/scenes/Collab";
import { OPEN_CLICKS, OPEN_TALL_CLICKS } from "../src/launch/scenes/OpenSource";
import { PLUGINS_CLICKS, PLUGINS_TALL_CLICKS, PLUGINS_TALL_VIEW } from "../src/launch/scenes/Plugins";
import { SELECT_CLICKS, SELECT_TALL_CLICKS } from "../src/launch/scenes/Select";
import { SAFE, readable, type TallClick } from "../src/launch/stage";

const SCENES: Record<string, Click[]> = {
  select: SELECT_CLICKS,
  plugins: PLUGINS_CLICKS,
  collab: COLLAB_CLICKS,
  "open source": OPEN_CLICKS,
  "plugins vertical": PLUGINS_TALL_CLICKS,
};

const TALL_SCENES: Record<string, TallClick[]> = {
  select: SELECT_TALL_CLICKS,
  collab: COLLAB_TALL_CLICKS,
  "open source": OPEN_TALL_CLICKS,
  plugins: PLUGINS_TALL_CLICKS.map((c) => ({ label: c.label, at: c.at, target: c.rect, view: PLUGINS_TALL_VIEW })),
};

const misses = Object.entries(SCENES).flatMap(([scene, clicks]) =>
  clicks.map((click) => {
    const tip = pointerAt(click.at, click.path);
    const hit = inside(tip, click.rect);
    console.log(`${hit ? "ok  " : "MISS"} ${scene} · ${click.label} @${click.at} tip ${tip.x.toFixed(1)},${tip.y.toFixed(1)} rect ${click.rect.x.toFixed(1)},${click.rect.y.toFixed(1)} ${click.rect.w.toFixed(1)}×${click.rect.h.toFixed(1)}`);
    return hit ? 0 : 1;
  }),
);

const hidden = Object.entries(TALL_SCENES).flatMap(([scene, clicks]) =>
  clicks.map((click) => {
    const seen = readable(click);
    console.log(`${seen ? "ok  " : "HIDE"} vertical ${scene} · ${click.label} @${click.at} target ${click.target.x.toFixed(1)},${click.target.y.toFixed(1)} ${click.target.w.toFixed(1)}×${click.target.h.toFixed(1)} safe y ${SAFE.y}-${SAFE.y + SAFE.h}`);
    return seen ? 0 : 1;
  }),
);

process.exit([...misses, ...hidden].some(Boolean) ? 1 : 0);
