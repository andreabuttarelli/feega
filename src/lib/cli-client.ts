export enum CliClient {
  Terminal = 'terminal',
  App = 'app',
  Desktop = 'desktop'
}

const APP_STATE_PREFIX = 'app.';
const DESKTOP_STATE_PREFIX = 'desktop.';

export const appState = (id: string) => `${APP_STATE_PREFIX}${id}`;

export const desktopState = (id: string) => `${DESKTOP_STATE_PREFIX}${id}`;

export const clientOf = (state: string): CliClient => {
  if (state.startsWith(DESKTOP_STATE_PREFIX)) {
    return CliClient.Desktop;
  }

  return state.startsWith(APP_STATE_PREFIX) ? CliClient.App : CliClient.Terminal;
};

type Copy = {
  title: string;
  heading: string;
  description: (email: string) => string;
  done: string;
  unreachable: string;
  rejected: string;
};

const LOCAL_NETWORK_HINT = 'If your browser blocked it, allow "local network access" for oh.feega.app in the site settings, then try again.';

export const CLIENT_COPY: Readonly<Record<CliClient, Copy>> = {
  [CliClient.Terminal]: {
    title: 'Authorize CLI — Feega',
    heading: 'Authorize the Feega CLI',
    description: (email) => `The CLI will act as ${email}, with the same permissions as your account.`,
    done: 'Go back to the terminal.',
    unreachable: `Could not reach the CLI. Make sure feega is running and try again. ${LOCAL_NETWORK_HINT}`,
    rejected: 'The CLI refused this sign-in. Run feega login again.'
  },
  [CliClient.App]: {
    title: 'Sign in to Feega',
    heading: 'Sign in to Feega in your editor',
    description: (email) => `Your editor will be signed in as ${email}. Nothing else leaves your computer.`,
    done: 'You can go back to your editor.',
    unreachable: `Your browser could not reach your editor. ${LOCAL_NETWORK_HINT} Or open it with one of the buttons below.`,
    rejected: 'Your editor refused this sign-in, or it expired. Start the sign-in again from your editor.'
  },
  [CliClient.Desktop]: {
    title: 'Sign in to Feega',
    heading: 'Sign in to the Feega app',
    description: (email) => `The Feega app will be signed in as ${email}. Nothing else leaves your computer.`,
    done: 'You can go back to the Feega app.',
    unreachable: `Your browser could not reach the Feega app. ${LOCAL_NETWORK_HINT} Or open it with the button below.`,
    rejected: 'The Feega app refused this sign-in, or it expired. Start the sign-in again from the app.'
  }
};
