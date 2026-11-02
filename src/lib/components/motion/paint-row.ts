import { FOCUS_RING } from '$lib/components/ui/shell/styles';

export const PAINT_ROW = `group/paint relative grid min-h-10 grid-cols-[32px_minmax(0,1fr)_24px_24px] items-center gap-x-3 rounded-md py-1 pr-0.5 pl-0 ${FOCUS_RING}`;

export const PAINT_GRIP = 'absolute top-1/2 -left-3 -translate-y-1/2 cursor-grab text-ui-text-3 opacity-0 select-none group-hover/paint:opacity-100';

export const PAINT_SWATCH = `dim size-8 rounded-md border border-ui-divider p-0 ${FOCUS_RING}`;

export const PAINT_TEXT = 'dim flex min-w-0 flex-col gap-0.5';

export const PAINT_NAME = 'truncate text-ui-body font-medium text-ui-text';

export const PAINT_META = 'flex min-w-0 items-center text-ui-caption text-ui-text-2';

export const PAINT_INLINE_INPUT = `h-5 min-w-[2ch] [field-sizing:content] appearance-none rounded-xs bg-transparent p-0 text-ui-caption text-ui-text-2 [appearance:textfield] hover:bg-ui-input focus-visible:bg-ui-input [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${FOCUS_RING}`;
