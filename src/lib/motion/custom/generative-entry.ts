import { createNoise2D, createNoise3D, createNoise4D } from 'simplex-noise';
import PoissonDiskSampling from 'poisson-disk-sampling';
import { Delaunay } from 'd3-delaunay';
import simplify from 'simplify-js';
import { brute, bush, sweep } from 'isect';
import RBush from 'rbush';
import KDBush from 'kdbush';
import inside from 'robust-point-in-polygon';
import ClipperLib from 'clipper-lib';
import { GENERATIVE_GLOBAL } from './generative';

(window as unknown as Record<string, unknown>)[GENERATIVE_GLOBAL] = {
  createNoise2D,
  createNoise3D,
  createNoise4D,
  PoissonDiskSampling,
  Delaunay,
  simplify,
  isect: { brute, bush, sweep },
  RBush,
  KDBush,
  inside,
  ClipperLib,
  notices: ['Clipper 6.4.2, Copyright Angus Johnson 2010-2017, Boost Software License 1.0: http://www.boost.org/LICENSE_1_0.txt', 'jsbn (inside Clipper), Copyright Tom Wu 2005, BSD licence: http://www-cs-students.stanford.edu/~tjw/jsbn/LICENSE']
};
