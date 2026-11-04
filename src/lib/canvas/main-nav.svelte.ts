import { mainLocation, type CanvasComponents, type MainLocation } from './project-components';

export type MainRequest = { compId: string; home: string | null };

export type MainPick = { nodeId: string; compId: string; key: number };

type Navigate = (frameId: string, compId: string) => void;

type Serving = { navigate: Navigate; here: () => string | null; load?: () => Promise<CanvasComponents[]> };

export const MAIN_PARAM = 'main';

class MainNav {
  canvases = $state<CanvasComponents[]>([]);
  #serving: Serving | null = null;
  #loading: Promise<void> | null = null;

  serve(serving: Serving): () => void {
    this.#serving = serving;
    this.#loading = null;
    return () => {
      if (this.#serving === serving) {
        this.#serving = null;
      }
    };
  }

  homeOf(request: MainRequest): string | null {
    return request.home ?? this.#serving?.here() ?? null;
  }

  refresh(): Promise<void> {
    const load = this.#serving?.load;
    this.#loading = load ? load().then((found) => void (this.canvases = found)) : Promise.resolve();
    return this.#loading;
  }

  where(request: MainRequest): MainLocation | null {
    if (!this.#loading) {
      void this.refresh();
    }
    const home = this.homeOf(request);
    return home ? mainLocation(this.canvases, home) : null;
  }

  go(request: MainRequest) {
    const home = this.homeOf(request);
    if (home) {
      this.#serving?.navigate(home, request.compId);
    }
  }
}

export const mainNav = new MainNav();

export const mainHref = (projectId: string, location: MainLocation, frameId: string, compId: string): string =>
  `/p/${projectId}/c/${location.canvasId}?frame=${encodeURIComponent(frameId)}&${MAIN_PARAM}=${encodeURIComponent(compId)}`;
