export const INVITE_PARAM = 'invite_token';
export const INVITE_ERROR_PARAM = 'invite_error';

export function inviteTokenIn(params: URLSearchParams | FormData): string | null {
  const token = params.get(INVITE_PARAM);
  return typeof token === 'string' && token ? token : null;
}
