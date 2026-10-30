import { EditorMode } from './editor-mode.svelte';

export enum FrameDialog {
  Export = 'export',
  Voice = 'voice',
  Music = 'music',
  Interactive = 'interactive',
  Components = 'components',
  Templates = 'templates',
  Chat = 'chat',
  SaveTemplate = 'save-template',
  Publish = 'publish'
}

export const FRAME_DIALOG_ACTIONS = {
  'frame-voice': FrameDialog.Voice,
  'frame-music': FrameDialog.Music,
  'frame-interactive': FrameDialog.Interactive,
  'frame-components': FrameDialog.Components,
  'frame-templates': FrameDialog.Templates,
  'frame-chat': FrameDialog.Chat,
  'frame-save-template': FrameDialog.SaveTemplate,
  'frame-publish': FrameDialog.Publish
} as const;

export type FrameDialogActionId = keyof typeof FRAME_DIALOG_ACTIONS;

export const isFrameDialogAction = (id: string): id is FrameDialogActionId => id in FRAME_DIALOG_ACTIONS;

export const FRAME_MODE_ACTIONS = {
  'frame-code': EditorMode.Code
} as const;

export type FrameModeActionId = keyof typeof FRAME_MODE_ACTIONS;

export const isFrameModeAction = (id: string): id is FrameModeActionId => id in FRAME_MODE_ACTIONS;

export const isFrameAction = (id: string): boolean => isFrameDialogAction(id) || isFrameModeAction(id);
