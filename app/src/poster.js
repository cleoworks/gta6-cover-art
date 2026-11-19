// VICE COVER poster renderer: draws a multi-panel GTA-style poster onto any
// 2D canvas. Pure drawing code — no network, no DOM input, no Rockstar assets.
// A poster is: photo panels graded through a per-grade gradient-map LUT with
// tonal posterizing (cel feel; the Poster Ink grade goes further — a firm
// screen-print posterize plus a luminance-masked halftone that lives in the
// highlights only; Noir and Poster Ink protect their shadows, cross-fading
// the posterized ramp to a smooth one at low luminance so shaded faces
// keep their features), firm gutters, a slit sun sitting on the sea panel's
// horizon, code-drawn palms, a print finishing pass (grain + vignette), then
// layered lettering: a sunset-gradient title with a double outline and a
// neon script tagline.

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

export const LAYOUTS = {
  trio: { panels: 3, slant: 0.045, label: 'Vice Trio' },
  duo: { panels: 2, slant: 0.055, label: 'Split Duo' },
  solo: { panels: 1, slant: 0, label: 'Solo Hero' },
  grid: { panels: 5, slant: 0, label: 'Cover Grid' },
  mosaic: { panels: 9, slant: 0, label: 'Mosaic' },
};

// Each grade carries a gradient-map ramp (shadow -> midtone -> highlight)
// sampled by photo luminance, a mix (how hard the ramp replaces the photo's
// own colours) and the legacy colours used for sky, sun and accents.
export const GRADES = {
  sunset: {
    label: 'Sunset',
    sky: ['#2b1055', '#7597de'],
    skyTop: '#1c0b3d',
    sun: '#ffd166',
    sunCore: '#fff3b0',
    sunStops: ['#fff3b0', '#ffd166', '#ff944c'],
    ramp: [[0, [16, 10, 46]], [0.28, [94, 42, 132]], [0.52, [199, 62, 125]], [0.76, [255, 126, 71]], [1, [255, 217, 160]]],
    mix: 0.52,
    accent: '#ff2e63',
    tagText: '#1c0b3d',
    scrim: '10, 4, 20',
  },
  neon: {
    label: 'Neon Nights',
    sky: ['#0f0c29', '#302b63'],
    skyTop: '#080614',
    sun: '#00f5ff',
    sunCore: '#d8fbff',
    sunStops: ['#d8fbff', '#00f5ff', '#0891b2'],
    ramp: [[0, [5, 9, 20]], [0.3, [18, 58, 110]], [0.55, [150, 74, 148]], [0.78, [236, 128, 142]], [1, [165, 251, 255]]],
    mix: 0.36,
    accent: '#00f5ff',
    tagText: '#080614',
    scrim: '6, 2, 24',
  },
  gold: {
    label: 'Palm Gold',
    sky: ['#3a2503', '#8a5a00'],
    skyTop: '#241703',
    sun: '#ffe9a3',
    sunCore: '#fffbe0',
    sunStops: ['#fffbe0', '#ffe9a3', '#e8a100'],
    ramp: [[0, [29, 18, 4]], [0.3, [94, 60, 7]], [0.55, [168, 110, 20]], [0.78, [232, 169, 61]], [1, [255, 243, 196]]],
    mix: 0.5,
    accent: '#ffb700',
    tagText: '#241703',
    scrim: '20, 12, 2',
  },
  noir: {
    label: 'Noir',
    sky: ['#0a0a0a', '#4a4a4a'],
    skyTop: '#050505',
    sun: '#e8e8e8',
    sunCore: '#ffffff',
    sunStops: ['#ffffff', '#c9c9c9', '#6e6e6e'],
    sunRim: 'rgba(235, 235, 235, 0.9)',
    // The ramp's floor is lifted and its shadow stops are widened, and the
    // grade carries shadow protection (see `protect` in gradedPanelCanvas):
    // a hard six-step posterize over a monochrome ramp used to crush
    // shadowed faces into a single grey plateau.
    ramp: [[0, [26, 26, 26]], [0.22, [74, 74, 74]], [0.45, [130, 130, 130]], [0.7, [192, 192, 192]], [1, [255, 255, 255]]],
    ease: [0.2, 0.8],
    protect: [0.05, 0.55],
    mix: 1,
    accent: '#f2f2f2',
    tagText: '#0a0a0a',
    scrim: '0, 0, 0',
  },
  ink: {
    // Poster Ink: a screen-print finish. A bold duotone ink ramp (deep
    // indigo ink shadows -> warm terracotta midtones -> paper-cream
    // highlights), a firmer posterize than the other grades, and a halftone
    // dot screen masked to the highlights (see applyHalftone).
    label: 'Poster Ink',
    sky: ['#171233', '#3d2a6e'],
    skyTop: '#0d0a24',
    sun: '#f7e3ac',
    sunCore: '#fdf3d0',
    sunStops: ['#fdf3d0', '#f5b95e', '#e2703a'],
    // The ink floor is lifted (deep indigo, not near-black) and the warm
    // terracotta stop arrives earlier, with shadow protection like Noir:
    // at four firm steps a backlit face otherwise falls entirely into the
    // darkest plateau and its features drown.
    ramp: [[0, [40, 32, 78]], [0.22, [78, 58, 128]], [0.42, [198, 104, 86]], [0.7, [242, 170, 96]], [1, [250, 236, 204]]],
    ease: [0.26, 0.74],
    protect: [0.04, 0.6],
    mix: 0.88,
    steps: 4,
    halftone: true,
    accent: '#f5b95e',
    tagText: '#0d0a24',
    scrim: '10, 7, 30',
  },
};

