import { SNAPCN_PORTS } from '@feega/motion-core/motion/snapcn/catalog';
import { snakeKey } from '@feega/motion-core/motion/custom/component';
import { KEY_FIELDS_MAX } from '@feega/motion-core/motion/template/key-fields';
import { componentName, propsOf, snapcnComponent, type SnapcnPort } from '@feega/motion-core/motion/snapcn/model';
import { BUILTIN_PREFIX } from './design-kit';
import { customTemplateDoc } from './custom-template';
import type { TemplateEntry } from './library';
import { lazyTemplate } from './lazy';

export const SNAPCN_PREFIX = `${BUILTIN_PREFIX}snapcn-`;
export const SNAPCN_CLIP = 'snapcn';
const DESCRIPTION_MAX = 200;
const SNAPCN_FONTS = ['Inter', 'Geist', 'Space Grotesk', 'Outfit', 'Montserrat', 'Instrument Serif'];

const fontsOf = (port: SnapcnPort) => [...new Set([...port.fonts, ...SNAPCN_FONTS])];

const CONTENT_KEYS = 3;

const keyFieldsOf = (port: SnapcnPort) => {
  const props = propsOf(port);
  const content = Object.keys(props).filter((k) => props[k].group === 'Content').slice(0, CONTENT_KEYS);
  return [...content, ...['mode', 'background'].filter((k) => k in props)].slice(0, KEY_FIELDS_MAX).map(snakeKey);
};

export const templateOf = (port: SnapcnPort, prefix: string): TemplateEntry => ({
  id: `${prefix}${port.id}`,
  template: lazyTemplate(
    () => customTemplateDoc({ name: port.id, component: componentName(port.id), code: snapcnComponent(port), props: propsOf(port), fonts: fontsOf(port), varPrefix: '', vars: [], clip: SNAPCN_CLIP, seconds: port.frames / port.fps, fps: port.fps, size: { width: port.width, height: port.height } }),
    { name: port.title, description: port.about.slice(0, DESCRIPTION_MAX), keyFields: keyFieldsOf(port) }
  )
});

export const SNAPCN_TEMPLATES: TemplateEntry[] = SNAPCN_PORTS.map((p) => templateOf(p, SNAPCN_PREFIX));
