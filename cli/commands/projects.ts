import { loadSession } from '../lib/auth.ts';
import { projectsApi } from '../lib/projects.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

export async function cmdProjects(opts: { org?: string }) {
  const { org, projects } = await projectsApi.list(await token(), opts.org);
  console.log(`${org.name} (${org.id})`);
  for (const p of projects) {
    console.log(`  ${p.id}  ${p.name}`);
  }
}

export async function cmdCanvases(projectId: string) {
  const { project, canvases } = await projectsApi.canvases(await token(), projectId);
  console.log(project.name);
  for (const c of canvases) {
    console.log(`  ${c.id}  ${c.name}  ${c.path}`);
  }
}