/** Panel polygons for a layout. Trio/Duo are slanted quads leaning right as
 *  they fall; Grid is one hero panel plus four satellites around it; Mosaic
 *  is a 3x3 grid of nine equal cells (the GTA V cover pattern). */
export function panelShapes(w, h, layout) {
  if (layout === 'grid') return { shapes: gridShapes(w, h), slant: 0, count: 5 };
  if (layout === 'mosaic') return { shapes: mosaicShapes(w, h), slant: 0, count: 9 };
  const spec = LAYOUTS[layout] ?? LAYOUTS.trio;
  const n = spec.panels;
  const slant = w * spec.slant;
  const pw = w / n;
  const shapes = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * pw;
    const x1 = (i + 1) * pw;
    shapes.push({
      x: x0, y: 0, w: pw + slant, h,
      poly: [[x0, 0], [x1, 0], [x1 + slant, h], [x0 + slant, h]],
      dividerTop: x1,
    });
  }
  return { shapes, slant, count: n };
}

function gridShapes(w, h) {
  const rect = (x, y, pw, ph, main) => ({
    x, y, w: pw, h: ph, main: !!main,
    poly: [[x, y], [x + pw, y], [x + pw, y + ph], [x, y + ph]],
  });
  if (w > h) {
    // Landscape: hero on the left (~55% wide, full height), 2x2 satellites right.
    const mw = w * 0.55;
    const cw = (w - mw) / 2;
    const ch = h / 2;
    return [rect(0, 0, mw, h, true),
      rect(mw, 0, cw, ch), rect(mw + cw, 0, cw, ch),
      rect(mw, ch, cw, ch), rect(mw + cw, ch, cw, ch)];
  }
  if (w < h) {
    // Portrait: hero on top (~52% high), 2x2 satellites below.
    const mh = h * 0.52;
    const cw = w / 2;
    const ch = (h - mh) / 2;
    return [rect(0, 0, w, mh, true),
      rect(0, mh, cw, ch), rect(cw, mh, cw, ch),
      rect(0, mh + ch, cw, ch), rect(cw, mh + ch, cw, ch)];
  }
  // Square: hero on top (~55% high), four satellites in a row below.
  const mh = h * 0.55;
  const cw = w / 4;
  return [rect(0, 0, w, mh, true),
    rect(0, mh, cw, h - mh), rect(cw, mh, cw, h - mh),
    rect(2 * cw, mh, cw, h - mh), rect(3 * cw, mh, cw, h - mh)];
}

