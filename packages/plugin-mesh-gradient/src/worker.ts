import { runPlugin } from '@feega/plugin-api/client';
import { meshPlugin } from './plugin';

runPlugin((api) => meshPlugin(api));
