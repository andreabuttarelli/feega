import { describe, expect, it } from 'vitest';
import { filterSkills, insertSkill, slashQueryAt, type PromptSkill } from './prompt-skills';

const skills: PromptSkill[] = [
  { id: '1', name: 'product-shot', body: 'Studio product shot, soft light' },
  { id: '2', name: 'poster-grain', body: 'Risograph poster with grain' },
  { id: '3', name: 'cinematic', body: 'Cinematic, anamorphic' }
];

describe('slashQueryAt', () => {
  it('opens at a slash typed at the start', () => {
    expect(slashQueryAt('/', 1)).toEqual({ start: 0, query: '' });
  });

  it('opens after a space and carries what follows the slash', () => {
    expect(slashQueryAt('a cat /pro', 10)).toEqual({ start: 6, query: 'pro' });
  });

  it('stays closed when the slash is inside a word', () => {
    expect(slashQueryAt('and/or', 6)).toBeNull();
  });

  it('closes once the query meets a space', () => {
    expect(slashQueryAt('/pro duct', 9)).toBeNull();
  });

  it('closes when the caret is before the slash', () => {
    expect(slashQueryAt('a /pro', 1)).toBeNull();
  });
});

describe('filterSkills', () => {
  it('returns all with an empty query', () => {
    expect(filterSkills(skills, '')).toHaveLength(3);
  });

  it('matches by name, case-insensitive', () => {
    expect(filterSkills(skills, 'PRO').map((s) => s.name)).toEqual(['product-shot']);
  });

  it('ranks names that start with the query first', () => {
    expect(filterSkills(skills, 'p').map((s) => s.name)).toEqual(['product-shot', 'poster-grain']);
  });
});

describe('insertSkill', () => {
  it('replaces the slash query with the body and puts the caret after it', () => {
    const out = insertSkill('a cat /pro, wide', { start: 6, query: 'pro' }, skills[0]);

    expect(out.text).toBe('a cat Studio product shot, soft light, wide');
    expect(out.caret).toBe('a cat Studio product shot, soft light'.length);
  });
});
