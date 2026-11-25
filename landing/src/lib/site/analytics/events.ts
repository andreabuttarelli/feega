export const MAX_PROPS_PER_EVENT = 2;

export const MAX_VALUE_LENGTH = 255;

export const EVENTS = {
  download_click: ['target', 'place'],
  install_copy: ['command'],
  github_click: ['place'],
  template_copy: ['id', 'framework'],
  template_view_code: ['id', 'framework'],
  plugin_open: ['id'],
  pricing_cta: ['plan'],
  ask_ai_click: ['assistant'],
  alt_landing_cta: ['page', 'cta'],
  docs_click: ['place']
} as const satisfies Record<string, readonly string[]>;

export type EventName = keyof typeof EVENTS;

export type EventProps<N extends EventName> = Record<(typeof EVENTS)[N][number], string>;
