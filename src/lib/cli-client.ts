export enum CliClient {
  Terminal = 'terminal',
  App = 'app'
}

const APP_STATE_PREFIX = 'app.';

export const appState = (id: string) => `${APP_STATE_PREFIX}${id}`;

export const clientOf = (state: string): CliClient => (state.startsWith(APP_STATE_PREFIX) ? CliClient.App : CliClient.Terminal);

type Copy = { title: string; heading: string; description: (email: string) => string; done: string; unreachable: string };

export const CLIENT_COPY: Readonly<Record<CliClient, Copy>> = {
  [CliClient.Terminal]: {
    title: 'Authorize CLI — feega',
    heading: 'feega CLI wants to access your account',
    description: () => 'The feega CLI will manage your brands and content from the terminal, with the same permissions as your account.',
    done: 'Go back to the terminal. This page closes in a moment.',
    unreachable: 'Could not reach the CLI. Make sure feega is running and try again.'
  },
  [CliClient.App]: {
    title: 'Sign in to Feega',
    heading: 'Sign in to Feega in your editor',
    description: (email) => `Your editor will be signed in as ${email}. Nothing else leaves your computer.`,
    done: 'Go back to your editor. This page closes in a moment.',
    unreachable: 'Could not reach your editor from the browser. Open it with one of the buttons below.'
  }
};
