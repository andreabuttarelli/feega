import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));

import { track } from '@vercel/analytics';
import { PLUGINS } from '../plugins/plugins';
import PluginCard from '../plugins/PluginCard.svelte';
import PriceTag from '../pricing/PriceTag.svelte';
import CommandField from '../CommandField.svelte';
import SiteFooter from '../SiteFooter.svelte';
import CodeTabs from '../templates/CodeTabs.svelte';
import { Framework, type FrameworkCode } from '../templates/template';
import { trackFromElement } from './attrs';
import { EVENTS, MAX_PROPS_PER_EVENT, MAX_VALUE_LENGTH, type EventName } from './events';
import { navAttrs } from './nav';
import { DOCS_URL, DOWNLOAD_PATH } from '../links';
import { sendEvent, trackEvent } from './track';

const EVENT_NAMES = Object.keys(EVENTS) as EventName[];
const SNAKE_CASE = /^[a-z]+(_[a-z]+)*$/;
const EVENT_ATTRIBUTE = /data-event="([a-z_]+)"[^>]*?data-props="([^"]*)"/g;

const unescape = (text: string) => text.replaceAll('&quot;', '"').replaceAll('&amp;', '&');

const rendered = (html: string): [string, Record<string, string>][] =>
  [...html.matchAll(EVENT_ATTRIBUTE)].map(([, name, props]) => [name, JSON.parse(unescape(props))]);

const allEventsValid = (html: string) => rendered(html).every(([name, props]) => sendEvent(name, props));

describe('events table', () => {
  it('names the ten events', () => {
    expect(EVENT_NAMES.sort()).toEqual(
      ['alt_landing_cta', 'ask_ai_click', 'docs_click', 'download_click', 'github_click', 'install_copy', 'plugin_open', 'pricing_cta', 'template_copy', 'template_view_code'].sort()
    );
  });

  it('keeps names snake_case', () => {
    expect(EVENT_NAMES.every((name) => SNAKE_CASE.test(name))).toBe(true);
  });

  it('allows at most two properties per event', () => {
    expect(EVENT_NAMES.every((name) => EVENTS[name].length >= 1 && EVENTS[name].length <= MAX_PROPS_PER_EVENT)).toBe(true);
  });

  it('repeats no property key within an event', () => {
    expect(EVENT_NAMES.every((name) => new Set(EVENTS[name]).size === EVENTS[name].length)).toBe(true);
  });

  it('keeps value limit under the Vercel cap', () => {
    expect(MAX_VALUE_LENGTH).toBeLessThanOrEqual(255);
  });
});

describe('trackEvent', () => {
  beforeEach(() => vi.mocked(track).mockClear());

  it('sends a known event with its keys', () => {
    expect(trackEvent('plugin_open', { id: 'mesh-gradient' })).toBe(true);
    expect(track).toHaveBeenCalledWith('plugin_open', { id: 'mesh-gradient' });
  });

  it('rejects an unknown event', () => {
    expect(sendEvent('buy_now', { id: 'x' })).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('rejects a key the table does not allow', () => {
    expect(sendEvent('plugin_open', { id: 'x', email: 'a@b.c' })).toBe(false);
    expect(sendEvent('plugin_open', { name: 'x' })).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('rejects an event with a missing key', () => {
    expect(sendEvent('download_click', { target: 'download_page' })).toBe(false);
  });

  it('clips values to the cap', () => {
    sendEvent('install_copy', { command: 'x'.repeat(MAX_VALUE_LENGTH + 40) });
    expect(vi.mocked(track).mock.calls[0][1]?.command).toHaveLength(MAX_VALUE_LENGTH);
  });
});

describe('delegated click', () => {
  beforeEach(() => vi.mocked(track).mockClear());

  const clicked = (event: string, props: object, altPage: string | null = null): Element => {
    const attrs: Record<string, string> = { 'data-event': event, 'data-props': JSON.stringify(props) };
    const source = { getAttribute: (name: string) => attrs[name] ?? null, closest: () => (altPage ? { getAttribute: () => altPage } : null) };

    return { closest: () => source } as unknown as Element;
  };

  it('tracks the closest element carrying data-event', () => {
    expect(trackFromElement(clicked('docs_click', { place: 'footer' }))).toBe(true);
    expect(track).toHaveBeenCalledWith('docs_click', { place: 'footer' });
  });

  it('ignores clicks outside any tracked element', () => {
    expect(trackFromElement({ closest: () => null } as unknown as Element)).toBe(false);
    expect(trackFromElement(null)).toBe(false);
  });

  it('adds alt_landing_cta when a download is clicked inside an alt landing', () => {
    trackFromElement(clicked('download_click', { target: 'download_page', place: 'hero-install' }, 'lovable-claude-code'));

    expect(track).toHaveBeenCalledWith('download_click', { target: 'download_page', place: 'hero-install' });
    expect(track).toHaveBeenCalledWith('alt_landing_cta', { page: 'lovable-claude-code', cta: 'hero-install' });
  });
});

describe('nav links', () => {
  it('tags docs and download links only', () => {
    expect(navAttrs(DOCS_URL, 'header')['data-event']).toBe('docs_click');
    expect(navAttrs(DOWNLOAD_PATH, 'header')['data-event']).toBe('download_click');
    expect(navAttrs('/pricing', 'header')).toEqual({});
  });
});

describe('key CTAs carry their data attributes', () => {
  it('plugin card carries plugin_open with the plugin id', () => {
    const { body } = render(PluginCard, { props: { plugin: PLUGINS[0] } });

    expect(rendered(body)).toEqual([['plugin_open', { id: PLUGINS[0].id }]]);
  });

  it('price tag carries pricing_cta with the plan', () => {
    const { body } = render(PriceTag, { props: { amount: 'free', unit: 'forever', cta: 'go', href: '/x', plan: 'extension' } });

    expect(rendered(body)).toEqual([['pricing_cta', { plan: 'extension' }]]);
  });

  it('command field carries install_copy with the command', () => {
    const { body } = render(CommandField, { props: { command: 'npx feega' } });

    expect(rendered(body)).toEqual([['install_copy', { command: 'npx feega' }]]);
  });

  it('footer carries download, github and docs events', () => {
    const { body } = render(SiteFooter);

    expect(rendered(body).map(([name]) => name).sort()).toEqual(['docs_click', 'download_click', 'github_click']);
    expect(allEventsValid(body)).toBe(true);
  });

  it('code tabs carry template_view_code and template_copy with id and framework', () => {
    const code = Object.fromEntries(Object.values(Framework).map((f) => [f, [{ name: 'A', code: 'x' }]])) as unknown as FrameworkCode;
    const { body } = render(CodeTabs, { props: { id: 'hero-split', code, initial: Framework.Svelte } });
    const events = rendered(body);

    expect(events.filter(([name]) => name === 'template_view_code')).toHaveLength(Object.values(Framework).length);
    expect(events.filter(([name]) => name === 'template_copy')).toHaveLength(Object.values(Framework).length);
    expect(events).toContainEqual(['template_copy', { id: 'hero-split', framework: 'react' }]);
    expect(allEventsValid(body)).toBe(true);
  });
});
