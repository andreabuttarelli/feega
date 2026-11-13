export const FICTIONAL: Record<string, string> = {
  Vercel: 'Halcyon',
  Linear: 'Kestrel',
  Stripe: 'Ferrow',
  Notion: 'Tidewell',
  Figma: 'Quillon',
  Raycast: 'Brightloom',
  Resend: 'Postwick',
  Supabase: 'Basalto',
  Loom: 'Ostrava Labs',
  Pitch: 'Velmora',
  OpenAI: 'Corvane',
  GitHub: 'Brambleworks',
  'Tailwind CSS': 'Tessarine',
  tailwindcss: 'tessarine',
  Cloudflare: 'Nimbrel',
  Zapier: 'Quorvo',
  Salesforce: 'Ardentry',
  Hubspot: 'Plumvale',
  Bitbucket: 'Pailbrook',
  Gumroad: 'Rovenna',
  Gong: 'Belltide',
  Geckoboard: 'Saurio',
  Ternary: 'Thrennic',
  Wyre: 'Wenlow',
  Percy: 'Pellin',
  'Reform Collective': 'Mosscourt Collective',
  Coinflect: 'Pennaro',
  Getform: 'Formwick',
  'Sleepy Cat': 'Drowsy Fox',
  Cosmos: 'Starnook',
  Urban: 'Kerbside',
  Sheets: 'Tallysheet'
};

const NEUTRAL_ICON: Record<string, string> = {
  Github: 'Code',
  Twitter: 'AtSign',
  Linkedin: 'Briefcase',
  Facebook: 'Users',
  Instagram: 'Camera',
  Youtube: 'Play',
  Dribbble: 'Palette'
};

const BRAND_MARK = /((?:function|const)\s+(?:Github|Linkedin|Twitter|Facebook|Instagram|Youtube|Discord|Slack|Dribbble|Salesforce|Hubspot|Sheets)(?:Icon|Logo|Mark)\b[\s\S]*?<svg\b[^>]*>)[\s\S]*?(<\/svg>)/g;

export const NEUTRAL_MARK = '<circle cx="50%" cy="50%" r="40%" fill="currentColor" />';

export const markFile = (name: string) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const LOGO_FILE = /\/logos\/([a-z0-9-]+)\.svg/g;

const realOfFile = (slug: string) => Object.keys(FICTIONAL).find((real) => markFile(real) === `${slug}.svg`);

function wordmarks(content: string): string {
  return Object.entries(FICTIONAL).reduce((text, [real, invented]) => {
    const name = escaped(real);
    return text
      .replace(new RegExp(`"(▲ )?${name}"`, 'g'), `"$1${invented}"`)
      .replace(new RegExp(`>${name}<`, 'g'), `>${invented}<`).replace(new RegExp(`^(\\s*)(▲ )?${name}(\\s*)$`, 'gm'), `$1$2${invented}$3`);
  }, content);
}

function logoFiles(content: string): string {
  return content.replace(LOGO_FILE, (whole, slug: string) => {
    const real = realOfFile(slug);
    return real ? `/marks/${markFile(FICTIONAL[real])}` : whole;
  });
}

function icons(content: string): string {
  if (!/from\s+["']lucide-react["']/.test(content)) {
    return content;
  }
  return Object.entries(NEUTRAL_ICON).reduce((text, [brand, neutral]) => {
    const name = `${brand}(Icon)?`;
    return text
      .replace(/import\s*\{[^}]*\}\s*from\s*["']lucide-react["']/g, (line) => line.replace(new RegExp(`\\b${name}\\b`, 'g'), `${neutral}$1`))
      .replace(new RegExp(`(</?)${name}\\b`, 'g'), `$1${neutral}$2`)
      .replace(new RegExp(`(:\\s*)${name}(?=[\\s,}])`, 'g'), `$1${neutral}$2`);
  }, content);
}

const brandMarks = (content: string) => content.replace(BRAND_MARK, `$1${NEUTRAL_MARK}$2`);

export const debranded = (content: string) => brandMarks(icons(logoFiles(wordmarks(content))));
