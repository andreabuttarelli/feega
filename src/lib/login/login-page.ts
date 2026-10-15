import { sanitizeWebsiteParam } from '$lib/website-param';
import { INVITE_ERROR_PARAM, inviteTokenIn } from './invite';
import { signInErrorIn, type SignInError } from './sign-in-error';

const INVITE_ERRORS = ['invalid', 'wrong_email'] as const;
type InviteError = (typeof INVITE_ERRORS)[number];

export type LoginPage = {
  cliPort: string;
  cliState: string;
  inviteToken: string | null;
  inviteError: InviteError | null;
  signInError: SignInError | null;
  homeHref: string | null;
  preferSignup: boolean;
};

function preferSignup(url: URL): boolean {
  if (url.searchParams.get('next') === 'onboarding') return true;
  if (url.searchParams.get('mode') === 'signup') return true;
  if (sanitizeWebsiteParam(url.searchParams.get('website'))) return true;
  return false;
}

function inviteErrorIn(url: URL): InviteError | null {
  const code = url.searchParams.get(INVITE_ERROR_PARAM);
  return INVITE_ERRORS.find((known) => known === code) ?? null;
}

export function loginPageOf(url: URL): LoginPage {
  return {
    cliPort: url.searchParams.get('cli_port') ?? '',
    cliState: url.searchParams.get('cli_state') ?? '',
    inviteToken: inviteTokenIn(url.searchParams),
    inviteError: inviteErrorIn(url),
    signInError: signInErrorIn(url),
    homeHref: null,
    preferSignup: preferSignup(url)
  };
}
