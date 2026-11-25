import { SettingKey, type Settings } from '../../settings';
import { AgentEventKind, type AgentEvent } from './agent-session';

export enum AlertKind {
  Finished = 'finished',
  Permission = 'permission'
}

export type Alert = { kind: AlertKind; chat: string; text: string };

export type AlertPort = {
  looking?: () => boolean;
  show: (alert: Alert) => Promise<boolean>;
  clear: (chat: string) => void;
};

export type AlertSink = { raise: (alert: Alert) => Promise<void>; clear: (chat: string) => void };

export type Subject = { agent: string; project: string; chat: string };

const SILENT = '';

const STOPS: Record<string, string> = {
  end_turn: 'finished',
  cancelled: SILENT,
  refusal: 'was refused',
  max_tokens: 'ran out of room',
  max_turn_requests: 'hit its turn limit'
};

const FALLBACK_STOP = 'finished';
const FAILED = 'stopped with an error';
const FALLBACK_TOOL = 'continue';

const TOOLS: Record<string, string> = {
  read: 'read a file',
  edit: 'edit a file',
  delete: 'delete a file',
  move: 'move a file',
  search: 'search the project',
  execute: 'run a command',
  fetch: 'fetch a page',
  switch_mode: 'switch mode'
};

const SETTING_OF: Record<AlertKind, SettingKey> = {
  [AlertKind.Finished]: SettingKey.NotifyFinished,
  [AlertKind.Permission]: SettingKey.NotifyPermission
};

type Row = { kind: AlertKind; text: (event: AgentEvent, subject: Subject) => string | null };

const finished = (verb: string, { agent, project }: Subject) => (verb === SILENT ? null : `${agent} ${verb} in ${project}`);

const ROWS: Partial<Record<AgentEventKind, Row>> = {
  [AgentEventKind.Done]: { kind: AlertKind.Finished, text: (event, subject) => finished(event.kind === AgentEventKind.Done ? (STOPS[event.reason] ?? FALLBACK_STOP) : SILENT, subject) },
  [AgentEventKind.Failed]: { kind: AlertKind.Finished, text: (_event, subject) => finished(FAILED, subject) },
  [AgentEventKind.Permission]: { kind: AlertKind.Permission, text: (event, { agent }) => `${agent} needs permission to ${event.kind === AgentEventKind.Permission ? (TOOLS[event.tool.kind] ?? FALLBACK_TOOL) : FALLBACK_TOOL}` }
};

export function alertOf(event: AgentEvent, subject: Subject): Alert | null {
  const row = ROWS[event.kind];
  const text = row?.text(event, subject) ?? null;
  return row && text !== null ? { kind: row.kind, chat: subject.chat, text } : null;
}

export type AlertsDeps = { port: AlertPort | undefined; settings: () => Settings; opened: (chat: string) => void };

export function alerts({ port, settings, opened }: AlertsDeps): AlertSink {
  const wanted = (kind: AlertKind) => settings()[SettingKey.Notifications] === true && settings()[SETTING_OF[kind]] === true;

  return {
    raise: async (alert) => {
      if (!port || !wanted(alert.kind) || port.looking?.()) {
        return;
      }
      if (await port.show(alert)) {
        opened(alert.chat);
      }
    },
    clear: (chat) => port?.clear(chat)
  };
}
