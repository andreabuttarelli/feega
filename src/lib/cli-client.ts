export enum CliClient {
  Terminal = 'terminal',
  App = 'app'
}

const APP_STATE_PREFIX = 'app.';

export const appState = (id: string) => `${APP_STATE_PREFIX}${id}`;

export const clientOf = (state: string): CliClient => (state.startsWith(APP_STATE_PREFIX) ? CliClient.App : CliClient.Terminal);

type Copy = { title: string; heading: string; description: string; done: string; unreachable: string };

export const CLIENT_COPY: Readonly<Record<CliClient, Copy>> = {
  [CliClient.Terminal]: {
    title: 'Authorize CLI — feega',
    heading: 'feega CLI wants to access your account',
    description: 'The feega CLI will manage your brands and content from the terminal, with the same permissions as your account.',
    done: 'Go back to the terminal. This page closes in a moment.',
    unreachable: 'Could not reach the CLI. Make sure feega is running and try again.'
  },
  [CliClient.App]: {
    title: 'Connect Feega on your computer',
    heading: 'Connect Feega on your computer to your account',
    description: 'Feega running on your computer will use your account for its chat and AI, and can save your name and memory. Your local file stays on your computer.',
    done: 'Go back to Feega. This page closes in a moment.',
    unreachable: 'Could not reach Feega on your computer. Make sure it is still open and try again.'
  }
};
