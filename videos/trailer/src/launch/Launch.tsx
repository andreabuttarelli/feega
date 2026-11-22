import type { FC } from "react";
import { AbsoluteFill, Series } from "remotion";
import { Sfx, Sound, type Cue } from "../components/Sfx";
import { boxPopAt } from "./Headline";
import { AGENTS_CUES, AGENTS_FRAMES, AGENTS_LINES, AGENTS_TONE, Agents } from "./scenes/Agents";
import { CODE_FRAMES, CODE_TONE, Code, DIFF_LINES_AT, PUSH_AT } from "./scenes/Code";
import { EDIT_FRAMES, EDIT_TONE, COLOR_CLICK, Edit, SCRUB_FROM, SWATCH_CLICK } from "./scenes/Edit";
import { EDITORS_CUES, EDITORS_FRAMES, EDITORS_TONE, Editors } from "./scenes/Editors";
import { END_FRAMES, END_TONE, EndCard, LOGO_AT } from "./scenes/EndCard";
import { FRAMEWORKS_CUES, FRAMEWORKS_FRAMES, FRAMEWORKS_TONE, Frameworks } from "./scenes/Frameworks";
import { HERO_FRAMES, HERO_LINES, HERO_TONE, Hero } from "./scenes/Hero";
import { OPEN_LINES, OPEN_SOURCE_FRAMES, OPEN_SOURCE_TONE, OpenSource, STAR_CLICK } from "./scenes/OpenSource";
import { DRAG_FROM, PLUGINS_FRAMES, PLUGINS_TONE, Plugins } from "./scenes/Plugins";
import { SELECT_CLICK, SELECT_FRAMES, SELECT_TONE, Select } from "./scenes/Select";
import { LIBRARY_CLICK, LIBRARY_IN, TEMPLATES_FRAMES, TEMPLATES_TONE, Templates } from "./scenes/Templates";
import { TONES, Tone, loadFonts } from "./style";
import { Exit, ExitWipe, LANDSCAPE_FRAMES, WIPE_FRAMES } from "./Transition";

type Shot = { scene: FC; frames: number; tone: Tone; exit: Exit; cues: Cue[] };

const pop = (at: number): Cue => ({ at, sound: Sound.Pop, volume: 0.55 });
const click = (at: number): Cue => ({ at, sound: Sound.ClickB, volume: 0.6 });
const whoosh = (at: number): Cue => ({ at, sound: Sound.Whoosh, volume: 0.35 });
const tap = (at: number): Cue => ({ at, sound: Sound.Tap, volume: 0.4 });

const SHOTS: Shot[] = [
  { scene: Hero, frames: HERO_FRAMES, tone: HERO_TONE, exit: Exit.Pixels, cues: [pop(boxPopAt(HERO_LINES)), tap(16), tap(24)] },
  { scene: Select, frames: SELECT_FRAMES, tone: SELECT_TONE, exit: Exit.Panel, cues: [whoosh(4), pop(boxPopAt(["click any", "element of your", "running app."])), click(SELECT_CLICK)] },
  { scene: Edit, frames: EDIT_FRAMES, tone: EDIT_TONE, exit: Exit.Pixels, cues: [whoosh(0), pop(boxPopAt(["edit it", "like in Figma."])), click(SCRUB_FROM), click(SWATCH_CLICK), click(COLOR_CLICK)] },
  { scene: Code, frames: CODE_FRAMES, tone: CODE_TONE, exit: Exit.Cut, cues: [whoosh(4), pop(boxPopAt(["every edit", "lands in", "your code."])), tap(DIFF_LINES_AT + 5), tap(DIFF_LINES_AT + 10), tap(PUSH_AT + 8)] },
  { scene: Templates, frames: TEMPLATES_FRAMES, tone: TEMPLATES_TONE, exit: Exit.Landscape, cues: [whoosh(0), pop(boxPopAt(["61 free templates."])), whoosh(LIBRARY_IN), click(LIBRARY_CLICK)] },
  { scene: Plugins, frames: PLUGINS_FRAMES, tone: PLUGINS_TONE, exit: Exit.Pixels, cues: [whoosh(4), pop(boxPopAt(["plugins, if you", "want more."])), click(DRAG_FROM)] },
  { scene: Editors, frames: EDITORS_FRAMES, tone: EDITORS_TONE, exit: Exit.Cut, cues: [whoosh(6), ...EDITORS_CUES] },
  { scene: Frameworks, frames: FRAMEWORKS_FRAMES, tone: FRAMEWORKS_TONE, exit: Exit.Panel, cues: [...FRAMEWORKS_CUES, whoosh(FRAMEWORKS_FRAMES - 22)] },
  { scene: Agents, frames: AGENTS_FRAMES, tone: AGENTS_TONE, exit: Exit.Pixels, cues: [pop(boxPopAt(AGENTS_LINES)), ...AGENTS_CUES] },
  { scene: OpenSource, frames: OPEN_SOURCE_FRAMES, tone: OPEN_SOURCE_TONE, exit: Exit.Panel, cues: [pop(boxPopAt(OPEN_LINES)), whoosh(22), click(STAR_CLICK)] },
  { scene: EndCard, frames: END_FRAMES, tone: END_TONE, exit: Exit.Cut, cues: [{ at: LOGO_AT, sound: Sound.Chime, volume: 0.5 }] },
];

const starts = SHOTS.reduce<number[]>((acc, shot, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SHOTS[i - 1].frames], []);

export const LAUNCH_FRAMES = SHOTS.reduce((sum, shot) => sum + shot.frames, 0);

const exitCue = (shot: Shot): Cue[] => {
  if (shot.exit === Exit.Cut) {
    return [{ at: shot.frames, sound: Sound.ClickC, volume: 0.5 }];
  }

  return [whoosh(shot.frames - (shot.exit === Exit.Landscape ? LANDSCAPE_FRAMES : WIPE_FRAMES))];
};

const CUES = SHOTS.flatMap((shot, i) => [...shot.cues, ...exitCue(shot)].map((cue) => ({ ...cue, at: cue.at + starts[i] }))).filter((cue) => cue.at < LAUNCH_FRAMES);

const nextColor = (i: number) => TONES[SHOTS[Math.min(i + 1, SHOTS.length - 1)].tone].bg;

export const Launch = () => {
  loadFonts();

  return (
    <AbsoluteFill>
      <Series>
        {SHOTS.map(({ scene: Scene, frames, exit }, i) => (
          <Series.Sequence key={i} durationInFrames={frames}>
            <Scene />
            <ExitWipe exit={exit} color={nextColor(i)} />
          </Series.Sequence>
        ))}
      </Series>
      <Sfx cues={CUES} />
    </AbsoluteFill>
  );
};
