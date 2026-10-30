const COMBINING_MARKS = /[̀-ͯ]/g;
const OUTSIDE_STORAGE_KEY = /[^\w/!\-.*'() &$@=;:+,?]+/g;

export const storageName = (name: string): string => name.normalize('NFKD').replace(COMBINING_MARKS, '').replace(OUTSIDE_STORAGE_KEY, '-');
