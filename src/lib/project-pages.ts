export enum ProjectPage {
  Assets = 'assets',
  Influencers = 'influencers'
}

export const PROJECT_PAGE_PATH: Record<ProjectPage, string> = {
  [ProjectPage.Assets]: 'assets',
  [ProjectPage.Influencers]: 'influencers'
};

export function isProjectPage(name: string): name is ProjectPage {
  return Object.values(ProjectPage).includes(name as ProjectPage);
}
