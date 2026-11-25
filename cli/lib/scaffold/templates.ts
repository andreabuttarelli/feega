export enum Template {
  Blank = 'blank',
  Landing = 'landing',
  Portfolio = 'portfolio',
  Dashboard = 'dashboard'
}

export const TEMPLATES: Record<Template, string[]> = {
  [Template.Blank]: [],
  [Template.Landing]: ['navbar', 'hero-centered', 'features-grid', 'pricing', 'cta-band', 'footer'],
  [Template.Portfolio]: ['navbar-minimal', 'hero-minimal', 'gallery', 'quote-block', 'contact-form', 'footer-minimal'],
  [Template.Dashboard]: ['navbar-app', 'stats-cards', 'data-table', 'notification-list']
};

export const TEMPLATE_LABELS: Record<Template, string> = {
  [Template.Blank]: 'Blank',
  [Template.Landing]: 'Landing',
  [Template.Portfolio]: 'Portfolio',
  [Template.Dashboard]: 'Dashboard'
};
