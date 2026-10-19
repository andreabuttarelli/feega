import { isNativeShell } from './native-shell';

export enum BillingChannel {
  Web = 'web',
  Store = 'store'
}

export enum StoreBilling {
  On = 'on',
  Off = 'off'
}

export const storeBillingOf = (value: string | undefined): StoreBilling =>
  value === StoreBilling.On ? StoreBilling.On : StoreBilling.Off;

export function billingChannelOf(userAgent: string | null, storeBilling: StoreBilling): BillingChannel {
  if (storeBilling === StoreBilling.On && isNativeShell(userAgent)) {
    return BillingChannel.Store;
  }
  return BillingChannel.Web;
}
