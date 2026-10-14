import { describe, expect, it } from 'vitest';
import { MotionFormat } from '$lib/motion/doc';
import { BUILTIN_TEMPLATES } from './builtins';
import { TEMPLATE_CARDS, templateCard } from './cards';
import { cardLine, cardProblems, EdgeTone, Energy, Joint, MediaAspect, SectionRole, TextAmount, type TemplateCard } from './card';

const seconds = (id: string) => {
  const doc = BUILTIN_TEMPLATES.find((e) => e.id === id)!.template.doc;
  return doc.durationInFrames / doc.fps;
};

const CARD: TemplateCard = {
  roles: [SectionRole.Opener],
  energy: Energy.Fast,
  loops: false,
  onScreen: [{ from: 0, to: 1.5, what: 'photos gather' }, { from: 4, what: 'title lands' }],
  needs: { media: { min: 6, max: 12, aspect: MediaAspect.Any }, text: TextAmount.Line },
  bestFormats: [MotionFormat.Landscape],
  edges: { start: EdgeTone.Dark, end: EdgeTone.Dark, transition: Joint.Cut },
  goodFor: ['launch hook']
};

describe('template cards', () => {
  it.each(BUILTIN_TEMPLATES.map((e) => [e.id] as const))('%s ships a complete card', (id) => {
    const card = templateCard(id);

    expect(card).not.toBeNull();
    expect(cardProblems(card!, seconds(id))).toEqual([]);
  });

  it('no card is left behind for a template that no longer exists', () => {
    const ids = new Set(BUILTIN_TEMPLATES.map((e) => e.id));

    expect(Object.keys(TEMPLATE_CARDS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('a card whose beats run past the template or go back in time is incomplete', () => {
    expect(cardProblems({ ...CARD, onScreen: [] }, 5)).toContain('onScreen is empty');
    expect(cardProblems({ ...CARD, onScreen: [{ from: 0, to: 9, what: 'too long' }] }, 5).join()).toMatch(/past the end/);
    expect(cardProblems({ ...CARD, onScreen: [{ from: 2, what: 'b' }, { from: 1, what: 'a' }] }, 5).join()).toMatch(/out of order/);
    expect(cardProblems({ ...CARD, goodFor: [] }, 5)).toContain('goodFor is empty');
    expect(cardProblems({ ...CARD, needs: { ...CARD.needs, media: { min: 5, max: 2, aspect: MediaAspect.Any } } }, 5).join()).toMatch(/media/);
  });

  it('the compact line names role, energy, edges, needs and the beats with their seconds', () => {
    const line = cardLine(CARD);

    expect(line).toContain('opener');
    expect(line).toContain('fast');
    expect(line).toContain('dark→dark');
    expect(line).toContain('6–12');
    expect(line).toContain('0–1.5s photos gather');
    expect(line).toContain('4s title lands');
  });
});
