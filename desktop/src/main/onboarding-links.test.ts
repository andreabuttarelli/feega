import { describe, expect, it } from 'vitest';
import { SUPPORT_ITEMS } from '../../../inspect/src/support';
import { MCP_DOCS_URL } from '../../../inspect/src/webview/onboarding-slides';
import { onboardingUrlAllowed } from './onboarding-links';

describe('onboarding links', () => {
  it('opens the MCP docs page', () => {
    expect(onboardingUrlAllowed(MCP_DOCS_URL)).toBe(true);
  });

  it('opens every support link the editor shows', () => {
    for (const item of SUPPORT_ITEMS.filter((entry) => entry.url)) {
      expect(onboardingUrlAllowed(item.url as string)).toBe(true);
    }
  });

  it('refuses anything else', () => {
    expect(onboardingUrlAllowed('https://evil.example')).toBe(false);
    expect(onboardingUrlAllowed('file:///etc/passwd')).toBe(false);
  });
});
