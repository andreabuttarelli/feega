export const AGENT_MENTION_ID = '00000000-0000-4000-8000-0000000fee9a';
export const AGENT_NAME = 'feega';

const CALL = /(^|\s)@feega(?![\p{L}\p{N}_])/iu;
const CALLS = /(^|\s)@feega(?![\p{L}\p{N}_])\s*/giu;

export function asksAgent(body: string): boolean {
  return CALL.test(body);
}

export function agentInstruction(body: string): string {
  return body.replace(CALLS, '$1').replace(/\s+/g, ' ').trim();
}

export function byAgent(entry: { mentions: string[] }): boolean {
  return entry.mentions.includes(AGENT_MENTION_ID);
}

export const agentTeammate = () => ({ id: AGENT_MENTION_ID, name: AGENT_NAME });
