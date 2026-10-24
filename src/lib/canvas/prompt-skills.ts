export type PromptSkill = { id: string; name: string; body: string };

export type SlashQuery = { start: number; query: string };

export function slashQueryAt(text: string, caret: number): SlashQuery | null {
  const start = text.lastIndexOf('/', caret - 1);
  if (start < 0 || (start > 0 && !/\s/.test(text[start - 1]))) {
    return null;
  }

  const query = text.slice(start + 1, caret);
  return /\s/.test(query) ? null : { start, query };
}

export function filterSkills(skills: PromptSkill[], query: string): PromptSkill[] {
  const needle = query.toLowerCase();
  const matches = skills.filter((skill) => skill.name.toLowerCase().includes(needle));
  const startsWith = (skill: PromptSkill) => skill.name.toLowerCase().startsWith(needle);

  return [...matches.filter(startsWith), ...matches.filter((skill) => !startsWith(skill))];
}

export function insertSkill(text: string, slash: SlashQuery, skill: PromptSkill): { text: string; caret: number } {
  const before = text.slice(0, slash.start) + skill.body;
  const after = text.slice(slash.start + 1 + slash.query.length);

  return { text: before + after, caret: before.length };
}
