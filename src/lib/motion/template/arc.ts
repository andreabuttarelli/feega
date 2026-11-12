import { shippedLibrary } from './shipped-library';
import ARC_JSON from './arc/arc-doc.json?raw';

export const ARC_GROUP = 'Arc';

export const ARC_TEMPLATES = shippedLibrary(ARC_GROUP, ARC_JSON);
