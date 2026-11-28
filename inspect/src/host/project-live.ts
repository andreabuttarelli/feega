import { ToView, type ViewMessage } from '../messages';
import type { ComponentRow } from './component-list';
import type { PageRoute } from './page-route';
import { watchProject, type Batch } from './project-watch';

type Deps = {
  appRoot: () => string;
  routes: () => Promise<PageRoute[]>;
  components: () => Promise<ComponentRow[]>;
  post: (message: ViewMessage) => void;
  touched?: (files: string[]) => void;
  debounceMs?: number;
};

enum Rescan {
  Routes = 'routes',
  All = 'all'
}

const signatureOf = (list: unknown[]) => JSON.stringify(list);

export function projectLive({ appRoot, routes, components, post, touched, debounceMs }: Deps) {
  let watching: { root: string; dispose: () => void } | null = null;
  let routesSeen: string | null = null;
  let componentsSeen: string | null = null;

  async function rescan(scope: Rescan) {
    if (routesSeen !== null) {
      const now = await routes();
      if (signatureOf(now) !== routesSeen) {
        routesSeen = signatureOf(now);
        post({ kind: ToView.Routes, routes: now });
      }
    }
    if (componentsSeen !== null && scope === Rescan.All) {
      const now = await components();
      if (signatureOf(now) !== componentsSeen) {
        componentsSeen = signatureOf(now);
        post({ kind: ToView.Components, components: now });
      }
    }
  }

  async function changed({ structure, content }: Batch) {
    if (structure.length || content.length) {
      await rescan(structure.length ? Rescan.All : Rescan.Routes).catch(() => undefined);
    }
    touched?.([...structure, ...content]);
    if (content.length) {
      post({ kind: ToView.FilesChanged, files: content });
    }
  }

  function stop() {
    watching?.dispose();
    watching = null;
  }

  return {
    routesSent: (list: PageRoute[]) => (routesSeen = signatureOf(list)),
    componentsSent: (list: ComponentRow[]) => (componentsSeen = signatureOf(list)),
    watch() {
      const root = appRoot();
      if (watching?.root === root) {
        return;
      }
      stop();
      watching = { root, ...watchProject(root, (batch) => void changed(batch), { debounceMs }) };
    },
    dispose: stop
  };
}
