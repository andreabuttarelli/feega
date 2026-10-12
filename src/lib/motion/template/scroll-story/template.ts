import { PlayMode } from '$lib/motion/interactive/settings';
import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { STORY_COMPONENT, STORY_FONTS, STORY_PROPS, STORY_VAR_PREFIX, storyComponent } from './component';

export const STORY_TEMPLATE_ID = `${BUILTIN_PREFIX}scroll-story`;
export const STORY_CLIP = 'story';
export const STORY_SCROLL_LENGTH = 4;
export const STORY_KEY_FIELDS = ['headline1', 'image1', 'headline2', 'image2', 'headline3'];

const IN_GROUP: Record<string, readonly string[]> = {
  Media: ['image1', 'image2', 'image3', 'imageSize', 'imageRatio', 'lane1', 'lane2', 'lane3', 'speed1', 'speed2', 'speed3', 'parallax'],
  Grid: ['columns', 'rows', 'lineColor', 'lineOpacity', 'showLabels']
};

const STORY_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const STORY_VARS = ['headline1', 'kicker1', 'image1', 'headline2', 'kicker2', 'image2', 'headline3', 'kicker3', 'image3', 'textColor', 'background', 'lineColor', 'lineOpacity', 'columns', 'rows', 'swapStyle'];

export const SCROLL_STORY_TEMPLATE: TemplateEntry = {
  id: STORY_TEMPLATE_ID,
  template: {
    name: 'Scroll story',
    description: 'Three chapters on a visible grid: the headline stays pinned in the centre and swaps line by line at each chapter, while each chapter image drifts past at its own speed. Scroll drives it on a page; it plays through as a video.',
    keyFields: STORY_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'scroll-story', component: STORY_COMPONENT, code: storyComponent(), props: STORY_PROPS, fonts: STORY_FONTS, varPrefix: STORY_VAR_PREFIX, vars: STORY_VARS, clip: STORY_CLIP, seconds: 12, fps: 30, playback: { playback: PlayMode.Scrub, scrollLength: STORY_SCROLL_LENGTH }, groups: STORY_GROUPS })
  }
};
