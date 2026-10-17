import { describe, expect, it } from 'vitest';
import { SIGNED_URL_TTL_S } from '$lib/server/repos/asset-storage';
import { inputTtlOf, TaskProviderName } from './task-providers';

describe('how long a provider may fetch our private media', () => {
  it('outlives a Higgsfield queue, which fetches inputs only when the request starts', () => {
    expect(inputTtlOf(TaskProviderName.Higgsfield)).toBe(SIGNED_URL_TTL_S.queuedProviderInput);
  });

  it('stays five minutes for a provider that fetches at submit', () => {
    expect(inputTtlOf(TaskProviderName.Wiro)).toBe(SIGNED_URL_TTL_S.providerInput);
    expect(inputTtlOf(null)).toBe(SIGNED_URL_TTL_S.providerInput);
  });
});