/** Mosaic: nine equal cells in a 3x3 grid, whatever the canvas aspect —
 *  each cell simply takes the canvas's own proportions divided by three. */
function mosaicShapes(w, h) {
  const cw = w / 3;
  const ch = h / 3;
  const shapes = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = col * cw;
      const y = row * ch;
      shapes.push({
        x, y, w: cw, h: ch,
        poly: [[x, y], [x + cw, y], [x + cw, y + ch], [x, y + ch]],
      });
    }
  }
  return shapes;
}

function tracePoly(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

/** The photo assignment for panel i: panels beyond the loaded list rotate
 *  through the loaded photos with a tighter, shifted crop — the GTA cover
 *  pattern of reusing one shoot across several panels. */
export function panelPhoto(state, i) {
  const list = state.panels ?? [];
  if (!list.length) return null;
  const p = list[i % list.length];
  if (!p) return null;
  if (state.layout === 'mosaic' && i === 3 && i < list.length) {
    // Panel 4's shared re-crop (zoom 1.35, oy 0.4) is framed for the Grid's
    // narrower satellites; in a wide Mosaic cell the width-driven cover-fit
    // pushes the subject's eyes out of the top. Reframe it for Mosaic only.
    return { img: p.img, zoom: 1.15, ox: p.ox ?? 0.3, oy: 0.72 };
  }
  if (i < list.length) return p;
  const k = Math.floor(i / list.length);
  if (state.layout === 'mosaic') {
    // Mosaic's rotated cells are short in landscape, where the standard
    // re-crop (oy 0.38 at a hard zoom) pushes faces out of the top of the
    // cell. Keep the variation, but zoom gentler and favour the top of the
    // photo more, so heads stay inside the cell in every aspect.
    return {
      img: p.img,
      zoom: Math.min(3, (p.zoom ?? 1) * (1.1 + 0.07 * k)),
      ox: Math.max(-1, Math.min(1, -(p.ox ?? 0) + (k % 2 ? 0.3 : -0.3))),
      oy: 0.62,
    };
  }
  return {
    img: p.img,
    zoom: Math.min(3, (p.zoom ?? 1) * (1.18 + 0.12 * k)),
    ox: Math.max(-1, Math.min(1, -(p.ox ?? 0) + (k % 2 ? 0.3 : -0.3))),
    oy: 0.38,
  };
}

/** Where a panel's photo lands: cover-fit with zoom and pan offsets.
 *  ox, oy in [-1, 1]; oy > 0 favours the top of the photo (faces stay in). */
export function photoFrame(shape, photo) {
  const { img, zoom = 1, ox = 0, oy = 0.55 } = photo;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(shape.w / iw, shape.h / ih);
  const dw = iw * base * zoom;
  const dh = ih * base * zoom;
  const ex = dw - shape.w;
  const ey = dh - shape.h;
  return {
    dx: shape.x - ex / 2 + (ox * ex) / 2,
    dy: shape.y - ey / 2 + (oy * ey) / 2,
    dw, dh,
  };
}

// --- Gradient-map grading -------------------------------------------------

const TONAL_STEPS = 6; // soft posterize: six tonal plateaus, eased edges
const lutCache = new Map();

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function posterT(t, steps = TONAL_STEPS, ease = [0.32, 0.68]) {
  const s = t * (steps - 1);
  const i = Math.min(steps - 2, Math.floor(s));
  return (i + smoothstep(ease[0], ease[1], s - i)) / (steps - 1);
}

function rampAt(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const f = (t - p0) / (p1 - p0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f));
    }
  }
  return stops[stops.length - 1][1];
}

/** 256-entry luminance -> RGB table for a grade, posterized to the grade's
 *  tonal steps (six for the soft cel grades, four for Poster Ink's firmer
 *  screen-print plateaus; a grade's `ease` widens or narrows the blend
 *  between steps). With `smooth` set, the same ramp without posterizing —
 *  the shadow-protection blend target for grades that carry `protect`. */
