import type { FC } from "react";
import { AbsoluteFill, Audio, Series, interpolate, staticFile } from "remotion";
import { Sfx, Sound, type Cue } from "../components/Sfx";
import { FPS } from "../timing";
import { MUSIC, SceneOrigin, onBeat, sfxGain } from "./beat";
import { assembleTicks, boxPopAt } from "./Headline";
import { COLLAB_CUES, COLLAB_FRAMES, COLLAB_TONE, Collab } from "./scenes/Collab";
import { CODE_FRAMES, CODE_TONE, Code, DIFF_IN, DIFF_TICKS } from "./scenes/Code";
import { EDITORS_CUES, EDITORS_FRAMES, EDITORS_TONE, Editors } from "./scenes/Editors";
import { END_FRAMES, END_TONE, EndCard, LOGO_AT } from "./scenes/EndCard";
import { FRAMEWORKS_CUES, FRAMEWORKS_FRAMES, FRAMEWORKS_TONE, Frameworks } from "./scenes/Frameworks";
import { HERO_FRAMES, HERO_TONE, Hero } from "./scenes/Hero";
import { OPEN_SOURCE_FRAMES, OPEN_SOURCE_TONE, OpenSource, STAR_CLICK } from "./scenes/OpenSource";
import { PLUGINS_CUES, PLUGINS_FRAMES, PLUGINS_TONE, Plugins } from "./scenes/Plugins";
import { COLOUR_CLICK, SELECT_CLICK, SELECT_FRAMES, SELECT_TONE, SWATCH_CLICK, Select } from "./scenes/Select";
import { TEMPLATES_FRAMES, TEMPLATES_TONE, Templates } from "./scenes/Templates";
import { TONES, Tone, loadFonts } from "./style";
import { Exit, ExitWipe, LANDSCAPE_FRAMES, WIPE_FRAMES } from "./Transition";

type Shot = { scene: FC; frames: number; tone: Tone; exit: Exit; cues: Cue[] };

const pop = (at: number): Cue => ({ at, sound: Sound.Pop, volume: 0.55, beat: true });
const click = (at: number): Cue => ({ at, sound: Sound.ClickB, volume: 0.6 });
const whoosh = (at: number): Cue => ({ at, sound: Sound.Whoosh, volume: 0.35 });
const tap = (at: number): Cue => ({ at, sound: Sound.Tap, volume: 0.4 });
const tick = (at: number): Cue => ({ at, sound: Sound.Tap, volume: 0.12 });
const title = (): Cue[] => [...assembleTicks().map(tick), pop(boxPopAt())];

const SHOTS: Shot[] = [
  { scene: Hero, frames: HERO_FRAMES, tone: HERO_TONE, exit: Exit.Pixels, cues: [...title(), tap(16), tap(24)] },
  { scene: Select, frames: SELECT_FRAMES, tone: SELECT_TONE, exit: Exit.Panel, cues: [whoosh(4), ...title(), click(SELECT_CLICK), click(COLOUR_CLICK), click(SWATCH_CLICK)] },
  { scene: Code, frames: CODE_FRAMES, tone: CODE_TONE, exit: Exit.Cut, cues: [whoosh(0), whoosh(DIFF_IN), ...title(), ...DIFF_TICKS.map((at) => tap(at + 2))] },
  { scene: Templates, frames: TEMPLATES_FRAMES, tone: TEMPLATES_TONE, exit: Exit.Cut, cues: [whoosh(0), ...title()] },
  { scene: Collab, frames: COLLAB_FRAMES, tone: COLLAB_TONE, exit: Exit.Pixels, cues: COLLAB_CUES },
  { scene: Plugins, frames: PLUGINS_FRAMES, tone: PLUGINS_TONE, exit: Exit.Pixels, cues: PLUGINS_CUES },
  { scene: Editors, frames: EDITORS_FRAMES, tone: EDITORS_TONE, exit: Exit.Cut, cues: [whoosh(6), ...EDITORS_CUES] },
  { scene: Frameworks, frames: FRAMEWORKS_FRAMES, tone: FRAMEWORKS_TONE, exit: Exit.Panel, cues: [...FRAMEWORKS_CUES, whoosh(FRAMEWORKS_FRAMES - 22)] },
  { scene: OpenSource, frames: OPEN_SOURCE_FRAMES, tone: OPEN_SOURCE_TONE, exit: Exit.Panel, cues: [...title(), whoosh(22), click(STAR_CLICK)] },
  { scene: EndCard, frames: END_FRAMES, tone: END_TONE, exit: Exit.Cut, cues: [{ at: LOGO_AT, sound: Sound.Chime, volume: 0.5 }] },
];

const RAW_TOTAL = SHOTS.reduce((sum, shot) => sum + shot.frames, 0);

const rawStarts = SHOTS.map((_, i) => SHOTS.slice(0, i).reduce((sum, shot) => sum + shot.frames, 0));

const starts = rawStarts.map((at, i) => (i === 0 ? 0 : onBeat(at)));

export const LAUNCH_FRAMES = onBeat(RAW_TOTAL);

const lengths = starts.map((at, i) => (i + 1 < starts.length ? starts[i + 1] : LAUNCH_FRAMES) - at);

const exitCue = (shot: Shot, frames: number): Cue[] => {
  if (shot.exit === Exit.Cut) {
    return [{ at: frames, sound: Sound.ClickC, volume: 0.5 }];
  }

  return [whoosh(frames - (shot.exit === Exit.Landscape ? LANDSCAPE_FRAMES : WIPE_FRAMES))];
};

const place = (cue: Cue, origin: number) => (cue.beat ? onBeat(cue.at + origin) : cue.at + origin);

const CUES = SHOTS.flatMap((shot, i) => [...shot.cues, ...exitCue(shot, lengths[i])].map((cue) => ({ ...cue, at: place(cue, starts[i]) }))).filter((cue) => cue.at < LAUNCH_FRAMES);

const musicVolume = (frame: number) => MUSIC.volume * interpolate(frame, [LAUNCH_FRAMES - MUSIC.fadeOut, LAUNCH_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const Music = () => (MUSIC.file ? <Audio src={staticFile(`music/${MUSIC.file}`)} startFrom={Math.round(MUSIC.startFrom * FPS)} volume={musicVolume} /> : null);

const nextColor = (i: number) => TONES[SHOTS[Math.min(i + 1, SHOTS.length - 1)].tone].bg;

export const Launch = () => {
  loadFonts();

  return (
    <AbsoluteFill>
      <Series>
        {SHOTS.map(({ scene: Scene, exit }, i) => (
          <Series.Sequence key={i} durationInFrames={lengths[i]}>
            <SceneOrigin.Provider value={starts[i]}>
              <Scene />
              <ExitWipe exit={exit} color={nextColor(i)} />
            </SceneOrigin.Provider>
          </Series.Sequence>
        ))}
      </Series>
      <Sfx cues={CUES} gain={sfxGain()} />
      <Music />
    </AbsoluteFill>
  );
};
