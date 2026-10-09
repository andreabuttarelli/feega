import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import { Act } from '$lib/motion/script';
import ScriptBrief from './ScriptBrief.svelte';

const outline = [
  { act: Act.Problem, intensity: 0.2, branch: false },
  { act: Act.Solution, intensity: 0.6, branch: false },
  { act: Act.Solution, intensity: 0.5, branch: true },
  { act: Act.Proof, intensity: 0.9, branch: false }
];

const props = { brief: '**Research**', seconds: 8, ongo: () => {}, onedit: () => {} };

describe('script brief with a storyboard', () => {
  it('draws the emotion curve through the main beats and links the storyboard canvas', () => {
    const body = render(ScriptBrief, { props: { ...props, board: { href: '/p/p1/c/board', outline } } }).body;

    expect(body).toContain('data-testid="storyboard-mini"');
    expect(body.match(/<circle/g)).toHaveLength(4);
    expect(body).toMatch(/<polyline[^>]*points="[^"]+"/);
    expect(body).toContain('href="/p/p1/c/board"');
    expect(body).toContain('Open storyboard');
  });

  it('without a storyboard shows the brief alone', () => {
    const body = render(ScriptBrief, { props }).body;

    expect(body).not.toContain('storyboard-mini');
  });
});
