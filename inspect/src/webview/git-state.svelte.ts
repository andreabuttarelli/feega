import { ToView, type GitAction, type GitView, type ViewMessage } from '../messages';

export type GitResult = { action: GitAction; ok: boolean; text: string; pull: boolean };

export const git = $state<{ view: GitView | null; result: GitResult | null; pending: boolean }>({ view: null, result: null, pending: false });

export function gitHeard(message: ViewMessage) {
  if (message.kind === ToView.Git) {
    git.view = message.view;
    return;
  }
  if (message.kind === ToView.GitResult) {
    git.result = { action: message.action, ok: message.ok, text: message.text, pull: message.pull };
    git.pending = false;
  }
}
