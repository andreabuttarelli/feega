export enum FrameDialog {
  Export = 'export',
  Voice = 'voice',
  Music = 'music',
  Interactive = 'interactive',
  Components = 'components',
  Templates = 'templates',
  Branches = 'branches',
  History = 'history',
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
  'frame-branches': FrameDialog.Branches,
  'frame-history': FrameDialog.History,
  'frame-chat': FrameDialog.Chat,
  'frame-save-template': FrameDialog.SaveTemplate,
  'frame-publish': FrameDialog.Publish
} as const;

export type FrameDialogActionId = keyof typeof FRAME_DIALOG_ACTIONS;

export const isFrameDialogAction = (id: string): id is FrameDialogActionId => id in FRAME_DIALOG_ACTIONS;
