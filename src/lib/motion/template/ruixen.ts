import { shippedLibrary } from './shipped-library';
import RUIXEN_JSON from './ruixen/ruixen-doc.json?raw';

export const RUIXEN_GROUP = 'Ruixen';

export const RUIXEN_TEMPLATES = shippedLibrary(RUIXEN_GROUP, RUIXEN_JSON);
