import type { ChatModelChoice } from '$lib/chat-model';

export enum TurnKind {
  Edit = 'edit',
  Open = 'open'
}

export enum Pick {
  Auto = 'auto',
  User = 'user'
}

export function pickOf(askedModel: unknown): Pick {
  return askedModel === undefined ? Pick.Auto : Pick.User;
}

export const EDIT_MODEL = 'anthropic/claude-sonnet-5.5';

const EDIT_MAX_CHARS = 120;

const EDIT_INTENT = /\b(change|set|replace|rename|export|download|move|resize|delete|remove|make|swap|fix|recolou?r|png|jpe?g)\b/i;

const OPEN_INTENT = /\b(create|design|new|video|promo|campaign|plan|write|generate|brainstorm|ideas?|template|rethink|redesign|story|scenes?|everything)\b/i;

function isEdit(message: string): boolean {
  return message.length <= EDIT_MAX_CHARS && EDIT_INTENT.test(message) && !OPEN_INTENT.test(message.replace(/"[^"]*"|“[^”]*”/g, ''));
}

export function turnKind(message: string): TurnKind {
  return isEdit(message.trim()) ? TurnKind.Edit : TurnKind.Open;
}

const ROUTE: Record<TurnKind, (choice: ChatModelChoice) => ChatModelChoice> = {
  [TurnKind.Edit]: (choice) => ({ ...choice, model: EDIT_MODEL }),
  [TurnKind.Open]: (choice) => choice
};

export function turnModel(choice: ChatModelChoice, pick: Pick, message: string): ChatModelChoice {
  if (pick === Pick.User) {
    return choice;
  }
  return ROUTE[turnKind(message)](choice);
}
