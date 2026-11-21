export enum SignInMethod {
  Browser = 'browser',
  AppleNative = 'apple-native'
}

export const APPLE_NATIVE_ENV = 'FEEGA_APPLE_NATIVE';

const FLAG_ON = '1';

export type MethodInput = { platform: string; flag: boolean; available: boolean };

type MethodRow = { method: SignInMethod; usable: (input: MethodInput) => boolean };

const ROWS: MethodRow[] = [
  { method: SignInMethod.AppleNative, usable: ({ platform, flag, available }) => platform === 'darwin' && flag && available },
  { method: SignInMethod.Browser, usable: () => true }
];

export const resolveMethod = (input: MethodInput): SignInMethod => ROWS.find((row) => row.usable(input))!.method;

export const appleFlag = (env: Record<string, string | undefined>): boolean => env[APPLE_NATIVE_ENV] === FLAG_ON;
