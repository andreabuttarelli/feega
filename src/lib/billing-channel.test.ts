import { describe, expect, it } from 'vitest';
import { BillingChannel, billingChannelOf, StoreBilling, storeBillingOf } from './billing-channel';

const SAFARI = 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const NATIVE = `${SAFARI} FeegaNative/0.3.0`;

describe('billingChannelOf', () => {
  it('the web always pays with Stripe', () => {
    expect(billingChannelOf(SAFARI, StoreBilling.On)).toBe(BillingChannel.Web);
    expect(billingChannelOf(null, StoreBilling.On)).toBe(BillingChannel.Web);
  });

  it('the native shell keeps Stripe while store billing is off', () => {
    expect(billingChannelOf(NATIVE, StoreBilling.Off)).toBe(BillingChannel.Web);
  });

  it('the native shell pays through the store once store billing is on', () => {
    expect(billingChannelOf(NATIVE, StoreBilling.On)).toBe(BillingChannel.Store);
  });

  it('anything but the exact flag value reads as off', () => {
    expect(storeBillingOf('on')).toBe(StoreBilling.On);
    expect(storeBillingOf('true')).toBe(StoreBilling.Off);
    expect(storeBillingOf(undefined)).toBe(StoreBilling.Off);
  });
});
