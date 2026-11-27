const FLOAT_PERIOD = 46;

export const float = (frame: number, phase: number, amplitude: number) => amplitude * Math.sin(((frame + phase) / FLOAT_PERIOD) * Math.PI * 2);

export const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const EXIT_FRAMES = 12;

export const exitProgress = (frame: number, duration: number) => Math.min(Math.max((frame - (duration - EXIT_FRAMES)) / EXIT_FRAMES, 0), 1) ** 2;