export function gradeLUT(gradeKey, smooth = false) {
  const cacheKey = smooth ? gradeKey + ':smooth' : gradeKey;
  if (lutCache.has(cacheKey)) return lutCache.get(cacheKey);
  const grade = GRADES[gradeKey] ?? GRADES.sunset;
  const lut = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    const [r, g, b] = rampAt(grade.ramp, smooth ? t : posterT(t, grade.steps ?? TONAL_STEPS, grade.ease));
    lut[v * 3] = r;
    lut[v * 3 + 1] = g;
    lut[v * 3 + 2] = b;
  }
  lutCache.set(cacheKey, lut);
  return lut;
}

/** Small deterministic integer hash -> [0, 1), stable per (a, b) across
 *  renders and machines, so jittered halftone dots never shimmer between
 *  the preview and the export. */
function dotHash(a, b) {
  let n = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Poster Ink's halftone screen: dots of the grade's deep ink colour on a
 *  coarse brick-offset grid, sized by the graded pixel luminance — but the
 *  mask only opens in the highlights (sky, paper-bright areas) and closes
 *  completely through the midtones and shadows, so faces stay clean and the
 *  texture reads as print in the background only. Luminance is sampled from
 *  the already-posterized panel, so the dots follow the print plateaus.
 *  Each dot centre is jittered deterministically by up to ±22% of the
 *  pitch: an un-jittered grid draws a visibly mechanical dotted line
 *  wherever a bright band (sea glint) crosses the screen. */
function applyHalftone(ctx, cw, ch, data, grade) {
  const pitch = Math.max(6, Math.min(15, Math.round(Math.min(cw, ch) / 60)));
  const [ir, ig, ib] = grade.ramp[0][1];
  ctx.save();
  ctx.fillStyle = `rgba(${ir}, ${ig}, ${ib}, 0.6)`;
  ctx.beginPath();
  let row = 0;
  for (let gy = pitch / 2; gy < ch; gy += pitch, row++) {
    const off = row % 2 ? pitch / 2 : 0;
    let col = 0;
    for (let gx = pitch / 2 + off; gx < cw; gx += pitch, col++) {
      const x = gx + (dotHash(col, row) - 0.5) * pitch * 0.44;
      const y = gy + (dotHash(row, col + 57) - 0.5) * pitch * 0.44;
      const px = Math.max(0, Math.min(cw - 1, Math.round(x)));
      const py = Math.max(0, Math.min(ch - 1, Math.round(y)));
      const o = (py * cw + px) * 4;
      const lum = (data[o] * 77 + data[o + 1] * 150 + data[o + 2] * 29) >> 8;
      const s = smoothstep(0.67, 0.96, lum / 255);
      if (s <= 0.02) continue;
      const r = s * pitch * 0.42;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  ctx.restore();
}

let imgSeq = 0;
const panelCache = new Map(); // graded panel canvases, keyed by photo+grade+framing

/** A panel's photo, drawn cover-fit into its own canvas and run through the
 *  grade's gradient map. Cached per (photo, grade, panel size, framing) so
 *  repeat renders and exports stay fast. */
export function gradedPanelCanvas(shape, photo, gradeKey) {
  const cw = Math.max(1, Math.round(shape.w));
  const ch = Math.max(1, Math.round(shape.h));
  const img = photo.img;
  if (img.__vcId == null) img.__vcId = ++imgSeq;
  const key = [img.__vcId, gradeKey, cw, ch,
    (photo.zoom ?? 1).toFixed(3), (photo.ox ?? 0).toFixed(3), (photo.oy ?? 0.55).toFixed(3)].join('|');
  if (panelCache.has(key)) return panelCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const f = photoFrame({ x: 0, y: 0, w: cw, h: ch }, photo);
  ctx.drawImage(img, f.dx, f.dy, f.dw, f.dh);

  const grade = GRADES[gradeKey] ?? GRADES.sunset;
  const mix = grade.mix;
  let graded = null;
  if (mix > 0) {
    const lut = gradeLUT(gradeKey);
    // Shadow protection (grades that carry `protect`: Noir, Poster Ink).
    // Through the protect band the posterized ramp is cross-faded to the
    // same ramp un-posterized, weighted by the pixel's own luminance:
    // deep shadow renders smooth, so a face sitting in shade keeps its
    // eyes and features instead of collapsing into one flat plateau,
    // while highlights and skies keep the full print steps.
    const protect = grade.protect;
    const smoothLut = protect ? gradeLUT(gradeKey, true) : null;
    const data = ctx.getImageData(0, 0, cw, ch);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const lum = (r * 77 + g * 150 + b * 29) >> 8;
      const o = lum * 3;
      let tr = lut[o];
      let tg = lut[o + 1];
      let tb = lut[o + 2];
      if (smoothLut) {
        const wgt = smoothstep(protect[0], protect[1], lum / 255);
        tr = smoothLut[o] + (tr - smoothLut[o]) * wgt;
        tg = smoothLut[o + 1] + (tg - smoothLut[o + 1]) * wgt;
        tb = smoothLut[o + 2] + (tb - smoothLut[o + 2]) * wgt;
      }
      px[i] = r + (tr - r) * mix;
      px[i + 1] = g + (tg - g) * mix;
      px[i + 2] = b + (tb - b) * mix;
    }
    ctx.putImageData(data, 0, 0);
    graded = px;
  }
  if (grade.halftone && graded) applyHalftone(ctx, cw, ch, graded, grade);

  if (panelCache.size > 48) panelCache.delete(panelCache.keys().next().value);
  panelCache.set(key, canvas);
  return canvas;
}

/** Draws one graded photo panel, clipped to the panel polygon. */
export function drawPanelPhoto(ctx, shape, photo, gradeKey) {
  if (!photo || !photo.img) return;
  ctx.save();
  tracePoly(ctx, shape.poly);
  ctx.clip();
  ctx.drawImage(gradedPanelCanvas(shape, photo, gradeKey), shape.x, shape.y);
  ctx.restore();
}

// --- Sun ------------------------------------------------------------------

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Soft radial glow behind the sun disc, drawn once per render. */
export function drawSunGlow(ctx, cx, cy, r, grade) {
  const gr = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.3);
  gr.addColorStop(0, hexA(grade.sun, 0.5));
  gr.addColorStop(1, hexA(grade.sun, 0));
  ctx.save();
  ctx.fillStyle = gr;
  ctx.fillRect(cx - r * 2.3, cy - r * 2.3, r * 4.6, r * 4.6);
  ctx.restore();
}

/** Classic slit sun: a disc with a vertical grade gradient (in Noir the
 *  stops run white -> mid grey -> deep grey so the disc keeps its shading,
 *  and a thin light rim lifts it off the sea texture behind it), cut by
 *  widening horizontal gaps toward the bottom. */
export function drawSun(ctx, cx, cy, r, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, grade.sunStops[0]);
  g.addColorStop(0.55, grade.sunStops[1]);
  g.addColorStop(1, grade.sunStops[2]);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = grade.skyTop;
  let yy = cy + r * 0.05;
  let gap = r * 0.045;
  while (yy < cy + r) {
    ctx.fillRect(cx - r, yy, r * 2, gap);
    yy += gap + r * 0.16;
    gap *= 1.55;
  }
  if (grade.sunRim) {
    ctx.beginPath();
    ctx.arc(cx, cy, r - Math.max(1, r * 0.03), 0, Math.PI * 2);
    ctx.strokeStyle = grade.sunRim;
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.stroke();
  }
  ctx.restore();
}

