import { addMessages, init } from 'svelte-i18n';
import { DEFAULT_LOCALE } from './locale';
import main from './locales/en.json';

addMessages(DEFAULT_LOCALE, main);

init({
  fallbackLocale: DEFAULT_LOCALE,
  initialLocale: DEFAULT_LOCALE
});
