import { describe, expect, it } from 'vitest';
import { UI_LOOP_PORTS } from '@feega/motion-core/motion/uiloops/catalog';
import { BUILTIN_TEMPLATES } from './builtins';
import { templateCard } from './cards';
import { UI_LOOP_TEMPLATES } from './ui-loops';

describe('ui loops are builtin templates with a card', () => {
  it.each(UI_LOOP_PORTS.map((p) => [p.id, p]))('%s', (_, port) => {
    const id = `builtin:${port.id}`;
    expect(UI_LOOP_TEMPLATES.some((t) => t.id === id)).toBe(true);
    expect(BUILTIN_TEMPLATES.some((t) => t.id === id)).toBe(true);
    expect(templateCard(id)?.roles.length).toBeGreaterThan(0);
  });
});
