import { describe, expect, it } from 'vitest';
import { UpdateState, type UpdateInfo } from '../main/types';
import { NoticeAction, noticeFor, noticeKey, UPDATE_NOTICES } from './update-notice';

const info = (state: UpdateState, version = '0.2.0'): UpdateInfo => ({ state, version, message: '' });

describe('noticeFor', () => {
  it('has a row for every update state', () => {
    expect(Object.keys(UPDATE_NOTICES).sort()).toEqual(Object.values(UpdateState).sort());
  });

  it('announces a downloaded update with restart now and later', () => {
    const notice = noticeFor(info(UpdateState.Ready), new Set());

    expect(notice?.title).toBe('Feega 0.2.0 is ready');
    expect(notice?.body).toBe('Restart to update. It takes a few seconds.');
    expect(notice?.actions).toEqual([NoticeAction.Restart, NoticeAction.Later]);
  });

  it('offers an available update with update and later', () => {
    const notice = noticeFor(info(UpdateState.Available), new Set());

    expect(notice?.title).toBe('Feega 0.2.0 is available');
    expect(notice?.actions).toEqual([NoticeAction.Update, NoticeAction.Later]);
  });

  it('shows a failed update as a quiet row with retry only', () => {
    const notice = noticeFor(info(UpdateState.Failed, ''), new Set());

    expect(notice?.actions).toEqual([NoticeAction.Retry]);
    expect(notice?.quiet).toBe(true);
  });

  it.each([UpdateState.Idle, UpdateState.Checking, UpdateState.Downloading, UpdateState.UpToDate])('shows nothing while %s', (state) => {
    expect(noticeFor(info(state), new Set())).toBeNull();
  });
});

describe('later', () => {
  it('hides the dismissed version for the session', () => {
    const dismissed = new Set([noticeKey(info(UpdateState.Ready, '0.2.0'))]);

    expect(noticeFor(info(UpdateState.Ready, '0.2.0'), dismissed)).toBeNull();
  });

  it('shows again when a newer version is found after dismissing the old one', () => {
    const dismissed = new Set([noticeKey(info(UpdateState.Ready, '0.2.0'))]);

    expect(noticeFor(info(UpdateState.Ready, '0.3.0'), dismissed)?.title).toBe('Feega 0.3.0 is ready');
  });

  it('shows the ready notice after an available one was dismissed', () => {
    const dismissed = new Set([noticeKey(info(UpdateState.Available, '0.2.0'))]);

    expect(noticeFor(info(UpdateState.Ready, '0.2.0'), dismissed)).not.toBeNull();
  });

  it('never hides a failure', () => {
    const dismissed = new Set([noticeKey(info(UpdateState.Failed, ''))]);

    expect(noticeFor(info(UpdateState.Failed, ''), dismissed)).not.toBeNull();
  });
});
