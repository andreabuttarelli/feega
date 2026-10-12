import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { PAPER_COMPONENT, PAPER_FONTS, PAPER_PROPS, PAPER_VAR_PREFIX, paperComponent } from './component';

export const PAPER_TEMPLATE_ID = `${BUILTIN_PREFIX}paper-cutouts-counter`;
export const PAPER_CLIP = 'paper';
export const PAPER_VARS = ['from', 'to', 'prefix', 'brand', 'panelColor', 'background'];
export const PAPER_KEY_FIELDS = ['from', 'to', 'media', 'brand', 'panel_color'];

const IN_GROUP: Record<string, readonly string[]> = {
  Counter: ['lines', 'panelColor', 'numberColor'],
  Paper: ['cutoutColor', 'paperColor', 'inkColor', 'crumple'],
  Labels: ['brand', 'leftLabel', 'centreLabel', 'rightLabel', 'badgeColor']
};

const PAPER_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const PAPER_CUTOUTS_TEMPLATE: TemplateEntry = {
  id: PAPER_TEMPLATE_ID,
  template: {
    name: 'Paper cutouts counter',
    description: 'Three crumpled paper cutouts float in a grey studio: a picture cutout, a sketch, and a dark panel where a counter grows line by line, each line bigger. Every part is a field or a runtime variable.',
    keyFields: PAPER_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'paper-cutouts-counter', component: PAPER_COMPONENT, code: paperComponent(), props: PAPER_PROPS, fonts: PAPER_FONTS, varPrefix: PAPER_VAR_PREFIX, vars: PAPER_VARS, clip: PAPER_CLIP, seconds: 12, fps: 60, groups: PAPER_GROUPS })
  }
};
