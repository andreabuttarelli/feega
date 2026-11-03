import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { MotionTemplate } from './library';

export function lazyTemplate(build: () => MotionDoc, meta: Omit<MotionTemplate, 'doc'>): MotionTemplate {
  let doc: MotionDoc | null = null;
  return {
    ...meta,
    get doc() {
      doc ??= build();
      return doc;
    }
  };
}
