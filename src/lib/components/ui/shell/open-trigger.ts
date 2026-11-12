const EXPANDED_MENU_BUTTON = '[aria-haspopup="menu"][aria-expanded="true"]';

export const openTrigger = (menu: HTMLElement): Element | null => [...document.querySelectorAll(EXPANDED_MENU_BUTTON)].find((button) => !menu.contains(button)) ?? null;
