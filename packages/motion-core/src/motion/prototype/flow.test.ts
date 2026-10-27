import { describe, expect, it } from 'vitest';
import { MAX_FLOW_NAME, flowSchema } from './flow';
import { MotionFormat, motionDocSchema, newMotionDoc } from '../doc';

describe('flow', () => {
  it('names the starting point of a prototype', () => {
    expect(flowSchema.parse({ name: 'Onboarding' })).toEqual({ name: 'Onboarding' });
  });

  it('refuses an empty or oversized name', () => {
    expect(flowSchema.safeParse({ name: '' }).success).toBe(false);
    expect(flowSchema.safeParse({ name: 'x'.repeat(MAX_FLOW_NAME + 1) }).success).toBe(false);
  });

  it('is stored on the doc', () => {
    const doc = { ...newMotionDoc(MotionFormat.Landscape), flow: { name: 'Checkout' } };

    expect(motionDocSchema.parse(doc).flow).toEqual({ name: 'Checkout' });
  });
});
