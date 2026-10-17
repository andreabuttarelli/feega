import { textPaint, type FillPaint } from '../fill/render';
import type { MotionClip } from '../doc';

const kebab = (prop: string) => prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const quoted = (value: string) => value.replace(/["\\]/g, '\\$&');
const inert = (value: string) => value.replace(/[{}<>;]/g, '');
const declarations = (style: Record<string, string>) => Object.entries(style).map(([prop, value]) => `${kebab(prop)}:${inert(value)} !important`).join(';');

export function partStyleCss(clips: readonly MotionClip[], color: FillPaint['color'], asset: FillPaint['asset']): string {
  return clips
    .flatMap((clip) =>
      Object.entries(clip.partStyles ?? {}).map(([part, { fills }]) => {
        const at = `[data-clip="${quoted(clip.id)}"] [data-part="${quoted(part)}"]`;
        const paint = textPaint(fills, color, asset);
        const colour = inert(paint.color);
        const inner = paint.backgroundClip ? '' : `${at} *{color:${colour} !important}${at} :is(text,tspan),${at}:is(text,tspan){fill:${colour} !important}`;
        return `${at}{${declarations(paint)}}${inner}`;
      })
    )
    .join('');
}

export function partStyleTag(clips: readonly MotionClip[], color: FillPaint['color'], asset: FillPaint['asset']): string {
  const css = partStyleCss(clips, color, asset);
  return css ? `<style>${css.replace(/<\//g, '<\\/')}</style>` : '';
}
