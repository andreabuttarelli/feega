import { describe, expect, it } from 'vitest';
import { debranded, FICTIONAL, NEUTRAL_MARK } from './debrand';

describe('a vendored Ruixen file without third-party brands', () => {
  it('names an invented company where a real one stood as a logo', () => {
    expect(debranded('const c = [{ name: "Vercel" }, { name: "Stripe" }];')).toBe(`const c = [{ name: "${FICTIONAL.Vercel}" }, { name: "${FICTIONAL.Stripe}" }];`);
  });

  it('replaces a wordmark set as JSX text', () => {
    expect(debranded('<span>\n            ▲ Vercel\n          </span>')).toBe(`<span>\n            ▲ ${FICTIONAL.Vercel}\n          </span>`);
  });

  it('points a logo file at a mark drawn for Feega', () => {
    expect(debranded('<img src="/logos/gong.svg" alt="Gong" />')).toBe(`<img src="/marks/${FICTIONAL.Gong.toLowerCase()}.svg" alt="${FICTIONAL.Gong}" />`);
  });

  it('swaps a brand icon for a neutral one', () => {
    expect(debranded('import { GithubIcon, MailIcon } from "lucide-react";\n<GithubIcon className="h-4" />')).toBe('import { CodeIcon, MailIcon } from "lucide-react";\n<CodeIcon className="h-4" />');
  });

  it('replaces a wordmark set inline between tags', () => {
    expect(debranded('<span className="x">Salesforce</span>')).toBe(`<span className="x">${FICTIONAL.Salesforce}</span>`);
  });

  it('redraws an inline brand mark as a neutral shape', () => {
    const mark = 'function HubspotLogo() {\n  return (\n    <svg viewBox="0 0 10 10" className="size-3">\n      <path d="M7.6 3.2V2.1" fill="#FF7A59" />\n    </svg>\n  );\n}';
    expect(debranded(mark)).toBe('function HubspotLogo() {\n  return (\n    <svg viewBox="0 0 10 10" className="size-3">' + NEUTRAL_MARK + '</svg>\n  );\n}');
  });

  it('leaves a brand named in a sentence, and words that only look like one', () => {
    const prose = 'label: "Zoom out", "Plugins for Figma, Framer, Webflow", function Segment() {}, "Resend code"';
    expect(debranded(prose)).toBe(prose);
  });
});
