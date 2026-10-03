import { describe, expect, it } from 'vitest';
import { chatEndpoint } from './chat-endpoint';

describe('chatEndpoint', () => {
  it('scopes the chat to the project thread', () => {
    expect(chatEndpoint({ projectId: 'p1' })).toBe('/api/v1/projects/p1/agent');
  });

  it('a motion editor talks to the thread of its node', () => {
    expect(chatEndpoint({ projectId: 'p1', motionNodeId: 'n1' })).toBe('/api/v1/projects/p1/motion/n1/agent');
  });

  it('stays silent without any scope so the client never fetches', () => {
    expect(chatEndpoint({})).toBe('');
    expect(chatEndpoint({ projectId: '' })).toBe('');
  });
});
