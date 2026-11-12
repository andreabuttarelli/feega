import { SignupForm } from '@/components/arc/blocks/signup-form/signup-form';
import { LoginCentered } from '@/components/arc/blocks/login-centered/login-centered';
import { Cell, Page } from './layout';

export function BlocksAuthDemo() {
  return (
    <Page columns={1}>
      <Cell title="Signup form">
        <SignupForm />
      </Cell>

      <Cell title="Login centered">
        <LoginCentered />
      </Cell>
    </Page>
  );
}
