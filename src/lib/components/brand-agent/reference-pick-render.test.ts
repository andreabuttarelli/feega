import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import ReferencePick from './ReferencePick.svelte';
import { Mark, PickState, answerText, readAnswer } from '$lib/reference-pick';

const candidates = Array.from({ length: 6 }, (_, i) => ({ id: `pin${i}`, image: `https://i.pinimg.com/${i}.jpg`, title: `Pin ${i}` }));
const ask = { question: 'Which look is yours?', candidates, min: 1, max: 6 };

describe('reference pick card', () => {
  it('waiting: a grid of toggles, a note and a continue button', () => {
    const body = render(ReferencePick, { props: { card: { ask, state: PickState.Waiting, answer: null }, onpick: () => {} } }).body;

    expect(body).toContain('data-testid="reference-pick"');
    expect(body).toContain('Which look is yours?');
    expect(body.match(/data-testid="pick-candidate"/g)).toHaveLength(6);
    expect(body).toContain('aria-pressed');
    expect(body).toContain('https://i.pinimg.com/0.jpg');
    expect(body).toContain('data-testid="pick-go"');
    expect(body).toContain('<textarea');
  });

  it('answered after a reload: the marks are shown and nothing can be sent again', () => {
    const answer = readAnswer(answerText(ask, { pin0: Mark.Follow, pin3: Mark.Avoid }, ''));
    const body = render(ReferencePick, { props: { card: { ask, state: PickState.Answered, answer }, onpick: () => {} } }).body;

    expect(body).toContain('data-mark="follow"');
    expect(body).toContain('data-mark="avoid"');
    expect(body).not.toContain('data-testid="pick-go"');
    expect(body).not.toContain('<textarea');
  });
});
