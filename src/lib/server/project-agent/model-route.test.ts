import { describe, it, expect } from 'vitest';
import { DEFAULT_CHAT_CHOICE } from '$lib/chat-model';
import { EDIT_MODEL, Pick, pickOf, TurnKind, turnKind, turnModel } from './model-route';

const PICKED = { model: 'openai/gpt-5.6-sol', reasoning: null };

describe('the canvas chat routes a simple edit to a cheaper model', () => {
  it.each(['change the headline to "One chat, every frame"', 'export a PNG', 'make the title red', 'rename the frame to Poster', 'set the duration to 5 seconds'])('"%s" is an edit', (message) => {
    expect(turnKind(message)).toBe(TurnKind.Edit);
  });

  it.each(['create a poster frame from a template', 'design a launch campaign for our new shoes', 'make a 20 second promo video', 'write three hooks for this product', 'change everything: rethink the whole layout and story, it should feel premium, add scenes and music and new copy for every frame we have'])('"%s" keeps the chosen model', (message) => {
    expect(turnKind(message)).toBe(TurnKind.Open);
  });

  it('an edit with no model asked runs on the edit model', () => {
    expect(turnModel(DEFAULT_CHAT_CHOICE, Pick.Auto, 'change the headline to "Hi"').model).toBe(EDIT_MODEL);
  });

  it('a model the user picked is never overridden', () => {
    expect(turnModel(PICKED, Pick.User, 'change the headline to "Hi"')).toEqual(PICKED);
  });

  it('Opus picked by the user stays Opus on an edit', () => {
    expect(turnModel(DEFAULT_CHAT_CHOICE, Pick.User, 'change the headline to "Hi"')).toEqual(DEFAULT_CHAT_CHOICE);
  });

  it('creative work with no model asked stays on the default', () => {
    expect(turnModel(DEFAULT_CHAT_CHOICE, Pick.Auto, 'create a poster frame from a template')).toEqual(DEFAULT_CHAT_CHOICE);
  });

  it('a turn that names no model is auto, one that names a model is the user\'s', () => {
    expect(pickOf(undefined)).toBe(Pick.Auto);
    expect(pickOf('anthropic/claude-opus-5.5')).toBe(Pick.User);
  });
});
