import { describe, it, expect } from 'vitest';
import { costFromStreamText } from './llm-usage-cost';

describe('gateway invoice on the Responses API stream', () => {
  it('is read from the completed event, where the Responses API puts usage', () => {
    const stream = [
      'event: response.created',
      'data: {"type":"response.created","response":{"id":"r"}}',
      '',
      'event: response.completed',
      'data: {"type":"response.completed","response":{"usage":{"output_tokens":670,"output_tokens_details":{"reasoning_tokens":332},"cost":0.00348}}}',
      ''
    ].join('\n');
    expect(costFromStreamText(stream)).toBe(0.00348);
  });
});
