import { REMOCN_PORTS } from '@feega/motion-core/motion/remocn/catalog';
import { propsOf, snapcnComponent, type SnapcnPort } from '@feega/motion-core/motion/snapcn/model';
import { BUILTIN_PREFIX } from './design-kit';
import { customTemplateDoc } from './custom-template';
import type { TemplateEntry } from './library';
import { lazyTemplate } from './lazy';
import { DESCRIPTION_MAX, fontsOf, keyFieldsOf } from './snapcn';

export const REMOCN_PREFIX = `${BUILTIN_PREFIX}remocn-`;
export const REMOCN_CLIP = 'remocn';

const componentOf = (id: string) => `Remocn${id.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase())}`;

const templateOf = (port: SnapcnPort): TemplateEntry => ({
  id: `${REMOCN_PREFIX}${port.id}`,
  template: lazyTemplate(
    () => customTemplateDoc({ name: port.id, component: componentOf(port.id), code: snapcnComponent(port), props: propsOf(port), fonts: fontsOf(port), varPrefix: '', vars: [], clip: REMOCN_CLIP, seconds: port.frames / port.fps, fps: port.fps, size: { width: port.width, height: port.height } }),
    { name: port.title, description: port.about.slice(0, DESCRIPTION_MAX), keyFields: keyFieldsOf(port) }
  )
});

export const REMOCN_TEMPLATES: TemplateEntry[] = REMOCN_PORTS.map(templateOf);
