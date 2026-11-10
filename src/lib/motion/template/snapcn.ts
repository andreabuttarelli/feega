import { SNAPCN_PORTS } from '@feega/motion-core/motion/snapcn/catalog';
import { componentName, propsOf, snapcnComponent, type SnapcnPort } from '@feega/motion-core/motion/snapcn/model';
import { BUILTIN_PREFIX } from './design-kit';
import { customTemplateDoc } from './custom-template';
import type { TemplateEntry } from './library';
import { lazyTemplate } from './lazy';

export const SNAPCN_PREFIX = `${BUILTIN_PREFIX}snapcn-`;
export const SNAPCN_CLIP = 'snapcn';
const DESCRIPTION_MAX = 200;

const templateOf = (port: SnapcnPort): TemplateEntry => ({
  id: `${SNAPCN_PREFIX}${port.id}`,
  template: lazyTemplate(
    () => customTemplateDoc({ name: port.id, component: componentName(port.id), code: snapcnComponent(port), props: propsOf(port), fonts: port.fonts, varPrefix: '', vars: [], clip: SNAPCN_CLIP, seconds: port.frames / port.fps, fps: port.fps, size: { width: port.width, height: port.height } }),
    { name: port.title, description: port.about.slice(0, DESCRIPTION_MAX) }
  )
});

export const SNAPCN_TEMPLATES: TemplateEntry[] = SNAPCN_PORTS.map(templateOf);
