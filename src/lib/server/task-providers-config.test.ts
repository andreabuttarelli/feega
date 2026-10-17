import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { concurrencyCapOf } = await import('./task-providers-config');
const { TaskProviderName } = await import('./generation/task-providers');

describe('the concurrency cap of a provider', () => {
  it('defaults Higgsfield to the documented account limit', () => {
    expect(concurrencyCapOf(TaskProviderName.Higgsfield, {})).toBe(4);
  });

  it('follows the limit the console assigned to the account', () => {
    expect(concurrencyCapOf(TaskProviderName.Higgsfield, { HIGGSFIELD_MAX_CONCURRENCY: '10' })).toBe(10);
  });

  it('ignores a value that is not a positive count', () => {
    expect(concurrencyCapOf(TaskProviderName.Higgsfield, { HIGGSFIELD_MAX_CONCURRENCY: 'many' })).toBe(4);
  });

  it('leaves an uncapped provider uncapped', () => {
    expect(concurrencyCapOf(TaskProviderName.Wiro, {})).toBeNull();
  });
});