// The sun rides the horizon of the sea photo (the pier sample): measured on
// that photo, sky becomes sea at y = 246/720. Its anchor is a point in the
// sea panel's own photo coordinates (fx, horizon), mapped through the same
// cover-fit the panel is drawn with, so it lands on the horizon line in
// every layout and size. fx / radius per layout+aspect were picked against
// the measured subject box of the pier photo (face ends at fx 0.48, the
// body's right edge at fx ~0.51 at horizon height) and each panel's visible
// window, so the disc clears heads, hats and shoulders everywhere.
const PIER_HORIZON = 0.345;
const SUN_FX = {
  trio: { land: 0.685, sq: 0.58, port: 0.565 },
  duo: { land: 0.78, sq: 0.64, port: 0.6 },
  grid: { land: 0.7, sq: 0.625, port: 0.78 },
};
const SUN_R = {
  trio: { land: 0.072, sq: 0.065, port: 0.065 },
  duo: { land: 0.072, sq: 0.065, port: 0.065 },
  grid: { land: 0.052, sq: 0.05, port: 0.065 },
};

export function sunAnchor(state, shapes, w, h) {
  const aspect = w > h ? 'land' : (w < h ? 'port' : 'sq');
  const minSide = Math.min(w, h);
  if (state.layout === 'solo' || !SUN_FX[state.layout]) {
    return { cx: w * 0.885, cy: h * 0.115, r: minSide * 0.07 };
  }
  const shape = shapes[1];
  const photo = panelPhoto(state, 1);
  const r = minSide * SUN_R[state.layout][aspect];
  if (shape && photo && photo.img) {
    const f = photoFrame(shape, photo);
    return { cx: f.dx + SUN_FX[state.layout][aspect] * f.dw, cy: f.dy + PIER_HORIZON * f.dh, r };
  }
  if (shape) return { cx: shape.x + shape.w * 0.68, cy: shape.y + shape.h * 0.36, r };
  return { cx: w * 0.64, cy: h * 0.36, r };
}

