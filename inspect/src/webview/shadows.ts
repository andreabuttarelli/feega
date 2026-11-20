export type Shadow = { x: number; y: number; blur: number; spread: number; colour: string; inset: boolean; visible: boolean };

const NONE = 'none';
const LAYER_SPLIT = /,(?![^(]*\))/;
const COLOUR = /(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i;
const TRANSPARENT = /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/;
const INSET = /\binset\b/;

export const NEW_SHADOW: Shadow = { x: 0, y: 4, blur: 12, spread: 0, colour: 'rgba(0, 0, 0, 0.15)', inset: false, visible: true };

function layerOf(text: string): Shadow {
  const colour = text.match(COLOUR)?.[1] ?? 'rgb(0, 0, 0)';
  const [x = 0, y = 0, blur = 0, spread = 0] = text
    .replace(COLOUR, '')
    .replace(INSET, '')
    .trim()
    .split(/\s+/)
    .map((n) => parseFloat(n) || 0);
  return { x, y, blur, spread, colour, inset: INSET.test(text), visible: true };
}

export function parseShadows(css: string): Shadow[] {
  if (!css || css.trim() === NONE) {
    return [];
  }
  return css
    .split(LAYER_SPLIT)
    .map((t) => t.trim())
    .filter((t) => !TRANSPARENT.test(t))
    .map(layerOf);
}

const layerCss = (s: Shadow) => `${s.inset ? 'inset ' : ''}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.colour}`;

export function shadowCss(layers: Shadow[]): string {
  const shown = layers.filter((s) => s.visible);
  return shown.length ? shown.map(layerCss).join(', ') : NONE;
}

const TOKENS: Record<string, string> = { [NONE]: 'shadow-none' };

export const tailwindShadow = (css: string): string => TOKENS[css] ?? `shadow-[${css.replace(/,\s+/g, ',').replace(/\(([^)]*)\)/g, (m) => m.replace(/\s+/g, '')).replace(/\s+/g, '_')}]`;
