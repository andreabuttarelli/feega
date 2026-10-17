/**
 * L'ICONA DI OGNI AZIONE, accanto al suo nome — stessa divisione di `addable-icons.ts`: componenti
 * di Lucide qui, dati puri in `selection-actions.ts`, perché quella tabella la legge anche codice
 * che non disegna niente.
 */
import Copy from '@lucide/svelte/icons/copy';
import Workflow from '@lucide/svelte/icons/workflow';
import Link2 from '@lucide/svelte/icons/link-2';
import Megaphone from '@lucide/svelte/icons/megaphone';
import Play from '@lucide/svelte/icons/play';
import ListEnd from '@lucide/svelte/icons/list-end';
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import Trash2 from '@lucide/svelte/icons/trash-2';
import Hash from '@lucide/svelte/icons/hash';
import Flag from '@lucide/svelte/icons/flag';
import Group from '@lucide/svelte/icons/group';
import Ungroup from '@lucide/svelte/icons/ungroup';
import Clipboard from '@lucide/svelte/icons/clipboard';
import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
import BringToFront from '@lucide/svelte/icons/bring-to-front';
import SendToBack from '@lucide/svelte/icons/send-to-back';
import type { Component } from 'svelte';
import type { SelectionActionId } from './selection-actions';

export const SELECTION_ACTION_ICON: Record<SelectionActionId, Component> = {
  duplicate: Copy,
  'connect-new': Workflow,
  'connect-existing': Link2,
  promote: Megaphone,
  'run-workflow': Play,
  'run-downstream': ListEnd,
  'run-stale': RefreshCw,
  'copy-id': Hash,
  report: Flag,
  group: Group,
  ungroup: Ungroup,
  copy: Clipboard,
  paste: ClipboardPaste,
  'bring-front': BringToFront,
  'send-back': SendToBack,
  delete: Trash2
};
