import { Audio, Sequence, staticFile } from "remotion";

export enum Sound {
  ClickA = "click-a",
  ClickB = "click-b",
  ClickC = "click-c",
  Enter = "enter",
  Whoosh = "whoosh",
  Backspace = "backspace",
  Chime = "chime",
  Pop = "pop",
  Tap = "tap",
  Power = "power",
  Mouse = "mouse",
  Clatter = "clatter",
}

export type Cue = { at: number; sound: Sound; volume: number; beat?: boolean };

const CLICKS = [Sound.ClickA, Sound.ClickB, Sound.ClickC];
const CUE_LENGTH = 30;

export const keyClick = (at: number, index: number): Cue => ({ at, sound: CLICKS[index % CLICKS.length], volume: 0.35 });

export const Sfx = ({ cues, gain = 1 }: { cues: Cue[]; gain?: number }) => (
  <>
    {cues.map((cue, i) => (
      <Sequence key={i} from={Math.round(cue.at)} durationInFrames={CUE_LENGTH} layout="none">
        <Audio src={staticFile(`sfx/${cue.sound}.wav`)} volume={cue.volume * gain} />
      </Sequence>
    ))}
  </>
);
