import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'cut-lockup',
  title: 'Cut lockup',
  about: 'Hard cuts pull back from a macro of the logo, flip to a night blueprint that draws every glyph, then wipe up to the final lockup.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#f8f8f8',
  fonts: [],
  props: {
    size: { type: 'number', title: 'Logo width (share of frame)', default: 0.2335, minimum: 0.05, maximum: 0.9, step: 0.005, group: 'Style' },
    ink: { type: 'string', title: 'Ink', format: PropFormat.Color, default: '#1f1f1f', group: 'Style' },
    night: { type: 'string', title: 'Blueprint background', format: PropFormat.Color, default: '#242424', group: 'Style' },
    endPaper: { type: 'string', title: 'Final paper', format: PropFormat.Color, default: '#f8f8f8', group: 'Style' },
    roughness: { type: 'number', title: 'Ink roughness', default: 0.35, minimum: 0, maximum: 2, step: 0.05, group: 'Style' },
    nightAt: { type: 'number', title: 'Blueprint cut (frame)', default: 43, minimum: 1, maximum: 140, step: 1, group: 'Motion' },
    drawFrames: { type: 'number', title: 'Glyph draw (frames)', default: 7, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    drawSpread: { type: 'number', title: 'Draw spread (frames)', default: 22, minimum: 0, maximum: 90, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const LOGO = { width: 2868.3, height: 861, shapes: ['M440.1 713.5 460.2 711.8 481.3 709.1 497.9 705.6 511.1 701.2 524.2 695.1 540 687.2 553.2 678.4 562.8 670.6 563.7 670.6 565.4 668.8 566.3 668.8 582.1 653 582.1 652.1 586.5 648.6 586.5 647.8 593.5 640.7 604 624.1 611 611.8 611.9 611.8 618.9 596.9 626.8 576.8 631.2 558.3 632.1 546.1 630.3 544.3 573.3 545.2 572.5 546.9 570.7 556.6 567.2 569.7 557.6 590.8 544.4 610.1 526.9 626.7 526 626.7 519 632.9 505 641.6 483 650.4 461.1 655.7 436.6 656.5 409.4 653.9 387.5 648.6 367.3 639 349.8 627.6 332.3 610.1 332.3 609.2 326.1 601.3 317.3 587.3 311.2 573.2 306.8 561.8 303.3 545.2 246.3 544.3 244.6 546.1 244.6 551.3 247.2 565.4 253.4 586.4 259.5 601.3 268.3 617.1 278.8 634.6 287.5 644.3 287.5 645.1 290.2 647.8 290.2 648.6 306 664.4 306.8 664.4 313 670.6 313.8 670.6 323.5 678.4 341 689.8 356.8 697.7 375.2 703.9 391 708.2 407.6 710.9Z M874.9 518 876.7 516.3 876.7 498.7 874.9 497.9 808.3 497.9 765.3 495.2 741.7 492.6 729.4 489.1 715.4 484.7 697.8 476.8 682 466.3 668 452.3 651.4 428.6 650.5 426.8 647.8 423.3 647.8 421.6 632.1 397.9 630.3 397 628.6 392.7 619.8 381.3 613.7 374.2 613.7 373.4 600.5 359.3 600.5 358.5 583.9 342.7 583 342.7 579.5 338.3 578.6 338.3 568.1 328.7 557.6 321.6 556.7 319.9 539.1 309.4 526.9 302.4 510.2 296.2 482.2 287.5 454.1 283.9 422.5 283.9 399.8 286.6 381.3 291 366.4 296.2 349.8 302.4 334.9 311.1 316.5 322.5 304.2 332.2 303.3 332.2 301.6 334.8 300.7 334.8 293.7 342.7 292.8 342.7 268.3 368.1 268.3 369 256.9 381.3 248.1 392.7 246.3 397 244.6 397.9 228.8 421.6 228.8 423.3 226.2 426.8 225.3 428.6 221.8 433.9 220.9 435.6 212.2 447.9 199 462.8 198.1 462.8 194.6 466.3 189.4 470.7 179.7 476.8 161.3 484.7 139.4 490.8 123.6 494.3 101.7 497 68.4 497.9 1.8 497.9 0 498.7 0 516.3 1.8 518Z M545.3 493.5 331.4 493.5 323.5 491.7 313.8 487.3 305.1 479.4 301.6 473.3 299.8 468 299.8 452.3 304.2 434.7 312.1 418.1 319.1 408.4 321.7 406.7 321.7 405.8 337.5 390 351.5 381.3 355.9 378.6 359.4 376 375.2 368.1 397.1 361.1 413.8 356.7 425.2 355.8 445.3 355 462.9 356.7 484.8 362.8 505.8 369.9 525.1 381.3 544.4 395.3 559.3 411.1 564.6 418.1 570.7 429.5 576 447 576.8 452.3 576.8 465.4 575.1 473.3 572.5 477.7 569.8 481.2 562.8 487.3 553.2 491.7Z', 'M1004 307.3L1004 366.4L1059.1 365.8L1059.1 688.8L1136.3 688.8L1136.3 365.8L1212.9 366.4L1212.9 307.3L1136.3 308L1136.3 267.7Q1136.3 239.5 1149.8 229.4Q1163.2 219.4 1190.1 219.4Q1194.1 219.4 1198.8 219.4Q1203.5 219.4 1207.5 220.7L1211.6 220.7L1211.6 158.3Q1204.8 156.2 1193.8 155.2Q1182.7 154.2 1171.9 154.2Q1116.9 154.2 1088 181.8Q1059.1 209.3 1059.1 257L1059.1 308Z', 'M1421.8 695.5Q1487.6 695.5 1531.2 665.6Q1574.9 635.7 1589 586L1520.5 569.3Q1510.4 598.1 1485.9 615.6Q1461.4 633.1 1423.1 633.1Q1376.8 633.1 1347.9 604.2Q1319 575.3 1318.3 518.2L1591.7 518.2Q1596.4 453.7 1576.6 404.7Q1556.8 355.7 1516.5 328.2Q1476.2 300.6 1417.1 300.6Q1362 300.6 1322 325.1Q1282.1 349.7 1260.3 394.3Q1238.4 439 1238.4 498.7Q1238.4 561.2 1261.6 605.2Q1284.8 649.2 1326.1 672.3Q1367.4 695.5 1421.8 695.5ZM1318.3 464.5Q1320.4 414.8 1347.6 387.9Q1374.8 361.1 1415.7 361.1Q1459.4 361.1 1485.2 389.3Q1511.1 417.5 1511.8 464.5Z', 'M1834.1 695.5Q1899.9 695.5 1943.6 665.6Q1987.2 635.7 2001.3 586L1932.8 569.3Q1922.8 598.1 1898.3 615.6Q1873.7 633.1 1835.5 633.1Q1789.1 633.1 1760.2 604.2Q1731.4 575.3 1730.7 518.2L2004 518.2Q2008.7 453.7 1988.9 404.7Q1969.1 355.7 1928.8 328.2Q1888.5 300.6 1829.4 300.6Q1774.3 300.6 1734.4 325.1Q1694.4 349.7 1672.6 394.3Q1650.8 439 1650.8 498.7Q1650.8 561.2 1673.9 605.2Q1697.1 649.2 1738.4 672.3Q1779.7 695.5 1834.1 695.5ZM1730.7 464.5Q1732.7 414.8 1759.9 387.9Q1787.1 361.1 1828.1 361.1Q1871.7 361.1 1897.6 389.3Q1923.4 417.5 1924.1 464.5Z', 'M2230.3 807.7Q2322.4 807.7 2367.4 768.7Q2412.3 729.8 2412.3 665.3L2412.3 307.3L2339.8 307.3L2335.1 367.8Q2320.3 336.2 2288.4 318.4Q2256.5 300.6 2215.6 300.6Q2168.6 300.6 2134.3 323.1Q2100.1 345.6 2081.6 385.6Q2063.1 425.5 2063.1 477.3Q2063.1 529.6 2081.9 570.3Q2100.7 610.9 2136 634.1Q2171.2 657.2 2218.9 657.2Q2257.9 657.2 2287.8 640.8Q2317.7 624.3 2334.4 594.1L2334.4 666.6Q2334.4 709.6 2307.2 729.1Q2280 748.6 2234.4 748.6Q2197.4 748.6 2173.6 736.1Q2149.8 723.7 2143 696.2L2068.5 707.6Q2077.2 753.9 2118.2 780.8Q2159.2 807.7 2230.3 807.7ZM2237.7 594.8Q2190.7 594.8 2166.9 562.5Q2143 530.3 2143 477.9Q2143 425.5 2166.9 394.6Q2190.7 363.8 2235.7 363.8Q2280 363.8 2307.2 392Q2334.4 420.2 2334.4 465.8L2334.4 489.3Q2334.4 535 2307.9 564.9Q2281.4 594.8 2237.7 594.8Z', 'M2611.8 695.5Q2654.8 695.5 2690 678.4Q2725.3 661.3 2743.4 632.4Q2744.1 664.6 2762.6 679.4Q2781 694.2 2809.9 694.2Q2817.3 694.2 2829.1 692.5Q2840.8 690.8 2848.2 688.1L2848.2 632.4L2844.2 632.4Q2843.5 633.1 2841.2 633.4Q2838.8 633.7 2833.4 633.7Q2824.7 633.7 2818.3 628.4Q2811.9 623 2811.9 604.2L2811.9 417.5Q2811.9 359.7 2773.3 330.2Q2734.7 300.6 2660.8 300.6Q2589 300.6 2545 331.9Q2501 363.1 2499.7 419.5L2572.9 427.6Q2572.2 393.3 2596.7 376.9Q2621.2 360.4 2660.2 360.4Q2701.1 360.4 2717.2 374.8Q2733.4 389.3 2733.4 412.8Q2733.4 430.9 2724 441Q2714.6 451.1 2686.4 456.4L2607.1 471.2Q2572.2 477.3 2545 491.4Q2517.8 505.5 2502 529.3Q2486.2 553.1 2486.2 588.7Q2486.2 636.4 2519.1 666Q2552 695.5 2611.8 695.5ZM2632.6 635.1Q2603.7 635.1 2584.9 622.3Q2566.1 609.6 2566.1 582.7Q2566.1 563.9 2578.9 547.8Q2591.7 531.7 2629.3 524.3L2683.7 513.5Q2703.8 509.5 2716.6 506.1Q2729.3 502.8 2734.7 498.7L2734.7 571.3Q2726 600.8 2698.8 617.9Q2671.6 635.1 2632.6 635.1Z'] };
    const REF_W = 714;
    const size = Number(p.size);
    const ink = String(p.ink);
    const night = String(p.night);
    const endPaper = String(p.endPaper);
    const roughness = Number(p.roughness);
    const nightAt = Number(p.nightAt);
    const drawFrames = Number(p.drawFrames);
    const drawSpread = Number(p.drawSpread);
    const speed = Number(p.speed);
    const paper = ['#f6f6f6', '#f8f8f8', '#fcfcfc'];
    const grid = { color: 'rgba(0,0,0,0.014)', pitch: 22, width: 1 };
    const line = 'rgba(255,255,255,0.11)';
    const dot = 'rgba(255,255,255,0.22)';
    const nightScale = 1.154;
    const endScale = 1.1894;
    const steps = [
      { from: 0, scale: 9.525, x: 0.11536, y: -0.00035, drift: -0.0001655 },
      { from: 8, scale: 4.6105, x: 0.01566, y: 0.00175, drift: 0 },
      { from: 18, scale: 3.0057, x: -0.003, y: 0, drift: 0 },
      { from: 28, scale: 1, x: -0.0083, y: 0.00126, drift: 0 }
    ];
    const push: [number, number][] = [[36, 1], [37, 1.0006], [38, 1.0048], [39, 1.0087], [40, 1.0162], [41, 1.0313], [42, 1.0703]];
    const wipe: [number, number][] = [[91, 1], [92, 386 / 390], [93, 376 / 390], [94, 360 / 390], [95, 334 / 390], [96, 277 / 390], [97, 114 / 390], [98, 57 / 390], [99, 31 / 390], [100, 15 / 390], [101, 5 / 390], [102, 0]];
    const W = view.width;
    const H = view.height;
    const u = W / REF_W;
    const restW = size * W;
    const FID = 'cut-lockup-rough';

    const track = (pts: [number, number][], t: number) => {
      if (t <= pts[0][0]) {
        return pts[0][1];
      }
      for (let i = 1; i < pts.length; i++) {
        const [t1, v1] = pts[i];
        const [t0, v0] = pts[i - 1];
        if (t <= t1) {
          return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
        }
      }
      return pts[pts.length - 1][1];
    };

    const splitPath = (d: string) => {
      const toks = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+)(?:e-?\d+)?/g) ?? [];
      const subs: { d: string; dots: [number, number][]; minX: number }[] = [];
      let i = 0;
      let cmd = '';
      let x = 0;
      let y = 0;
      let sx = 0;
      let sy = 0;
      let cur: { d: string[]; dots: [number, number][] } | null = null;
      const n = () => Number(toks[i++]);
      const f = (v: number) => +v.toFixed(2);
      const flush = () => {
        if (cur) {
          subs.push({ d: cur.d.join(''), dots: cur.dots, minX: Math.min(...cur.dots.map((q) => q[0])) });
        }
        cur = null;
      };
      while (i < toks.length) {
        if (/[a-zA-Z]/.test(toks[i])) {
          cmd = toks[i++];
        }
        const rel = cmd === cmd.toLowerCase();
        const C = cmd.toUpperCase();
        const ox = rel ? x : 0;
        const oy = rel ? y : 0;
        if (C === 'Z') {
          (cur as { d: string[] } | null)?.d.push('Z');
          x = sx;
          y = sy;
          flush();
          continue;
        }
        if (C === 'M') {
          flush();
          x = ox + n();
          y = oy + n();
          sx = x;
          sy = y;
          cur = { d: [`M${f(x)} ${f(y)}`], dots: [[x, y]] };
          cmd = rel ? 'l' : 'L';
          continue;
        }
        if (!cur) {
          cur = { d: [`M${f(x)} ${f(y)}`], dots: [[x, y]] };
        }
        const c = cur as { d: string[]; dots: [number, number][] };
        if (C === 'L' || C === 'T') {
          x = ox + n();
          y = oy + n();
          c.d.push(`L${f(x)} ${f(y)}`);
        } else if (C === 'H') {
          x = ox + n();
          c.d.push(`L${f(x)} ${f(y)}`);
        } else if (C === 'V') {
          y = oy + n();
          c.d.push(`L${f(x)} ${f(y)}`);
        } else if (C === 'C') {
          const q = [ox + n(), oy + n(), ox + n(), oy + n(), ox + n(), oy + n()];
          [x, y] = [q[4], q[5]];
          c.d.push(`C${q.map(f).join(' ')}`);
        } else if (C === 'S' || C === 'Q') {
          const q = [ox + n(), oy + n(), ox + n(), oy + n()];
          [x, y] = [q[2], q[3]];
          c.d.push(`${C}${q.map(f).join(' ')}`);
        } else if (C === 'A') {
          const q = [n(), n(), n(), n(), n(), ox + n(), oy + n()];
          [x, y] = [q[5], q[6]];
          c.d.push(`A${q.join(' ')}`);
        } else {
          i++;
          continue;
        }
        if (Math.hypot(x - sx, y - sy) > 1e-6) {
          c.dots.push([x, y]);
        }
      }
      flush();
      return subs;
    };

    const subs = LOGO.shapes.flatMap((d) => splitPath(d)).sort((a, b) => a.minX - b.minX);
    const span = Math.max(...subs.map((q) => q.minX)) || 1;

    const place = (scale: number, x = 0, y = 0) => {
      const w = restW * scale;
      const k = w / LOGO.width;
      return { k, transform: `translate(${W / 2 + x * w} ${H / 2 + y * w}) scale(${k}) translate(${-LOGO.width / 2} ${-LOGO.height / 2})` };
    };

    const fillLogo = (scale: number, x: number, y: number) => {
      const rough = S.h('filter', { id: FID, x: '-5%', y: '-5%', width: '110%', height: '110%', filterUnits: 'objectBoundingBox' }, S.h('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.55 / u, numOctaves: 1, seed: 3 }), S.h('feDisplacementMap', { in: 'SourceGraphic', scale: roughness * u * 2, xChannelSelector: 'R', yChannelSelector: 'G' }));
      return S.h('svg', { width: W, height: H, style: { position: 'absolute', inset: 0, overflow: 'visible' } }, S.h('defs', null, rough), S.h('g', { filter: roughness > 0 ? `url(#${FID})` : undefined }, S.h('g', { transform: place(scale, x, y).transform }, S.h('path', { d: LOGO.shapes.join(' '), fill: ink, fillRule: 'evenodd' }))));
    };

    const paperBg = { background: `linear-gradient(to right, ${paper[0]}, ${paper[1]} 45%, ${paper[2]})` };
    const gridBg = { position: 'absolute', left: 0, top: 0, bottom: 0, width: 200 * u, backgroundImage: `repeating-linear-gradient(to right, ${grid.color} 0 ${grid.width * u}px, transparent ${grid.width * u}px ${grid.pitch * u}px), repeating-linear-gradient(to bottom, ${grid.color} 0 ${grid.width * u}px, transparent ${grid.width * u}px ${grid.pitch * u}px)`, maskImage: 'linear-gradient(to right, #000 85%, transparent)', WebkitMaskImage: 'linear-gradient(to right, #000 85%, transparent)' };

    const day = (fr: number) => {
      let s = steps[0];
      for (const st of steps) {
        if (fr >= st.from) {
          s = st;
        }
      }
      const m = track(push, fr);
      return S.fill(paperBg, S.h('div', { style: gridBg }), fillLogo(s.scale * (fr >= push[0][0] ? m : 1), s.x + s.drift * (fr - s.from), s.y));
    };

    const glyph = (q: { d: string; dots: [number, number][]; minX: number }, fr: number, sw: number) => {
      const a = S.clamp01((fr - (nightAt + 1 + (q.minX / span) * drawSpread)) / drawFrames);
      if (a <= 0) {
        return null;
      }
      const stroke = S.h('path', { d: q.d, pathLength: 1, fill: 'none', stroke: line, strokeWidth: sw, strokeDasharray: `${a} 1` });
      const dots = q.dots.filter((_, j) => a * q.dots.length > j).map(([dx, dy]) => S.h('circle', { cx: dx, cy: dy, r: 1.1 * sw, fill: dot }));
      return S.h('g', null, stroke, dots);
    };

    const blueprint = (fr: number) => {
      const pl = place(nightScale, -0.0072, 0.0005);
      const sw = u / pl.k;
      const svg = S.h('svg', { width: W, height: H, style: { position: 'absolute', inset: 0 } }, S.h('g', { transform: pl.transform }, subs.map((q) => glyph(q, fr, sw))));
      const top = track(wipe, fr);
      const end = top < 1 ? S.fill({ background: endPaper, clipPath: `inset(${top * 100}% 0 0 0)` }, fillLogo(endScale, -0.0072, 0.0004)) : null;
      return S.fill({ background: night }, svg, end);
    };

    return (frame) => {
      const fr = frame * speed;
      view.root.replaceChildren(fr < nightAt ? day(fr) : blueprint(fr));
    };
  }
};
