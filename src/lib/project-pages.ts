export enum ProjectPage {
  Assets = 'assets',
  Influencers = 'influencers',
  BrandNew = 'brand-new'
}

export const PROJECT_PAGE_PATH: Record<ProjectPage, string> = {
  [ProjectPage.Assets]: 'assets',
  [ProjectPage.Influencers]: 'influencers',
  [ProjectPage.BrandNew]: 'brands/new'
};

export function isProjectPage(name: string): name is ProjectPage {
  return Object.values(ProjectPage).includes(name as ProjectPage);
}
