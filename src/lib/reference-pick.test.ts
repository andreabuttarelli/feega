import { describe, expect, it } from 'vitest';
import { ASK_REFERENCE_PICK, Mark, PickState, answerLabel, answerText, avoidedImages, choosesForUser, latestAnswer, pickAwaits, pickCards, readAnswer, savedPick, type PickAsk } from './reference-pick';
import { toolsForMirror } from '$lib/chat-stream-events';

const candidates = Array.from({ length: 6 }, (_, i) => ({ id: `pin${i}`, image: `https://i.pinimg.com/${i}.jpg`, title: `Pin ${i}`, why: 'bold type' }));
const ask: PickAsk = { question: 'Which look is yours?', candidates, min: 1, max: 6 };
const asked = { toolName: ASK_REFERENCE_PICK, status: 'done' as const, toolCallId: 'c1', output: { ok: true, ...ask } };

const marks = { pin0: Mark.Follow, pin1: Mark.Follow, pin2: Mark.Follow, pin3: Mark.Avoid };

describe('reference pick', () => {
  it('reads the pick out of a saved ask_reference_pick result only', () => {
    expect(savedPick(asked)).toEqual(ask);
    expect(savedPick({ toolName: ASK_REFERENCE_PICK, output: { ok: false, error: 'x' } })).toBeNull();
    expect(savedPick({ toolName: 'view_images', output: { ok: true, ...ask } })).toBeNull();
  });

  it('ends the turn when the last step asked the user to pick', () => {
    const step = (toolName: string) => ({ content: [{ type: 'tool-result', toolName, output: { ok: true, ...ask } }] });
    expect(pickAwaits([step(ASK_REFERENCE_PICK)])).toBe(true);
    expect(pickAwaits([step(ASK_REFERENCE_PICK), step('view_images')])).toBe(false);
    expect(pickAwaits([])).toBe(false);
  });

  it('turns the marks into followed and avoided references the next turn reads', () => {
    const answer = readAnswer(answerText(ask, marks, 'more contrast'));
    expect(answer?.follow.map((c) => c.id)).toEqual(['pin0', 'pin1', 'pin2']);
    expect(answer?.avoid.map((c) => c.id)).toEqual(['pin3']);
    expect(answer?.note).toBe('more contrast');
    expect(answer?.follow[0].image).toBe('https://i.pinimg.com/0.jpg');
  });

  it('shows the user a short line, not the payload', () => {
    const label = answerLabel(answerText(ask, marks, ''));
    expect(label).not.toContain('<reference-pick>');
    expect(label).toContain('3');
    expect(answerLabel('plain words')).toBe('plain words');
  });

  it('a plain message is not an answer', () => {
    expect(readAnswer('make it red')).toBeNull();
    expect(readAnswer('<reference-pick>{bad json</reference-pick>')).toBeNull();
  });

  it('the latest answer in the thread is the one that rules, with its avoided pictures', () => {
    const turns = [
      { role: 'user' as const, content: answerText(ask, { pin5: Mark.Avoid }, '') },
      { role: 'assistant' as const, content: 'ok' },
      { role: 'user' as const, content: answerText(ask, marks, '') },
      { role: 'user' as const, content: 'now make it bluer' }
    ];
    const answer = latestAnswer(turns);
    expect(answer?.avoid.map((c) => c.id)).toEqual(['pin3']);
    expect([...avoidedImages(answer)]).toEqual(['https://i.pinimg.com/3.jpg']);
    expect(avoidedImages(null).size).toBe(0);
  });

  it('a pick card survives the saved row whole, so a reload still draws it', () => {
    const big = { ...asked, output: { ok: true, ...ask, candidates: Array.from({ length: 12 }, (_, i) => ({ ...candidates[0], id: `p${i}`, why: 'x'.repeat(200) })) } };
    expect(savedPick(toolsForMirror([big])[0])?.candidates).toHaveLength(12);
  });

  it('a reload shows each card answered or waiting', () => {
    const waiting = [{ role: 'user' as const, content: 'find refs' }, { role: 'assistant' as const, content: 'pick', tools: [asked] }];
    expect(pickCards(waiting).get(1)).toEqual({ ask, state: PickState.Waiting, answer: null });

    const answered = [...waiting, { role: 'user' as const, content: answerText(ask, marks, '') }];
    const card = pickCards(answered).get(1);
    expect(card?.state).toBe(PickState.Answered);
    expect(card?.answer?.avoid.map((c) => c.id)).toEqual(['pin3']);

    const passed = [...waiting, { role: 'user' as const, content: 'something else' }];
    expect(pickCards(passed).get(1)?.state).toBe(PickState.Passed);
  });

  it('knows when the user said to choose for them', () => {
    expect(choosesForUser('trova riferimenti su pinterest, scegli tu')).toBe(true);
    expect(choosesForUser('Find refs and choose for me')).toBe(true);
    expect(choosesForUser('decidi tu')).toBe(true);
    expect(choosesForUser('find pinterest references')).toBe(false);
  });
});
