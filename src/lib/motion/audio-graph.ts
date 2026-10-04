import { gainAt, type AudioEntry, type GainPoint } from './audio-plan';

export type Clock = { origin: number; from: number };

const STEREO = 2;

function automate(param: AudioParam, points: GainPoint[], start: number, clock: Clock) {
  const at = (time: number) => clock.origin + time - clock.from;
  param.setValueAtTime(gainAt(points, start), at(start));
  for (const point of points.filter((p) => p.time > start)) {
    param.linearRampToValueAtTime(point.value, at(point.time));
  }
}

export function scheduleEntry(context: BaseAudioContext, buffer: AudioBuffer, entry: AudioEntry, clock: Clock, destination: AudioNode): AudioBufferSourceNode | null {
  const end = entry.at + entry.duration;
  const start = Math.max(entry.at, clock.from);
  if (start >= end) {
    return null;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  const upmix = context.createGain();
  upmix.channelCount = STEREO;
  upmix.channelCountMode = 'explicit';
  upmix.channelInterpretation = 'speakers';
  const split = context.createChannelSplitter(STEREO);
  const left = context.createGain();
  const right = context.createGain();
  const merge = context.createChannelMerger(STEREO);

  source.connect(upmix).connect(split);
  split.connect(left, 0);
  split.connect(right, 1);
  left.connect(merge, 0, 0);
  right.connect(merge, 0, 1);
  merge.connect(destination);

  automate(left.gain, entry.left, start, clock);
  automate(right.gain, entry.right, start, clock);
  source.start(clock.origin + start - clock.from, entry.offset + start - entry.at, end - start);
  return source;
}
