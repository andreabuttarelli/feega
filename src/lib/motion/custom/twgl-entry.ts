import * as twgl from 'twgl.js';
import { TWGL_GLOBAL } from './twgl';

(window as unknown as Record<string, unknown>)[TWGL_GLOBAL] = { ...twgl, notices: ['twgl.js 7.0.0, Copyright (c) 2015, Gregg Tavares, MIT licence'] };
