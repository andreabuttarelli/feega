import { ContactSectionBlock } from '@/components/arc/blocks/contact-section/contact-section';
import { NewsletterSignupBlock } from '@/components/arc/blocks/newsletter-signup/newsletter-signup';
import { SignIn } from '@/components/arc/blocks/sign-in/sign-in';
import { Cell, Page } from './layout';

export function BlocksContactDemo() {
  return (
    <Page columns={1}>
      <Cell title="Contact section">
        <ContactSectionBlock />
      </Cell>

      <Cell title="Newsletter signup">
        <NewsletterSignupBlock />
      </Cell>

      <Cell title="Sign in">
        <SignIn />
      </Cell>
    </Page>
  );
}
