import { composePrompt } from './compose-prompt';

export const CANVAS_TEXT_SYSTEM_PROMPT = '';

export function textRequest(material: string[], own: string): { system: string; user: string } {
  return {
    system: CANVAS_TEXT_SYSTEM_PROMPT,
    user: composePrompt('text', material, own)
  };
}
