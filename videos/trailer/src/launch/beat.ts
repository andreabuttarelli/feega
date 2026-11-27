import { createContext, useContext } from "react";
import { FPS } from "../timing";

export type Music = { file: string | null; bpm: number; firstBeat: number; startFrom: number; volume: number; fadeOut: number; sfxDuck: number };

export const MUSIC: Music = {
  file: "classic-groove.mp3",
  bpm: 130,
  firstBeat: 0,
  startFrom: 2.72,
  volume: 0.8,
  fadeOut: 45,
  sfxDuck: 0.7,
};

const SUBDIVISION = 1;

const step = () => (FPS * 60) / MUSIC.bpm / SUBDIVISION;

export const onBeat = (frame: number) => {
  if (!MUSIC.file) {
    return frame;
  }

  return Math.round(MUSIC.firstBeat + Math.round((frame - MUSIC.firstBeat) / step()) * step());
};

export const sfxGain = () => (MUSIC.file ? MUSIC.sfxDuck : 1);

export const SceneOrigin = createContext(0);

export const useOnBeat = () => {
  const origin = useContext(SceneOrigin);

  return (local: number) => onBeat(origin + local) - origin;
};
