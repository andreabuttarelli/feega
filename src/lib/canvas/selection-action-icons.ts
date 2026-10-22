/**
 * L'ICONA DI OGNI AZIONE, accanto al suo nome — stessa divisione di `addable-icons.ts`: componenti
 * di Lucide qui, dati puri in `selection-actions.ts`, perché quella tabella la legge anche codice
 * che non disegna niente.
 */
import BookmarkPlus from '@lucide/svelte/icons/bookmark-plus';
import Globe from '@lucide/svelte/icons/globe';
import Copy from '@lucide/svelte/icons/copy';
import Download from '@lucide/svelte/icons/download';
import Workflow from '@lucide/svelte/icons/workflow';
import Link2 from '@lucide/svelte/icons/link-2';
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
import AlignStartVertical from '@lucide/svelte/icons/align-start-vertical';
import AlignCenterVertical from '@lucide/svelte/icons/align-center-vertical';
import AlignEndVertical from '@lucide/svelte/icons/align-end-vertical';
import AlignStartHorizontal from '@lucide/svelte/icons/align-start-horizontal';
import AlignCenterHorizontal from '@lucide/svelte/icons/align-center-horizontal';
import AlignEndHorizontal from '@lucide/svelte/icons/align-end-horizontal';
import LayoutGrid from '@lucide/svelte/icons/layout-grid';
import FlipHorizontal2 from '@lucide/svelte/icons/flip-horizontal-2';
import FlipVertical2 from '@lucide/svelte/icons/flip-vertical-2';
import SquareDashed from '@lucide/svelte/icons/square-dashed';
import Square from '@lucide/svelte/icons/square';
import Mic from '@lucide/svelte/icons/mic';
import Music from '@lucide/svelte/icons/music';
import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
import Blocks from '@lucide/svelte/icons/blocks';
import LayoutTemplate from '@lucide/svelte/icons/layout-template';
import GitBranch from '@lucide/svelte/icons/git-branch';
import History from '@lucide/svelte/icons/history';
import MessageSquareText from '@lucide/svelte/icons/message-square-text';
import Proportions from '@lucide/svelte/icons/proportions';
import ListChecks from '@lucide/svelte/icons/list-checks';
import Frame from '@lucide/svelte/icons/frame';
import Columns2 from '@lucide/svelte/icons/columns-2';
import SquaresUnite from '@lucide/svelte/icons/squares-unite';
import SquaresSubtract from '@lucide/svelte/icons/squares-subtract';
import SquaresIntersect from '@lucide/svelte/icons/squares-intersect';
import SquaresExclude from '@lucide/svelte/icons/squares-exclude';
import Combine from '@lucide/svelte/icons/combine';
import ComponentIcon from '@lucide/svelte/icons/component';
import Unlink from '@lucide/svelte/icons/unlink';
import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
import PenLine from '@lucide/svelte/icons/pen-line';
import TypeIcon from '@lucide/svelte/icons/type';
import type { Component } from 'svelte';
import type { SelectionActionId } from './selection-actions';

export const SELECTION_ACTION_ICON: Record<SelectionActionId, Component> = {
  duplicate: Copy,
  'connect-new': Workflow,
  'connect-existing': Link2,
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
  'align-left': AlignStartVertical,
  'align-center': AlignCenterVertical,
  'align-right': AlignEndVertical,
  'align-top': AlignStartHorizontal,
  'align-middle': AlignCenterHorizontal,
  'align-bottom': AlignEndHorizontal,
  'tidy-up': LayoutGrid,
  'flip-horizontal': FlipHorizontal2,
  'flip-vertical': FlipVertical2,
  'use-as-mask': SquareDashed,
  'release-mask': Square,
  'select-matching': ListChecks,
  'frame-selection': Frame,
  'auto-layout': Columns2,
  'union': SquaresUnite,
  'subtract': SquaresSubtract,
  'intersect': SquaresIntersect,
  'exclude': SquaresExclude,
  'flatten': Combine,
  'outline-stroke': PenLine,
  'outline-text': TypeIcon,
  'create-component': ComponentIcon,
  'detach-instance': Unlink,
  'reset-instance': RotateCcw,
  'create-formats': Proportions,
  export: Download,
  'frame-voice': Mic,
  'frame-music': Music,
  'frame-interactive': SlidersHorizontal,
  'frame-components': Blocks,
  'frame-templates': LayoutTemplate,
  'frame-branches': GitBranch,
  'frame-history': History,
  'frame-chat': MessageSquareText,
  'frame-save-template': BookmarkPlus,
  'frame-publish': Globe,
  delete: Trash2
};
