export enum GridToggle {
  On = 'on',
  Off = 'off'
}

export const PIXEL_GRID_ZOOM = 8;

export const flipGrid = (toggle: GridToggle): GridToggle => (toggle === GridToggle.On ? GridToggle.Off : GridToggle.On);

export const pixelGridShown = (screenPerPixel: number, toggle: GridToggle): boolean => toggle === GridToggle.On && screenPerPixel >= PIXEL_GRID_ZOOM;
