import { describe, expect, it } from 'vitest';
import { AGENT_MENTION_ID, agentInstruction, asksAgent, byAgent } from './comment-agent';

describe('a comment that calls the agent', () => {
  it.each(['@feega make this darker', 'can you @feega fix it', 'thanks @Feega!', '@feega'])('%s asks it', (body) => {
    expect(asksAgent(body)).toBe(true);
  });

  it.each(['mail me at a@feega.app', '@feegax do it', 'no mention', 'feega alone'])('%s does not', (body) => {
    expect(asksAgent(body)).toBe(false);
  });

  it('the instruction is the comment without the call', () => {
    expect(agentInstruction('@feega make this darker')).toBe('make this darker');
    expect(agentInstruction('please @feega  tighten the title')).toBe('please tighten the title');
  });

  it('an entry is by the agent only when it carries the agent marker', () => {
    expect(byAgent({ mentions: [AGENT_MENTION_ID] })).toBe(true);
    expect(byAgent({ mentions: ['someone'] })).toBe(false);
  });
});
