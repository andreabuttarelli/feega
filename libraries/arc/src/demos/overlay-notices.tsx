import { useEffect } from 'react';
import Toast from '@/components/arc/toast/toast';
import { CookieConsent } from '@/components/arc/cookie-consent/cookie-consent';
import { ToastStack, ToastStackProvider, useToastStack } from '@/components/arc/toast-stack/toast-stack';
import { Cell, Page } from './layout';

const CELL_HEIGHT = 360;

const COOKIE_CATEGORIES = [
  { id: 'necessary', label: 'Strictly necessary', description: 'Keeps you signed in and your cart intact.', required: true },
  { id: 'analytics', label: 'Analytics', description: 'Anonymous usage statistics that help us improve Northwind.' },
  { id: 'marketing', label: 'Marketing', description: 'Measures the performance of our campaigns.' }
];

function StackSeed() {
  const { toast } = useToastStack();

  useEffect(() => {
    toast({ type: 'success', title: 'Invoice sent', description: 'INV-2051 was emailed to Acme Logistics.' });
    toast({ type: 'info', title: 'Sync complete', description: '1,204 contacts imported from HubSpot.' });
    toast({ type: 'error', title: 'Payment failed', description: 'Card ending 4242 was declined.', action: { label: 'Retry', onClick: () => {} } });
  }, [toast]);

  return null;
}

export function OverlayNoticesDemo() {
  return (
    <Page columns={2}>
      <Cell title="Toast" minHeight={CELL_HEIGHT}>
        <Toast title="Changes saved" description="Your Northwind workspace settings were updated." duration={0} />
      </Cell>

      <Cell title="Toast stack" minHeight={CELL_HEIGHT} position="relative">
        <ToastStackProvider duration={0}>
          <StackSeed />
          <ToastStack contained position="bottom-right" />
        </ToastStackProvider>
      </Cell>

      <Cell title="Cookie consent" span={2} minHeight={CELL_HEIGHT} position="relative">
        <CookieConsent
          categories={COOKIE_CATEGORIES}
          strategy="absolute"
          position="bottom-left"
          storageKey="northwind-demo-cookie-consent"
          policy={{ label: 'Cookie policy', href: '#' }}
        />
      </Cell>
    </Page>
  );
}
