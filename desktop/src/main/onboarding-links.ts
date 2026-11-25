import { SUPPORT_ITEMS } from '../../../inspect/src/support';
import { MCP_DOCS_URL } from '../../../inspect/src/webview/onboarding-slides';

const ALLOWED = new Set([MCP_DOCS_URL, ...SUPPORT_ITEMS.flatMap((item) => (item.url ? [item.url] : []))]);

export const onboardingUrlAllowed = (url: string): boolean => ALLOWED.has(url);
