export const COLOUR_TAGS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'grey'] as const;

export type ColourTag = (typeof COLOUR_TAGS)[number];

export const COLOUR_TAG_HEX: Record<ColourTag, string> = {
  red: '#e5484d',
  orange: '#f76b15',
  yellow: '#f5d90a',
  green: '#30a46c',
  blue: '#0090ff',
  purple: '#8e4ec6',
  grey: '#8b8d98'
};

export function colourOf(data: Record<string, unknown>): ColourTag | null {
  return COLOUR_TAGS.find((tag) => tag === data.colorTag) ?? null;
}

export function withColour(tag: ColourTag | null): { colorTag: ColourTag | null } {
  return { colorTag: tag };
}
