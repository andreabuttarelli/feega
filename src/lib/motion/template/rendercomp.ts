import { RENDERCOMP_PORTS } from '@feega/motion-core/motion/rendercomp/catalog';
import { rendercompName } from '@feega/motion-core/motion/rendercomp/model';
import { BUILTIN_PREFIX } from './design-kit';
import type { TemplateEntry } from './library';
import { portEntry } from './snapcn';

export const RENDERCOMP_PREFIX = `${BUILTIN_PREFIX}rendercomp-`;
export const RENDERCOMP_CLIP = 'rendercomp';

export const RENDERCOMP_TEMPLATES: TemplateEntry[] = RENDERCOMP_PORTS.map((port) => portEntry(port, { prefix: RENDERCOMP_PREFIX, clip: RENDERCOMP_CLIP, component: rendercompName }));
