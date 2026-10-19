import { describe, expect, it } from 'vitest';
import { keepSame } from './snapshot-keep';
import { AssetSize, canvasAssetUrl, grantedAssetPaths, grantedPath, isCanvasAssetPath, isGrantable, sized, useAssetGrant } from './asset-url';

describe('canvasAssetUrl', () => {
  it('a tier asks the server for the preview', () => {
    expect(canvasAssetUrl('p1', 'c1', 'a1', AssetSize.Px512)).toBe('/p/p1/c/c1/assets/a1?size=512');
  });

  it('full is the original file, for download and generation inputs', () => {
    expect(canvasAssetUrl('p1', 'c1', 'a1', AssetSize.Full)).toBe('/p/p1/c/c1/assets/a1');
  });
});

describe('sized', () => {
  it('turns a stored canvas asset path into its tile', () => {
    expect(sized('/p/p1/c/c1/assets/a1', AssetSize.Px512)).toBe('/p/p1/c/c1/assets/a1?size=512');
  });

  it('leaves an external or already signed url alone', () => {
    const external = 'https://cdn.example.com/x.jpg';
    expect(sized(external, AssetSize.Px512)).toBe(external);
  });

  it('does not stack two sizes on the same path', () => {
    expect(sized('/p/p1/c/c1/assets/a1?size=512', AssetSize.Thumb)).toBe('/p/p1/c/c1/assets/a1?size=thumb');
  });

  it('full strips the preview back to the original', () => {
    expect(sized('/p/p1/c/c1/assets/a1?size=512', AssetSize.Full)).toBe('/p/p1/c/c1/assets/a1');
  });
});

describe('preview identity across refetches', () => {
  it('the same tile url is the same asset, so a refetch keeps the decoded image', () => {
    const shown = { url: canvasAssetUrl('p1', 'c1', 'a1', AssetSize.Px512) };
    const fetched = { url: canvasAssetUrl('p1', 'c1', 'a1', AssetSize.Px512) };
    expect(keepSame(shown, fetched, Date.now())).toBe(shown);
  });
});

describe('in a bundle, canvas files carry the API host and the asset grant', () => {
  const API = 'https://feega.app';

  it('builds, resizes and rewrites asset paths to granted URLs, and stops when the grant is cleared', () => {
    useAssetGrant({ apiBase: API, grant: 'g1' });

    expect(canvasAssetUrl('p1', 'c1', 'a1', AssetSize.Px512)).toBe(`${API}/p/p1/c/c1/assets/a1?size=512&grant=g1`);
    expect(sized(`${API}/p/p1/c/c1/assets/a1?size=512&grant=g0`, AssetSize.Thumb)).toBe(`${API}/p/p1/c/c1/assets/a1?size=thumb&grant=g1`);
    expect(sized('/p/p1/c/c1/assets/a1', AssetSize.Full)).toBe(`${API}/p/p1/c/c1/assets/a1?grant=g1`);
    expect(grantedAssetPaths('{"url":"/p/p1/c/c1/assets/a1?size=256","other":"/p/p1/c/c1"}')).toBe(`{"url":"${API}/p/p1/c/c1/assets/a1?size=256&grant=g1","other":"/p/p1/c/c1"}`);
    expect(isCanvasAssetPath('/p/p1/c/c1/assets/a1')).toBe(true);
    expect(isCanvasAssetPath('/p/p1/c/c1')).toBe(false);

    useAssetGrant(null);
    expect(canvasAssetUrl('p1', 'c1', 'a1', AssetSize.Full)).toBe('/p/p1/c/c1/assets/a1');
  });
});

describe('the other server pages an app page opens by link or frame are granted too', () => {
  const API = 'https://feega.app';
  const OPENED = ['/p/p1/c/c1/motion/n1/preview', '/p/p1/c/c1/motion/n1/live', '/p/p1/c/c1/web-views/k1/shot.jpg', '/app/studio/b1/zip', '/account/export'];

  it('each one is grantable and gets the API host and grant in the bundle', () => {
    useAssetGrant({ apiBase: API, grant: 'g1' });
    for (const path of OPENED) {
      expect(isGrantable(path), path).toBe(true);
      expect(grantedPath(path)).toBe(`${API}${path}?grant=g1`);
    }
    expect(grantedPath('/app/studio/b1/zip?format=amazon')).toBe(`${API}/app/studio/b1/zip?format=amazon&grant=g1`);
    useAssetGrant(null);
  });

  it('nothing else is: an API route or a page keeps needing the bearer', () => {
    for (const path of ['/api/v1/me/root', '/p/p1/c/c1', '/app', '/p/p1/c/c1/motion/n1/session']) {
      expect(isGrantable(path), path).toBe(false);
    }
  });

  it('on the web the path is left alone', () => {
    expect(grantedPath('/account/export')).toBe('/account/export');
  });
});
