import { ProxyMode } from './video-proxy';

class ProxySetting {
  mode = $state(ProxyMode.Proxy);

  get on(): boolean {
    return this.mode === ProxyMode.Proxy;
  }

  toggle(): void {
    this.mode = this.on ? ProxyMode.Original : ProxyMode.Proxy;
  }
}

export const proxySetting = new ProxySetting();
