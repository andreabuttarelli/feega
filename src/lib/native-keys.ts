import { env as publicEnv } from '$env/dynamic/public';
import type { NativeKeys } from './native-bridge';

export function nativeKeys(): NativeKeys {
  return { revenueCatKey: publicEnv.PUBLIC_REVENUECAT_APPLE_KEY ?? '' };
}
