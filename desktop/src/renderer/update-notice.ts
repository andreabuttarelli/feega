import { UpdateState, type UpdateInfo } from '../main/types';

export enum NoticeAction {
  Restart = 'restart now',
  Update = 'update',
  Later = 'later',
  Retry = 'retry'
}

export type Notice = { title: string; body: string; actions: NoticeAction[]; quiet: boolean };

const ready = (version: string): Notice => ({ title: `Feega ${version} is ready`, body: 'Restart to update. It takes a few seconds.', actions: [NoticeAction.Restart, NoticeAction.Later], quiet: false });

const available = (version: string): Notice => ({ title: `Feega ${version} is available`, body: 'Update now. It downloads in the background.', actions: [NoticeAction.Update, NoticeAction.Later], quiet: false });

const failed = (): Notice => ({ title: 'Update failed', body: 'Feega could not update.', actions: [NoticeAction.Retry], quiet: true });

export const UPDATE_NOTICES: Record<UpdateState, (version: string) => Notice | null> = {
  [UpdateState.Idle]: () => null,
  [UpdateState.Checking]: () => null,
  [UpdateState.Downloading]: () => null,
  [UpdateState.Available]: available,
  [UpdateState.Ready]: ready,
  [UpdateState.UpToDate]: () => null,
  [UpdateState.Failed]: failed
};

export const noticeKey = (info: UpdateInfo) => `${info.state}:${info.version}`;

export const noticeFor = (info: UpdateInfo, dismissed: ReadonlySet<string>): Notice | null => {
  const notice = UPDATE_NOTICES[info.state](info.version);
  if (!notice) {
    return null;
  }
  const dismissible = notice.actions.includes(NoticeAction.Later);

  return dismissible && dismissed.has(noticeKey(info)) ? null : notice;
};
