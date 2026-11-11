import { HF_PORTS } from '@feega/motion-core/motion/hyperframes/catalog';
import { snakeKey } from '@feega/motion-core/motion/custom/component';
import { KEY_FIELDS_MAX } from '@feega/motion-core/motion/template/key-fields';
import { componentName, propsOf, hfComponent, type HfPort } from '@feega/motion-core/motion/hyperframes/model';
import { BUILTIN_PREFIX } from './design-kit';
import { customTemplateDoc } from './custom-template';
import type { TemplateEntry } from './library';
import { lazyTemplate } from './lazy';

export const HF_PREFIX = `${BUILTIN_PREFIX}hyperframes-`;
export const HF_CLIP = 'hyperframes';
const DESCRIPTION_MAX = 200;
const HF_FONTS = ['Inter', 'Geist', 'Space Grotesk', 'Outfit', 'Montserrat', 'Instrument Serif'];

const fontsOf = (port: HfPort) => [...new Set([...port.fonts, ...HF_FONTS])];

const CONTENT_KEYS = 3;

const keyFieldsOf = (port: HfPort) => {
  const props = propsOf(port);
  const content = Object.keys(props).filter((k) => props[k].group === 'Content').slice(0, CONTENT_KEYS);
  return [...content, ...['mode', 'background'].filter((k) => k in props)].slice(0, KEY_FIELDS_MAX).map(snakeKey);
};

const templateOf = (port: HfPort): TemplateEntry => ({
  id: `${HF_PREFIX}${port.id}`,
  template: lazyTemplate(
    () => customTemplateDoc({ name: port.id, component: componentName(port.id), code: hfComponent(port), props: propsOf(port), fonts: fontsOf(port), varPrefix: '', vars: [], clip: HF_CLIP, seconds: port.frames / port.fps, fps: port.fps, size: { width: port.width, height: port.height } }),
    { name: port.title, description: port.about.slice(0, DESCRIPTION_MAX), keyFields: keyFieldsOf(port) }
  )
});

export const HF_TEMPLATES: TemplateEntry[] = HF_PORTS.map(templateOf);
