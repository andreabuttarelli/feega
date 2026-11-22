import { inside } from "../src/launch/editor/layout";
import { pointerAt, type Click } from "../src/launch/Pointer";
import { AGENTS_CLICKS } from "../src/launch/scenes/Agents";
import { EDIT_CLICKS } from "../src/launch/scenes/Edit";
import { OPEN_CLICKS } from "../src/launch/scenes/OpenSource";
import { PLUGINS_CLICKS } from "../src/launch/scenes/Plugins";
import { SELECT_CLICKS } from "../src/launch/scenes/Select";
import { TEMPLATES_CLICKS } from "../src/launch/scenes/Templates";

const SCENES: Record<string, Click[]> = {
  select: SELECT_CLICKS,
  edit: EDIT_CLICKS,
  templates: TEMPLATES_CLICKS,
  plugins: PLUGINS_CLICKS,
  agents: AGENTS_CLICKS,
  "open source": OPEN_CLICKS,
};

const misses = Object.entries(SCENES).flatMap(([scene, clicks]) =>
  clicks.map((click) => {
    const tip = pointerAt(click.at, click.path);
    const hit = inside(tip, click.rect);
    console.log(`${hit ? "ok  " : "MISS"} ${scene} · ${click.label} @${click.at} tip ${tip.x.toFixed(1)},${tip.y.toFixed(1)} rect ${click.rect.x.toFixed(1)},${click.rect.y.toFixed(1)} ${click.rect.w.toFixed(1)}×${click.rect.h.toFixed(1)}`);
    return hit ? 0 : 1;
  }),
);

process.exit(misses.some(Boolean) ? 1 : 0);
