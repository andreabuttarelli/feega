import type { MotionClip, MotionDoc } from '../doc';
import { interactiveOf, isInteractive, PlayMode } from '../interactive/settings';
import type { Keyframe, KeyValue } from '../keyframes';
import type { Size } from '../parent';
import { TriggerKind } from '../prototype/model';
import { easeBetween, LINEAR, round } from './ease';
import { Channel, Trigger, type AnimTrack, type Animation } from './ir';

export type Timeline = { fps: number; start: number; length: number; loop: boolean; trigger: Trigger };

const CHANNELS: Record<Channel, { key: string; value: (v: KeyValue, space: Size) => number | string }> = {
  [Channel.X]: { key: 'x', value: (v, s) => round(Number(v) * s.width) },
  [Channel.Y]: { key: 'y', value: (v, s) => round(Number(v) * s.height) },
  [Channel.Scale]: { key: 'scale', value: (v) => round(Number(v)) },
  [Channel.Rotate]: { key: 'rotateZ', value: (v) => round(Number(v)) },
  [Channel.Opacity]: { key: 'opacity', value: (v) => round(Number(v)) },
  [Channel.Colour]: { key: 'color', value: (v) => String(v) }
};

const BY_KEY = new Map(Object.values(Channel).map((c) => [CHANNELS[c].key, c]));

const PLAYBACK: Record<PlayMode, { trigger: Trigger; note?: string }> = {
  [PlayMode.Autoplay]: { trigger: Trigger.Load },
  [PlayMode.InView]: { trigger: Trigger.InView },
  [PlayMode.Scrub]: { trigger: Trigger.Load, note: 'Scroll-scrubbed playback is not exported; the animations play on load.' },
  [PlayMode.Paused]: { trigger: Trigger.Load, note: 'Paused playback is not exported; the animations play on load.' }
};

export function timelineOf(doc: MotionDoc, notes: Set<string>): Timeline {
  const start = doc.workArea?.from ?? 0;
  const end = doc.workArea?.to ?? doc.durationInFrames;
  const interactive = isInteractive(doc) ? interactiveOf(doc) : null;
  const playback = PLAYBACK[interactive?.playback ?? PlayMode.Autoplay];
  if (playback.note && hasKeys(doc)) {
    notes.add(playback.note);
  }
  return { fps: doc.fps, start, length: end - start, loop: Boolean(interactive?.loop), trigger: playback.trigger };
}

const hasKeys = (doc: MotionDoc) => [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].some((t) => t.clips.some((c) => Object.keys(c.keyframes).length));

const hovered = (clip: MotionClip) => (clip.interactions ?? []).some((i) => i.trigger.kind === TriggerKind.Hover);

const ordered = (keys: Keyframe[]) => [...keys].sort((a, b) => a.frame - b.frame);

function trackOf(channel: Channel, keys: Keyframe[], clip: MotionClip, at: { timeline: Timeline; space: Size; hover: boolean }): AnimTrack {
  const { timeline, space, hover } = at;
  const values = keys.map((k) => CHANNELS[channel].value(k.value, space));
  const eases = keys.slice(1).map((k, i) => easeBetween(keys[i], k));
  const first = keys[0].frame;
  const last = keys[keys.length - 1].frame;
  if (hover || !timeline.loop) {
    const span = last - first;
    const delay = hover ? 0 : Math.max(0, clip.from + first - timeline.start) / timeline.fps;
    return { channel, values, times: keys.map((k) => (k.frame - first) / span), eases, duration: round(span / timeline.fps), delay: round(delay), loop: false };
  }
  const local = keys.map((k) => Math.min(1, Math.max(0, (clip.from + k.frame - timeline.start) / timeline.length)));
  const lead = local[0] > 0;
  const tail = local[local.length - 1] < 1;
  return {
    channel,
    values: [...(lead ? [values[0]] : []), ...values, ...(tail ? [values[values.length - 1]] : [])],
    times: [...(lead ? [0] : []), ...local, ...(tail ? [1] : [])],
    eases: [...(lead ? [LINEAR] : []), ...eases, ...(tail ? [LINEAR] : [])],
    duration: round(timeline.length / timeline.fps),
    delay: 0,
    loop: true
  };
}

export function animationOf(clip: MotionClip, at: { timeline: Timeline; space: Size; notes: Set<string>; label: string }): Animation | undefined {
  const hover = hovered(clip);
  const tracks: AnimTrack[] = [];
  for (const [key, raw] of Object.entries(clip.keyframes)) {
    const keys = ordered(raw);
    const channel = BY_KEY.get(key);
    if (!channel) {
      at.notes.add(`${at.label}: the ${key} animation has no CSS equivalent and was left out.`);
      continue;
    }
    if (keys.length < 2 || keys[keys.length - 1].frame === keys[0].frame) {
      continue;
    }
    tracks.push(trackOf(channel, keys, clip, { ...at, hover }));
  }
  if (!tracks.length) {
    return undefined;
  }
  return { trigger: hover ? Trigger.Hover : at.timeline.trigger, tracks: tracks.sort((a, b) => a.channel.localeCompare(b.channel)) };
}
