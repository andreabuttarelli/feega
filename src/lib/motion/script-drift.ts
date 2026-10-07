import type { MotionDoc } from './doc';
import { Act, type LaunchScript } from './script';
import { storyLabel, StoryBeat } from './story';
import { UI_KIT } from './ui-kit/kit';
import { contentParams, kitKind } from './ui-kit/content';
import { defaultsOf } from './ui-kit/anchors';
import { nestedComp } from './nested';

export type DriftProblem = { frame: number; detail: string };

type Clip = MotionDoc['tracks'][number]['clips'][number];

type Shown = { from: number; to: number; text: string; logo: boolean };

type Window = { act: Act; from: number; to: number; marked: boolean };

const LOGOS: ReadonlySet<string> = new Set(['Logo']);

const BEAT_OF: Record<Act, StoryBeat> = {
  [Act.Problem]: StoryBeat.Problem,
  [Act.Solution]: StoryBeat.Solution,
  [Act.Proof]: StoryBeat.Proof,
  [Act.Claim]: StoryBeat.Claim
};

const normal = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const wordsOf = (text: string) => normal(text).split(' ').filter(Boolean);

function kitText(clip: Clip): string {
  const kind = kitKind(String(clip.props.name ?? ''));
  if (!kind) {
    return '';
  }
  const piece = UI_KIT[kind];
  const values = { ...defaultsOf(piece), ...clip.props };
  return contentParams(piece)
    .map((key) => String(values[key] ?? '').replace(/[|\n]/g, ' '))
    .join(' ');
}

const TEXT_OF: Partial<Record<string, (clip: Clip) => string>> = {
  Title: (c) => String(c.props.text ?? ''),
  Text: (c) => String(c.props.text ?? ''),
  Kicker: (c) => String(c.props.text ?? ''),
  Caption: (c) => String(c.props.text ?? ''),
  Custom: kitText
};

function shown(doc: MotionDoc, tracks: MotionDoc['tracks'], offset: number, end: number, seen: ReadonlySet<string>): Shown[] {
  return tracks
    .flatMap((t) => t.clips as Clip[])
    .flatMap((clip) => {
      const from = offset + clip.from;
      const to = Math.min(end, from + clip.durationInFrames);
      if (to <= from) {
        return [];
      }
      const comp = nestedComp(clip) ?? '';
      if (doc.comps[comp] && !seen.has(comp)) {
        return shown(doc, doc.comps[comp].tracks, from, to, new Set([...seen, comp]));
      }
      return [{ from, to, text: TEXT_OF[clip.component]?.(clip) ?? '', logo: LOGOS.has(clip.component) }];
    });
}

function windows(doc: MotionDoc, script: LaunchScript): Window[] {
  const marks = new Map((doc.markers ?? []).map((m) => [m.label.toLowerCase(), m.frame]));
  const starts = script.acts.map((a) => {
    const label = storyLabel(BEAT_OF[a.act]);
    return { act: a.act, marked: marks.has(label), from: marks.get(label) ?? Math.round(a.start * doc.fps), planned: Math.round(a.end * doc.fps) };
  });
  const sorted = [...starts].sort((a, b) => a.from - b.from);
  return starts.map((s) => {
    const next = sorted.find((o) => o.from > s.from);
    return { act: s.act, marked: s.marked, from: s.from, to: s.marked ? (next?.from ?? doc.durationInFrames) : s.planned };
  });
}

function shownPrefix(needle: string[], hay: string[]): number {
  let n = 0;
  for (const word of hay) {
    if (n < needle.length && word === needle[n]) {
      n++;
    }
  }
  return n;
}

function lineProblem(line: string, window: Window, hay: string[], doc: MotionDoc): DriftProblem[] {
  const needle = wordsOf(line);
  const run = shownPrefix(needle, hay);
  if (!needle.length || run === needle.length) {
    return [];
  }
  const at = Math.round((window.from / doc.fps) * 100) / 100;
  if (run === 0) {
    return [{ frame: window.from, detail: `the ${window.act} act (from ${at}s) never shows its line "${line}": put it on screen, word for word, long enough to read` }];
  }
  return [{ frame: window.from, detail: `the ${window.act} act (from ${at}s) shows "${line}" cut short: only the first ${run} of ${needle.length} words are on screen. Show the whole line` }];
}

export function scriptDrift(doc: MotionDoc): DriftProblem[] {
  const script = doc.script;
  if (!script) {
    return [];
  }
  const clips = shown(doc, doc.tracks, 0, Number.POSITIVE_INFINITY, new Set());
  return windows(doc, script).flatMap((window) => {
    const act = script.acts.find((a) => a.act === window.act)!;
    const inside = clips.filter((c) => c.from < window.to && c.to > window.from).sort((a, b) => a.from - b.from);
    const hay = inside.flatMap((c) => wordsOf(c.text));
    const unmarked = window.marked ? [] : [{ frame: window.from, detail: `the ${window.act} act is not in the video: mark where it starts with mark_story and build its scene (${act.scene})` }];
    const lines = window.act === Act.Claim ? [...new Set([...act.on_screen, script.research.promise.text])] : act.on_screen;
    const logo = window.act === Act.Claim && !inside.some((c) => c.logo) ? [{ frame: window.from, detail: 'the claim has no logo: close on the original logo, flat and intact, with the promise and the address' }] : [];
    return [...unmarked, ...lines.flatMap((line) => lineProblem(line, window, hay, doc)), ...logo];
  });
}
