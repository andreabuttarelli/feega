import { describe, expect, it } from 'vitest';
import { connectorOfSlot, editCanvasName, instanceInputs, instancePorts, nextRunRow, RUN_ROW_HEIGHT } from './technique-instance';

const slot = (node: number, type: string) => ({ node, type });

describe('instancePorts', () => {
  it('declares one connector per input type and the first output', () => {
    const ports = instancePorts({ inputs: [slot(0, 'text'), slot(1, 'doc'), slot(2, 'image')], outputs: [slot(4, 'video')] });

    expect(ports).toEqual({ inputs: ['text', 'images'], output: 'videos' });
  });

  it('has no output port when the technique declares none', () => {
    expect(instancePorts({ inputs: [], outputs: [] })).toEqual({ inputs: [], output: null });
  });

  it('maps node types to connectors', () => {
    expect([connectorOfSlot('text'), connectorOfSlot('image'), connectorOfSlot('audio')]).toEqual(['text', 'images', 'audios']);
  });
});

describe('instanceInputs', () => {
  const slots = [slot(0, 'text'), slot(3, 'doc'), slot(5, 'image')];

  it('hands connected texts to the text slots in order', () => {
    expect(instanceInputs(slots, ['first', 'second'])).toEqual([{ node: 0, value: 'first' }, { node: 3, value: 'second' }]);
  });

  it('leaves a text slot without a wire alone', () => {
    expect(instanceInputs(slots, ['only'])).toEqual([{ node: 0, value: 'only' }]);
  });
});

describe('canvases', () => {
  it('names the canvas a technique is edited on', () => {
    expect(editCanvasName('logo-flow')).toBe('Technique: logo-flow');
  });

  it('puts a new run below every run already there', () => {
    expect(nextRunRow([])).toBe(0);
    expect(nextRunRow([0, 300])).toBe(300 + RUN_ROW_HEIGHT);
  });
});
