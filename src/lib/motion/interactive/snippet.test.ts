import { describe, expect, it } from 'vitest';
import { MotionFormat, motionDocSchema, newMotionDoc, type MotionDoc } from '../doc';
import { embedSnippet } from './bundle';
import { DEFAULT_INTERACTIVE, Outside, PlayMode, SCROLL_LENGTH, interactiveOf } from './settings';
import { interactiveSchema } from './schema';

const URL = 'https://feega.app/e/c76b6d3b-8262-4b68-ad58-3cb51a6190a9';
const saturn = { ...newMotionDoc(MotionFormat.Landscape), interactive: { loop: false, outside: Outside.Fallback, playback: PlayMode.Scrub } } as MotionDoc;

describe('the embed snippet fits the playback', () => {
  it('wraps a scrub embed in a scroll section the host script reads', () => {
    const snippet = embedSnippet(saturn, URL);

    expect(snippet.startsWith(`<div data-scroll="${SCROLL_LENGTH.default}">`)).toBe(true);
    expect(snippet.endsWith('</div>')).toBe(true);
    expect(snippet).toMatch(/<iframe[^>]*><\/iframe>\n<script>/);
  });

  it('uses the doc scroll length', () => {
    const doc = { ...saturn, interactive: { ...interactiveOf(saturn), scrollLength: 6 } };
    expect(embedSnippet(doc, URL)).toContain('data-scroll="6"');
  });

  it.each([PlayMode.Autoplay, PlayMode.InView, PlayMode.Paused])('leaves %s as a plain iframe', (playback) => {
    const doc = { ...saturn, interactive: { ...DEFAULT_INTERACTIVE, playback } };
    const snippet = embedSnippet(doc, URL);

    expect(snippet).not.toContain('<div data-scroll');
    expect(snippet.startsWith('<iframe')).toBe(true);
  });
});

describe('scroll length', () => {
  it('defaults to three viewports on a doc saved before it existed', () => {
    expect(interactiveOf(saturn).scrollLength).toBe(3);
    expect(motionDocSchema.parse(saturn).interactive?.scrollLength).toBe(3);
  });

  it('refuses lengths outside 1–10 viewports', () => {
    expect(interactiveSchema.safeParse({ scrollLength: 0 }).success).toBe(false);
    expect(interactiveSchema.safeParse({ scrollLength: 11 }).success).toBe(false);
    expect(interactiveSchema.safeParse({ scrollLength: 2.5 }).success).toBe(false);
    expect(interactiveSchema.safeParse({ scrollLength: 10 }).success).toBe(true);
  });
});
