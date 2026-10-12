import { describe, expect, it } from 'vitest';
import { frameDiffs, motionJolts } from '$lib/motion/smoothness';
import { PROMPT_MODEL } from './model';

type Plan = { keys: { at: number; shown: string }[]; typeStart: number; typeEnd: number; pressAt: number; submitAt: number; returnAt: number; k: number };
type Frame = Record<string, number | string> & { shown: string };
type Model = { promptPlan: (p: object, length: number) => Plan; promptFrame: (plan: Plan, t: number) => Frame };

const model = new Function(`${PROMPT_MODEL}; return { promptPlan, promptFrame };`)() as Model;

const PARAMS = { text: 'Make a launch video for our new app, with music.', startDelay: 0.8, speed: 15, typo: true, typoAt: 0.4, repeat: true, submit: 'thinking' };
const LENGTH = 9;
const FPS = 30;

const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;

function pixels(frame: Frame, [width, height]: readonly [number, number]): number[] {
  const em = 0.032 * Math.min(width, height);
  const box = Math.min(24 * em, 0.92 * width);
  const button = 2.2 * em;
  const n = (key: string) => Number(frame[key]);
  const typed = frame.shown.length / PARAMS.text.length;
  return [
    n('closeUp') * 1.5 * box,
    n('toButton') * n('closeUp') * 0.8 * box,
    typed * n('textOpacity') * n('textLift') * 0.7 * em,
    typed * n('textOpacity') * 40,
    n('placeholder') * 40,
    n('thinking') * 40,
    n('stop') * 30,
    n('armed') * 60,
    n('press') * 0.09 * button,
    n('focus') * 30,
    n('cursor') * 50,
    n('cursor') * n('cursorX') * button,
    n('cursor') * n('cursorY') * button,
    n('caret') * 2
  ];
}

const frames = (params: object, length = LENGTH) => {
  const plan = model.promptPlan(params, length);
  return Array.from({ length: Math.round(length * FPS) + 1 }, (_, i) => model.promptFrame(plan, i / FPS));
};

describe('the prompt input model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const plan = model.promptPlan(PARAMS, LENGTH);
    const forward = [0.5, 2, 4.1, 6.3, 8].map((t) => model.promptFrame(plan, t));
    const scrambled = [8, 0.5, 6.3, 2, 4.1].map((t) => model.promptFrame(plan, t));

    expect(scrambled.sort((a, b) => String(a.shown).length - String(b.shown).length)).toEqual(expect.arrayContaining(forward));
  });

  it('types the whole text, then clears it on submit', () => {
    const plan = model.promptPlan(PARAMS, LENGTH);

    expect(model.promptFrame(plan, plan.typeEnd + 0.01).shown).toBe(PARAMS.text);
    expect(model.promptFrame(plan, plan.submitAt + 1).shown).toBe('');
  });

  it('makes a typo and fixes it, so the finished text is still exact', () => {
    const plan = model.promptPlan(PARAMS, LENGTH);
    const typed = plan.keys.map((k) => k.shown);

    expect(typed.some((s) => !PARAMS.text.startsWith(s))).toBe(true);
    expect(typed.at(-1)).toBe(PARAMS.text);
  });

  it('types at a human rhythm: uneven gaps, longer after a space or a comma', () => {
    const plan = model.promptPlan({ ...PARAMS, typo: false }, LENGTH);
    const gaps = plan.keys.slice(1).map((k, i) => +(k.at - plan.keys[i].at).toFixed(3));
    const afterComma = gaps[PARAMS.text.indexOf(',')];

    expect(new Set(gaps).size).toBeGreaterThan(gaps.length / 2);
    expect(afterComma).toBeGreaterThan(Math.max(...gaps.slice(0, 5)));
  });

  it('fits a long prompt into a short clip by typing faster', () => {
    const plan = model.promptPlan({ ...PARAMS, text: 'x '.repeat(80) }, 4);

    expect(plan.k).toBeLessThan(1);
    expect(plan.returnAt).toBeLessThan(4);
  });

  it('loops: the last frame is the first', () => {
    for (const [name, aspect] of Object.entries(ASPECTS)) {
      const all = frames(PARAMS).map((f) => pixels(f, aspect));

      expect(all.at(-1), name).toEqual(all[0]);
    }
  });

  it('without loop, it holds the submitted state to the end', () => {
    const last = frames({ ...PARAMS, repeat: false }).at(-1)!;

    expect(last.thinking).toBe(1);
    expect(last.placeholder).toBe(0);
  });

  it.each(Object.entries(ASPECTS))('moves without a jump in %s', (_name, aspect) => {
    for (const submit of ['thinking', 'clear', 'hold']) {
      const vectors = frames({ ...PARAMS, submit }).map((f) => pixels(f, aspect));

      expect(motionJolts(frameDiffs(vectors))).toEqual([]);
    }
  });
});
