import { untrack } from 'svelte';
import { withoutDismissed, type SelectionChip } from '$lib/chat-selection';

export class ChatSelection {
  #live = $state.raw<SelectionChip[]>([]);
  #dismissed = $state.raw<ReadonlySet<string>>(new Set());

  get chips(): SelectionChip[] {
    return withoutDismissed(this.#live, this.#dismissed);
  }

  publish(chips: SelectionChip[]) {
    const ids = new Set(chips.map((chip) => chip.id));
    this.#live = chips;
    untrack(() => {
      this.#dismissed = new Set([...this.#dismissed].filter((id) => ids.has(id)));
    });
  }

  dismiss(id: string) {
    this.#dismissed = new Set([...this.#dismissed, id]);
  }
}

export const chatSelection = new ChatSelection();
