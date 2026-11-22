import type { FC } from "react";
import { AbsoluteFill, Series } from "remotion";
import { Sfx, Sound, type Cue } from "../components/Sfx";
import { boxPopAt } from "./Headline";
import { CODE_FRAMES, Code, DIFF_LINES_AT } from "./scenes/Code";
import { EDIT_FRAMES, COLOR_CLICK, Edit, SCRUB_FROM, SWATCH_CLICK } from "./scenes/Edit";
import { CONNECT_FROM, CONNECT_STEP, EDITORS_FRAMES, Editors } from "./scenes/Editors";
import { END_FRAMES, EndCard, LOGO_AT } from "./scenes/EndCard";
import { FRAMEWORKS_BOX, FRAMEWORKS_FRAMES, Frameworks, LOGOS_FROM, LOGO_STEP } from "./scenes/Frameworks";
import { HERO_FRAMES, HERO_LINES, Hero } from "./scenes/Hero";
import { OPEN_LINES, OPEN_SOURCE_FRAMES, OpenSource, STAR_CLICK } from "./scenes/OpenSource";
import { DRAG_FROM, PLUGINS_FRAMES, Plugins } from "./scenes/Plugins";
import { SELECT_CLICK, SELECT_FRAMES, Select } from "./scenes/Select";
import { LIBRARY_CLICK, TEMPLATES_FRAMES, Templates } from "./scenes/Templates";
import { loadFonts } from "./style";

type Shot = { scene: FC; frames: number; cues: Cue[] };

const pop = (at: number): Cue => ({ at, sound: Sound.Pop, volume: 0.55 });
const click = (at: number): Cue => ({ at, sound: Sound.ClickB, volume: 0.6 });
const whoosh = (at: number): Cue => ({ at, sound: Sound.Whoosh, volume: 0.35 });
const tap = (at: number): Cue => ({ at, sound: Sound.Tap, volume: 0.4 });

const SHOTS: Shot[] = [
  { scene: Hero, frames: HERO_FRAMES, cues: [pop(boxPopAt(HERO_LINES)), tap(16), tap(24)] },
  { scene: Select, frames: SELECT_FRAMES, cues: [whoosh(2), pop(boxPopAt(["click any", "element of your", "running app."])), click(SELECT_CLICK)] },
  { scene: Edit, frames: EDIT_FRAMES, cues: [pop(boxPopAt(["edit it", "like in figma."])), click(SCRUB_FROM), click(SWATCH_CLICK), click(COLOR_CLICK)] },
  { scene: Code, frames: CODE_FRAMES, cues: [whoosh(4), pop(boxPopAt(["every edit", "lands in", "your code."])), tap(DIFF_LINES_AT + 5), tap(DIFF_LINES_AT + 10)] },
  { scene: Templates, frames: TEMPLATES_FRAMES, cues: [whoosh(0), pop(boxPopAt(["61 free templates."])), whoosh(78), click(LIBRARY_CLICK)] },
  { scene: Plugins, frames: PLUGINS_FRAMES, cues: [whoosh(4), pop(boxPopAt(["plugins, if you", "want more."])), click(DRAG_FROM)] },
  { scene: Editors, frames: EDITORS_FRAMES, cues: [pop(boxPopAt(["works where you", "already code."])), ...[0, 1, 2, 3, 4].map((i) => tap(CONNECT_FROM + i * CONNECT_STEP))] },
  { scene: Frameworks, frames: FRAMEWORKS_FRAMES, cues: [pop(FRAMEWORKS_BOX), ...[0, 2, 4, 6].map((i) => tap(LOGOS_FROM + i * LOGO_STEP))] },
  { scene: OpenSource, frames: OPEN_SOURCE_FRAMES, cues: [pop(boxPopAt(OPEN_LINES)), whoosh(22), click(STAR_CLICK)] },
  { scene: EndCard, frames: END_FRAMES, cues: [{ at: LOGO_AT, sound: Sound.Chime, volume: 0.5 }] },
];

const starts = SHOTS.reduce<number[]>((acc, shot, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SHOTS[i - 1].frames], []);

export const LAUNCH_FRAMES = SHOTS.reduce((sum, shot) => sum + shot.frames, 0);

const CUES = SHOTS.flatMap((shot, i) => shot.cues.map((cue) => ({ ...cue, at: cue.at + starts[i] })));

export const Launch = () => {
  loadFonts();

  return (
    <AbsoluteFill>
      <Series>
        {SHOTS.map(({ scene: Scene, frames }, i) => (
          <Series.Sequence key={i} durationInFrames={frames}>
            <Scene />
          </Series.Sequence>
        ))}
      </Series>
      <Sfx cues={CUES} />
    </AbsoluteFill>
  );
};
