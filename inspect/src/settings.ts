export enum SettingKey {
  Telemetry = 'feegaInspect.telemetry',
  Styling = 'feegaInspect.styling',
  DevCommand = 'feegaInspect.devCommand',
  DefaultSize = 'feegaInspect.defaultSize',
  KeepServerAlive = 'feegaInspect.keepServerAlive',
  SyncSelection = 'feegaInspect.syncSelection',
  SharedWarning = 'feegaInspect.sharedWarning'
}

export enum StylingChoice {
  Auto = 'auto',
  Tailwind = 'tailwind',
  Css = 'css'
}

export type SettingValue = string | boolean;

export type SettingRow = {
  key: SettingKey;
  label: string;
  hint: string;
  fallback: SettingValue;
  choices?: { value: string; label: string }[];
};

export const SETTINGS: SettingRow[] = [
  { key: SettingKey.Telemetry, label: 'Anonymous usage counts', hint: 'Sessions, edits, session length, editor, OS and device kind. No code, no paths.', fallback: true },
  {
    key: SettingKey.Styling,
    label: 'Write styles as',
    hint: 'Auto: Tailwind classes when the project has Tailwind; otherwise a rule in the component style block (Svelte, Vue), or an inline style in files without a stylesheet.',
    fallback: StylingChoice.Auto,
    choices: [
      { value: StylingChoice.Auto, label: 'Auto' },
      { value: StylingChoice.Tailwind, label: 'Tailwind classes' },
      { value: StylingChoice.Css, label: 'CSS' }
    ]
  },
  { key: SettingKey.DevCommand, label: 'Dev server command', hint: 'Empty: detected from package.json.', fallback: '' },
  {
    key: SettingKey.DefaultSize,
    label: 'Default device',
    hint: 'Size the preview opens at.',
    fallback: 'full',
    choices: [
      { value: 'full', label: 'Full' },
      { value: 'desktop', label: 'Desktop' },
      { value: 'tablet', label: 'Tablet' },
      { value: 'phone', label: 'Phone' }
    ]
  },
  {
    key: SettingKey.KeepServerAlive,
    label: 'Keep the dev server after closing',
    hint: 'Minutes the dev server Feega started stays warm after the panel closes, so reopening is instant. Closing the window always stops it.',
    fallback: '10',
    choices: [
      { value: '0', label: 'Stop on close' },
      { value: '10', label: '10 minutes' },
      { value: '30', label: '30 minutes' },
      { value: '60', label: '1 hour' }
    ]
  },
  {
    key: SettingKey.SyncSelection,
    label: 'Show the selection in the editor',
    hint: 'Selecting an element reveals its source beside Feega with the line selected, so coding agents that read the editor selection see it.',
    fallback: true
  },
  {
    key: SettingKey.SharedWarning,
    label: 'Warn when an edit reaches several instances',
    hint: 'A bar in Properties tells you when the element belongs to a component used more than once, and offers to detach this instance.',
    fallback: true
  }
];

export type Settings = Record<SettingKey, SettingValue>;

export const settingsWith = (read: (row: SettingRow) => SettingValue | undefined): Settings =>
  Object.fromEntries(SETTINGS.map((row) => [row.key, read(row) ?? row.fallback])) as Settings;

export const LINKS = {
  docs: 'https://docs.feega.app/integrations/inspect/',
  changelog: 'https://feega.app/changelog',
  dashboard: 'https://feega.app/',
  issues: 'https://github.com/andreabuttarelli/feega/issues/new'
};

export type ReportFacts = { version: string; framework: string; styling: string };

export function issueUrl({ version, framework, styling }: ReportFacts): string {
  const url = new URL(LINKS.issues);
  url.searchParams.set('title', 'Feega: ');
  url.searchParams.set('body', `**What happened**\n\n\n**Expected**\n\n\n---\nFeega ${version} · framework: ${framework} · styling: ${styling}`);
  url.searchParams.set('labels', 'inspect');
  return url.toString();
}
