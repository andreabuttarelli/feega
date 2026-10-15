export enum BarItem {
  History = 'history',
  Publish = 'publish',
  Export = 'export',
  FullScreen = 'full-screen'
}

export enum PhonePlace {
  Bar = 'bar',
  More = 'more',
  Off = 'off'
}

export const ON_PHONE: Record<BarItem, PhonePlace> = {
  [BarItem.History]: PhonePlace.Off,
  [BarItem.Publish]: PhonePlace.More,
  [BarItem.Export]: PhonePlace.More,
  [BarItem.FullScreen]: PhonePlace.More
};
