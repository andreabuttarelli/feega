export enum OnionSkin {
  On = 'on',
  Off = 'off'
}

class OnionSetting {
  skin = $state(OnionSkin.Off);

  toggle(): void {
    this.skin = this.skin === OnionSkin.On ? OnionSkin.Off : OnionSkin.On;
  }
}

export const onionSetting = new OnionSetting();
