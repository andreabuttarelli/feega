import { describe, expect, it } from 'vitest';
import { START_URL_MAX, startHost, startUrlOf, startUrlRefusal } from './start-url';

describe('start_url accepts only a public web page', () => {
  it.each(['https://stripe.com', 'http://example.com/pricing?x=1', 'https://sub.example.co.uk/a#b'])('accepts %s', (raw) => {
    expect(startUrlOf(raw)).toBe(new URL(raw).toString());
  });

  it.each([
    null,
    '',
    'stripe.com:ftp',
    'localhost:5173',
    'localhost',
    'http//stripe',
    '   ',
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>1</script>',
    'ftp://example.com',
    'file:///etc/passwd',
    'http://localhost:5173',
    'http://app.localhost',
    'http://printer.local',
    'http://metadata.internal',
    'http://127.0.0.1',
    'http://10.0.0.1',
    'http://192.168.1.1',
    'http://172.16.0.1',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/',
    'http://0.0.0.0',
    'https://user:pass@example.com',
    `https://example.com/${'a'.repeat(START_URL_MAX)}`
  ])('refuses %s', (raw) => {
    expect(startUrlOf(raw)).toBeNull();
  });
});

describe('a bare domain gets https', () => {
  it.each([
    ['stripe.com', 'https://stripe.com/'],
    ['www.stripe.com', 'https://www.stripe.com/'],
    ['stripe.com/pricing', 'https://stripe.com/pricing'],
    ['  stripe.com  ', 'https://stripe.com/'],
    ['stripe.com:8080/x', 'https://stripe.com:8080/x']
  ])('accepts %s', (raw, expected) => {
    expect(startUrlOf(raw)).toBe(expected);
  });
});

describe('a refusal says why', () => {
  it.each([
    ['javascript:alert(1)', 'scheme'],
    ['http://localhost', 'internal host'],
    ['localhost', 'internal host'],
    ['intranet', 'internal host'],
    ['x'.repeat(START_URL_MAX + 1), 'too long'],
    ['https://u:p@example.com', 'credentials'],
    ['http://', 'not a url']
  ])('%s', (raw, reason) => {
    expect(startUrlRefusal(raw)).toBe(reason);
  });

  it('is null for an accepted value', () => {
    expect(startUrlRefusal('stripe.com')).toBeNull();
  });
});

describe('the project is named after the site', () => {
  it('drops www and keeps the host', () => {
    expect(startHost('https://www.stripe.com/pricing')).toBe('stripe.com');
  });
});
