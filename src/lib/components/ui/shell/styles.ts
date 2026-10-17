export enum Side {
  Top = 'top',
  Right = 'right',
  Bottom = 'bottom',
  Left = 'left'
}

export enum IconSize {
  Sm = 'sm',
  Md = 'md',
  Lg = 'lg'
}

export enum Tone {
  Ghost = 'ghost',
  Filled = 'filled',
  Accent = 'accent'
}

export enum Surface {
  Panel = 'panel',
  Sunken = 'sunken',
  Raised = 'raised'
}

export enum Placement {
  Inline = 'inline',
  Floating = 'floating'
}

export enum Reveal {
  Always = 'always',
  Hover = 'hover'
}

export enum Fold {
  Fixed = 'fixed',
  Open = 'open',
  Closed = 'closed'
}

export enum FieldLayout {
  Inline = 'inline',
  Stack = 'stack'
}

export enum MenuTone {
  Default = 'default',
  Danger = 'danger'
}

export const FOCUS_RING = 'outline-none focus-visible:shadow-[var(--ui-ring)]';

export const SECTION_TITLE = 'text-ui-title font-semibold tracking-[var(--ui-tracking-title)] text-ui-text';

export const SECTION_LABEL ='text-ui-section font-semibold uppercase tracking-[var(--ui-tracking-caps)] text-ui-text-3';

export const FIELD_INPUT = `h-(--ui-row) pointer-coarse:h-11 min-w-0 rounded-md bg-ui-input px-2.5 text-ui-label text-ui-text tabular-nums placeholder:text-ui-text-3 transition-colors duration-(--ui-dur-fast) hover:bg-ui-input-hover focus-visible:bg-ui-panel disabled:text-ui-text-off ${FOCUS_RING}`;

export const SURFACE: Record<Surface, string> = {
  [Surface.Panel]: 'bg-ui-panel',
  [Surface.Sunken]: 'bg-ui-sunken',
  [Surface.Raised]: 'rounded-md bg-ui-raised shadow-ui-float'
};

export const ICON_SIZE: Record<IconSize, string> = {
  [IconSize.Sm]: 'size-7 [&_svg]:size-(--ui-icon-sm)',
  [IconSize.Md]: 'size-8 [&_svg]:size-(--ui-icon)',
  [IconSize.Lg]: 'size-10 [&_svg]:size-(--ui-icon-lg)'
};

export const TONE: Record<Tone, string> = {
  [Tone.Ghost]: 'text-ui-icon hover:bg-ui-wash hover:text-ui-text active:bg-ui-pressed',
  [Tone.Filled]: 'bg-ui-input text-ui-text hover:bg-ui-input-hover active:bg-ui-pressed',
  [Tone.Accent]: 'bg-ui-accent-solid text-ui-on-accent hover:brightness-110 active:brightness-95'
};

export const MENU_CONTENT = 'z-[70] min-w-48 overflow-hidden rounded-md bg-ui-raised p-1 text-ui-text shadow-ui-float outline-none';

export const MENU_ITEM = `flex h-(--ui-row) pointer-coarse:h-11 w-full cursor-default select-none items-center gap-2 rounded-md px-2 text-left text-ui-body text-ui-text outline-none data-highlighted:bg-ui-wash hover:bg-ui-wash focus-visible:bg-ui-wash data-disabled:pointer-events-none data-disabled:text-ui-text-off [&_svg]:size-(--ui-icon-sm) [&_svg]:shrink-0 [&_svg]:text-ui-icon`;

export const MENU_TONE: Record<MenuTone, string> = {
  [MenuTone.Default]: '',
  [MenuTone.Danger]: 'text-ui-danger [&_svg]:text-ui-danger'
};
