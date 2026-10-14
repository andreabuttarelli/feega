import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const UI_TYPE_ROLES = ['ui-section', 'ui-caption', 'ui-label', 'ui-body', 'ui-title'];

export const TW_MERGE_CONFIG = { extend: { theme: { text: UI_TYPE_ROLES } } };

const twMerge = extendTailwindMerge(TW_MERGE_CONFIG);

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};

export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
