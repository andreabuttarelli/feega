import type { ComponentId } from './components';
import type { TextLook } from './text-measure';

const WRAPS: Partial<Record<ComponentId, (p: Record<string, unknown>) => boolean>> = { Text: (p) => p.sizing !== 'auto' };
const CAPITALS: Partial<Record<ComponentId, true>> = { Kicker: true };

export function textLook(component: ComponentId, p: Record<string, unknown>): TextLook {
  return {
    text: String(p.text ?? ''),
    size: Number(p.size ?? 0),
    tracking: Number(p.tracking ?? 0),
    leading: Number(p.leading ?? 1),
    align: (p.align as TextLook['align']) ?? 'left',
    wraps: WRAPS[component]?.(p) ?? true,
    capitals: Boolean(CAPITALS[component]) || p.textCase === 'upper'
  };
}
