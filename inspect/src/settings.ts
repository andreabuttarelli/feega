import { POLICY_ROWS, Policy } from './host/ai/permission-policy';

export enum SettingKey {
  Telemetry = 'feegaInspect.telemetry',
  Styling = 'feegaInspect.styling',
  DevCommand = 'feegaInspect.devCommand',
  DefaultSize = 'feegaInspect.defaultSize',
  KeepServerAlive = 'feegaInspect.keepServerAlive',
  SyncSelection = 'feegaInspect.syncSelection',
  PreviewUnknown = 'feegaInspect.previewUnknown',
  AiPermissions = 'feegaInspect.aiPermissions',
  Notifications = 'feegaInspect.notifications',
  NotifyFinished = 'feegaInspect.notifyFinished',
  NotifyPermission = 'feegaInspect.notifyPermission',
  RouteGenerators = 'feegaInspect.routeGenerators'
}

export enum StylingChoice {
  Auto = 'auto',
  Tailwind = 'tailwind',
  Css = 'css'
}

export enum SettingGroup {
  General = 'General',
  DevServer = 'Dev server',
  Agents = 'AI agents',
  Notifications = 'Notifications'
}

export type SettingValue = string | boolean;

export type SettingRow = {
  key: SettingKey;
  group: SettingGroup;
  label: string;
  hint: string;
  fallback: SettingValue;
  choices?: { value: string; label: string }[];
};

export const SETTINGS: SettingRow[] = [
  { key: SettingKey.Telemetry, group: SettingGroup.General, label: 'Anonymous usage counts', hint: 'Sessions, edits, session length, editor, OS and device kind. No code, no paths.', fallback: true },
  {
    key: SettingKey.Styling, group: SettingGroup.General,
    label: 'Write styles as',
    hint: 'Auto: Tailwind classes when the project has Tailwind; otherwise a rule in the component style block (Svelte, Vue), or an inline style in files without a stylesheet.',
    fallback: StylingChoice.Auto,
    choices: [
      { value: StylingChoice.Auto, label: 'Auto' },
      { value: StylingChoice.Tailwind, label: 'Tailwind classes' },
      { value: StylingChoice.Css, label: 'CSS' }
    ]
  },
  { key: SettingKey.DevCommand, group: SettingGroup.DevServer, label: 'Dev server command', hint: 'Empty: detected from package.json.', fallback: '' },
  {
    key: SettingKey.DefaultSize, group: SettingGroup.General,
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
    key: SettingKey.KeepServerAlive, group: SettingGroup.DevServer,
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
    key: SettingKey.SyncSelection, group: SettingGroup.General,
    label: 'Show the selection in the editor',
    hint: 'Selecting an element reveals its source beside Feega with the line selected, so coding agents that read the editor selection see it.',
    fallback: true
  },
  {
    key: SettingKey.PreviewUnknown, group: SettingGroup.General,
    label: 'Preview edits with unknown impact',
    hint: 'When Feega cannot tell where an edit will land (global CSS, a class built from props or a function, a CSS variable), it shows the diff and waits for Apply.',
    fallback: true
  },
  {
    key: SettingKey.AiPermissions, group: SettingGroup.Agents,
    label: 'AI agent permissions',
    hint: 'Default for new projects: when the AI tab asks before an agent edits a file or runs a command. Each project remembers its own choice.',
    fallback: Policy.Ask,
    choices: POLICY_ROWS.map((row) => ({ value: row.id, label: row.name }))
  },
  { key: SettingKey.Notifications, group: SettingGroup.Notifications, label: 'Notifications', hint: 'Tell me when an AI agent needs me while I am in another window or tab. Messages name the agent and the project, never code or prompts.', fallback: true },
  { key: SettingKey.NotifyFinished, group: SettingGroup.Notifications, label: 'Notify when an agent finishes', hint: 'Needs Notifications on.', fallback: true },
  { key: SettingKey.NotifyPermission, group: SettingGroup.Notifications, label: 'Notify when an agent needs permission', hint: 'Needs Notifications on.', fallback: true },
  {
    key: SettingKey.RouteGenerators, group: SettingGroup.DevServer,
    label: 'Run route generators to find examples',
    hint: 'Pages calls entries and getStaticPaths through your dev server to list example pages of dynamic routes. SvelteKit and Astro. This runs your project code.',
    fallback: true
  }
];

export const groupedSettings = (): { group: SettingGroup; rows: SettingRow[] }[] =>
  Object.values(SettingGroup).map((group) => ({ group, rows: SETTINGS.filter((row) => row.group === group) }));

export type Settings = Record<SettingKey, SettingValue>;

export const settingsWith = (read: (row: SettingRow) => SettingValue | undefined): Settings =>
  Object.fromEntries(SETTINGS.map((row) => [row.key, read(row) ?? row.fallback])) as Settings;

export const LINKS = {
  docs: 'https://docs.feega.app/integrations/inspect/',
  plugins: 'https://docs.feega.app/integrations/plugins/',
  changelog: 'https://feega.app/changelog',
  dashboard: 'https://feega.app/',
  issues: 'https://github.com/andreabuttarelli/feega/issues/new',
  discord: 'https://discord.gg/PUp37DG6vr'
};

export type HelpLink = { label: string; url: string };

export function helpLinks(facts: ReportFacts | null): HelpLink[] {
  return [
    { label: 'Documentation', url: LINKS.docs },
    { label: "What's new", url: LINKS.changelog },
    { label: 'Send feedback', url: LINKS.discord },
    { label: 'Report a problem', url: facts ? issueUrl(facts) : LINKS.issues }
  ];
}

export type ReportFacts = { version: string; framework: string; styling: string };

export function issueUrl({ version, framework, styling }: ReportFacts): string {
  const url = new URL(LINKS.issues);
  url.searchParams.set('title', 'Feega: ');
  url.searchParams.set('body', `**What happened**\n\n\n**Expected**\n\n\n---\nFeega ${version} · framework: ${framework} · styling: ${styling}`);
  url.searchParams.set('labels', 'inspect');
  return url.toString();
}
