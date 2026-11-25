export type ComposerKey = { key: string; shiftKey: boolean; isComposing: boolean };

export const sendsOnKey = (e: ComposerKey): boolean => e.key === 'Enter' && !e.shiftKey && !e.isComposing;
