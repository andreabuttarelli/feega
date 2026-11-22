export default defineNuxtConfig({
  devtools: { enabled: false },
  telemetry: false,
  css: ['~/assets/tokens.css', '~/assets/palette.css'],
  app: { head: { title: 'Ember Roasters', htmlAttrs: { lang: 'en', 'data-theme': 'light' }, bodyAttrs: { style: 'margin:0' }, link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Fragment+Mono&display=swap' }] } }
});
