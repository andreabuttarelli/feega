import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { COUNTER_COMPONENT, counterSchema, type Counter } from '@feega/motion-core/motion/text-counter';

export type CounterInput = Partial<Counter> & Pick<Counter, 'from' | 'to'>;

const fail = (error: string): OpResult => ({ ok: false, error });

export function setTextCounter(doc: MotionDoc, clipId: string, input: CounterInput | null): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  if (found.clip.component !== COUNTER_COMPONENT) {
    return fail(`${found.clip.component} cannot count; counters go on ${COUNTER_COMPONENT} clips`);
  }
  if (input !== null && (found.clip.props.runs as unknown[] | undefined)?.length) {
    return fail('a counter replaces the text, so the clip cannot keep styled ranges');
  }
  if (input === null) {
    return setProps(doc, clipId, { counter: undefined });
  }
  const parsed = counterSchema.safeParse({ ...found.clip.props.counter, ...input });
  return parsed.success ? setProps(doc, clipId, { counter: parsed.data }) : fail(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
}