/** A palm silhouette drawn from code: curved trunk, crown, drooping fronds.
 *  Drawn in unit coordinates (the context is scaled by `s` once), so all
 *  lengths here are fractions of the palm's height. */
export function drawPalm(ctx, bx, by, s, flip, color) {
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(flip ? -s : s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk: a gentle S-curve rising from the base.
  ctx.lineWidth = 0.06;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(0.06, -0.45, -0.05, -0.85);
  ctx.stroke();
  const cx = -0.05;
  const cy = -0.85;
  // Fronds: seven arcs fanning out of the crown, drooping hard at the tips.
  for (let i = 0; i < 7; i++) {
    const a = (-160 + i * 26) * (Math.PI / 180);
    const len = 0.42 + 0.1 * Math.sin(i * 1.7);
    const tx = cx + Math.cos(a) * len;
    const ty = cy + Math.sin(a) * len * 0.62 + 0.26;
    ctx.lineWidth = 0.038;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(
      cx + Math.cos(a) * len * 0.55,
      cy + Math.sin(a) * len * 0.45 - 0.1,
      tx, ty,
    );
    ctx.stroke();
  }
  // Coconuts: two small dots under the crown.
  ctx.beginPath();
  ctx.arc(cx + 0.03, cy + 0.03, 0.035, 0, Math.PI * 2);
  ctx.arc(cx - 0.04, cy + 0.045, 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- Print finishing ------------------------------------------------------

let grainTile = null;

/** Deterministic low-res noise tile (fixed seed: every render identical),
 *  upscaled over the composite at low opacity for a print-grain feel. */
function getGrainTile() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = 144;
  c.height = 144;
  const g = c.getContext('2d');
  const data = g.createImageData(144, 144);
  let seed = 1234567;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 96 + Math.floor(rnd() * 64);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  grainTile = c;
  return c;
}

function applyFinishing(ctx, w, h) {
  // Vignette: soft radial falloff toward the corners.
  const vg = ctx.createRadialGradient(w / 2, h * 0.44, Math.min(w, h) * 0.42, w / 2, h * 0.44, Math.max(w, h) * 0.78);
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  // Grain.
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(getGrainTile(), 0, 0, w, h);
  ctx.restore();
}

// --- Lettering ------------------------------------------------------------

function fitFont(ctx, text, maxW, startSize, family) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (ctx.measureText(text).width > maxW && size > 10) {
    size -= 2;
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

// The official-cover treatment: never plain white — a sunset gradient fill
// (cobalt -> violet -> pink -> orange) inside a thick dark-plum outline,
// rimmed by one thin complementary line.
const TITLE_STOPS = [[0, '#3060ce'], [0.38, '#913bc2'], [0.68, '#ff5395'], [1, '#ff944c']];

function drawTitle(ctx, w, h, title, noir, scale = 1) {
  const size = fitFont(ctx, title, w * 0.94, h * 0.17 * scale, 'Anton, "Arial Black", sans-serif');
  const baseline = h * 0.865;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const grad = ctx.createLinearGradient(0, baseline - size, 0, baseline + size * 0.12);
  if (noir) {
    // Metallic silver: a bright face, a darker waist, a second sheen —
    // the premium monochrome lettering of the classic crime cover, never
    // flat white.
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.38, '#f2f2f2');
    grad.addColorStop(0.62, '#a3a3a3');
    grad.addColorStop(0.82, '#dedede');
    grad.addColorStop(1, '#8a8a8a');
  } else {
    for (const [p, c] of TITLE_STOPS) grad.addColorStop(p, c);
  }
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.05;
  if (!noir) {
    // Thin complementary rim, widest stroke first.
    ctx.strokeStyle = '#19e3ff';
    ctx.lineWidth = size * 0.16 + Math.max(3, size * 0.05);
    ctx.strokeText(title, w / 2, baseline);
  }
  ctx.strokeStyle = noir ? '#000000' : '#20082e';
  ctx.lineWidth = size * 0.16;
  ctx.strokeText(title, w / 2, baseline);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = grad;
  ctx.fillText(title, w / 2, baseline);
  return { size, baseline };
}

/** Script taglines read in title case ("One Last Score In The Sunset"). */
function scriptCase(s) {
  return s.toLowerCase().replace(/(^|\s)(\S)/g, (m, p, c) => p + c.toUpperCase());
}

function drawTagline(ctx, w, h, rawTag, noir, titleBox) {
  const tag = scriptCase(rawTag.trim());
  if (!tag) return;
  const family = '"Yellowtail", "Bebas Neue", cursive';
  const start = titleBox ? titleBox.size * 0.5 : h * 0.062;
  const size = fitFont(ctx, tag, w * 0.86, start, family);
  const baseline = titleBox ? titleBox.baseline + titleBox.size * 0.6 : h * 0.955;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (noir) {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillText(tag, w / 2, baseline);
    return;
  }
  // Neon pink script: a soft dark edge for definition, then the glow pass —
  // shadowBlur is set once here, inside this single render.
  ctx.strokeStyle = 'rgba(60, 0, 30, 0.4)';
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.lineJoin = 'round';
  ctx.strokeText(tag, w / 2, baseline);
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = size * 0.45;
  ctx.fillStyle = '#ff5395';
  ctx.fillText(tag, w / 2, baseline);
  ctx.fillText(tag, w / 2, baseline);
  ctx.shadowBlur = 0;
}

/**
 * Draws the whole poster. `state` is:
 * { layout, grade, size, panels: [{img, zoom, ox, oy}...], title, tagline }
 * The canvas keeps its own width/height; export uses a full-size canvas.
 */
export function drawPoster(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const noir = state.grade === 'noir';
  const { shapes } = panelShapes(w, h, state.layout);

  // Sky base (shows through only where panels do not cover).
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(0.55, grade.sky[0]);
  sky.addColorStop(1, grade.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Panels: gradient-mapped photos; empty panels fall back to a deep
  // gradient so the poster never shows a hole.
  for (let i = 0; i < shapes.length; i++) {
    const photo = panelPhoto(state, i);
    if (photo && photo.img) {
      drawPanelPhoto(ctx, shapes[i], photo, state.grade);
    } else {
      ctx.save();
      tracePoly(ctx, shapes[i].poly);
      ctx.clip();
      const g = ctx.createLinearGradient(0, shapes[i].y, 0, shapes[i].y + shapes[i].h);
      g.addColorStop(0, grade.sky[0]);
      g.addColorStop(1, grade.skyTop);
      ctx.fillStyle = g;
      ctx.fillRect(shapes[i].x, shapes[i].y, shapes[i].w, shapes[i].h);
      ctx.restore();
    }
  }

  // Gutters: every panel edge gets the same firm dark gutter with a thin
  // light pinstripe — the hard lines between panels are the visual anchor.
  // The pass runs again after the sun is drawn, so the sun's glow (clipped
  // to its own panel) can never tint a gutter line.
  const strokeGutters = () => {
    if (shapes.length < 2) return;
    for (const s of shapes) {
      tracePoly(ctx, s.poly);
      ctx.strokeStyle = 'rgba(8, 4, 18, 0.92)';
      ctx.lineWidth = Math.max(5, w * 0.007);
      ctx.stroke();
      tracePoly(ctx, s.poly);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = Math.max(1.5, w * 0.0018);
      ctx.stroke();
    }
  };
  strokeGutters();

  // Decor: slit sun on the sea panel's horizon (see sunAnchor — never
  // top-centre, where it sat on the middle subject's hat), palms framing
  // the lower corners. The sun and its glow are clipped to the sea panel's
  // own polygon, so neither can ever wash over a gutter into the next cell
  // (in the Grid's narrow satellites the disc is also sized and anchored
  // to keep a clear margin from the cell edges). Mosaic gets no sun: with
  // nine small cells there is no sea cell that can be guaranteed face-free,
  // and the brief for the layout is the grid itself, not the sun.
  if (state.layout !== 'mosaic') {
    const spot = sunAnchor(state, shapes, w, h);
    const sunPanel = state.layout === 'solo' ? shapes[0] : (shapes[1] ?? shapes[0]);
    ctx.save();
    if (sunPanel) { tracePoly(ctx, sunPanel.poly); ctx.clip(); }
    drawSunGlow(ctx, spot.cx, spot.cy, spot.r, grade);
    drawSun(ctx, spot.cx, spot.cy, spot.r, grade);
    ctx.restore();
    strokeGutters();
  }
  const palmColor = 'rgba(10, 4, 18, 0.88)';
  drawPalm(ctx, w * 0.02, h * 0.99, h * 0.3, false, palmColor);
  drawPalm(ctx, w * 0.99, h * 1.0, h * 0.25, true, palmColor);

  // Print finishing over the composite, before the lettering.
  applyFinishing(ctx, w, h);

  // Scrim so the lettering reads over any photo. Mosaic's nine cells are
  // the layout's whole argument, so its scrim starts lower and its
  // lettering block is scaled down — the bottom row of cells stays
  // readable as panels instead of drowning under the title.
  const mosaic = state.layout === 'mosaic';
  const scrimTop = mosaic ? 0.64 : 0.52;
  const scrim = ctx.createLinearGradient(0, h * scrimTop, 0, h);
  scrim.addColorStop(0, `rgba(${grade.scrim}, 0)`);
  scrim.addColorStop(1, `rgba(${grade.scrim}, 0.82)`);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * scrimTop, w, h * (1 - scrimTop));

  // Lettering: gradient title with a double outline, neon script tagline.
  const title = (state.title || '').trim().toUpperCase();
  const titleBox = title ? drawTitle(ctx, w, h, title, noir, mosaic ? 0.8 : 1) : null;
  const tag = (state.tagline || '').trim();
  if (tag) drawTagline(ctx, w, h, tag, noir, titleBox);

  // Poster frame: dark outer edge, thin light inner line.
  ctx.strokeStyle = 'rgba(5, 2, 10, 0.6)';
  ctx.lineWidth = Math.max(3, w * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = Math.max(2, w * 0.002);
  ctx.strokeRect(w * 0.012, h * 0.012, w * 0.976, h * 0.976);
}

/** Renders the poster at full export size and returns the canvas. */
export function renderExport(state, sizeKey) {
  const [w, h] = SIZES[sizeKey ?? state.size] ?? SIZES['1080x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawPoster(canvas, state);
  return canvas;
}
