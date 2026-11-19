// VICE COVER poster renderer: draws a multi-panel GTA-style poster onto any
// 2D canvas. Pure drawing code — no network, no DOM input, no Rockstar assets.
// A poster is: photo panels graded through a per-grade gradient-map LUT with
// tonal posterizing (cel feel; the Poster Ink grade goes further — a firm
// screen-print posterize plus a halftone that lives in smooth highlights
// only and fades over detailed texture and off bright neutral surfaces
// entirely; Noir and Poster Ink protect their shadows, cross-fading the
// posterized ramp to a smooth one at low luminance so shaded faces keep
// their features, and Noir additionally breaks its flat B/W plateaus with
// a Bayer ordered dither so faces keep their tonal modelling), firm
// gutters, a slit sun sitting on the sea panel's horizon (in the Key Art
// grade the sun is repainted along with the panels — a warm painted disc
// with soft shadow bands and a thin ink outline), a print
// finishing pass (grain + vignette), then layered
// lettering: a sunset-gradient title with a double outline and a neon
// script tagline (Mosaic instead gives its lettering a title band below
// the grid, so all nine panels stay fully visible). Dark photos are
// steadied first by a gated auto-exposure lift (bright photos pass
// through untouched; very dark photos are lifted hard, under a highlight
// shoulder that keeps lit signs from blowing out), and a photo shown
// twice in one layout is mirrored on its later showings so the repeat
// reads as a different moment. The Key Art grade goes a class further:
// its panels are painted, not just graded — an edge-aware softened base,
// an eight-band cel ramp, drawn ink contours and a fine paper grain — so
// a photo reads as hand-drawn key art instead of a filtered photograph.

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
    // The Noir disc gets a richer four-stop vertical shade (bright crown ->
    // mid-grey belly -> deep-grey base) and soft-edged dark-grey slits, so
    // it reads as a shaded sun, not a white sticker with black bars.
    sunGrad: [[0, '#ffffff'], [0.32, '#e4e4e4'], [0.62, '#a6a6a6'], [1, '#595959']],
    sunSlitSoft: true,
    sunRim: 'rgba(235, 235, 235, 0.9)',
    // The ramp's floor is lifted and its shadow stops are widened, and the
    // grade carries shadow protection (see `protect` in gradedPanelCanvas):
    // a hard six-step posterize over a monochrome ramp used to crush
    // shadowed faces into a single grey plateau. The protect band reaches
    // well into the low midtones and the two darkest stops sit a touch
    // higher still: the hard-edged shadow a hat brim throws across a face
    // lives exactly in that band, and softening its cross-fade there is
    // what keeps the brim line from printing as a stripe over the eyes.
    // Protection alone was not enough for B/W: a lit forehead still fell
    // inside one plateau and printed as a flat mask. So Noir also carries
    // `dither` — an ordered Bayer dither on the posterize quantization
    // (see gradedPanelCanvas) that breaks every plateau into a fine print
    // texture whose average is the smooth tone, restoring the gradation
    // the steps removed.
    ramp: [[0, [34, 34, 34]], [0.22, [84, 84, 84]], [0.45, [130, 130, 130]], [0.7, [192, 192, 192]], [1, [255, 255, 255]]],
    ease: [0.2, 0.8],
    protect: [0.04, 0.72],
    dither: 1,
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
    // darkest plateau and its features drown. The protection reaches
    // further up the low midtones than a plain shadow fade and the two
    // darkest stops are lifted again, because a hat brim's shadow prints
    // as a hard horizontal band across the eyes at exactly that luminance
    // — the wider cross-fade melts the band's lower edge and the lifted
    // floor raises the eye zone out of the darkest ink, while sky, hat
    // and sea (brighter or fully shadowed) keep their firm print steps.
    ramp: [[0, [52, 42, 94]], [0.22, [90, 70, 140]], [0.42, [198, 104, 86]], [0.7, [242, 170, 96]], [1, [250, 236, 204]]],
    ease: [0.26, 0.74],
    protect: [0.03, 0.78],
    mix: 0.88,
    steps: 4,
    halftone: true,
    accent: '#f5b95e',
    tagText: '#0d0a24',
    scrim: '10, 7, 30',
  },
  keyart: {
    // Key Art: the painted class. Where the other grades are gradient
    // maps over the photograph, this one re-renders the photo as an
    // illustration (see `painterly` and gradedPanelCanvas): the photo is
    // first softened on an edge-aware base (downscaled and re-upscaled
    // in repeated rounds — micro-detail and skin texture dissolve while the big
    // shapes and hard contours survive), then mapped through a warm
    // sunset-family ramp posterized to EIGHT cel bands whose transitions
    // are smoothstepped, so colour areas read as flat, graded brush
    // strokes. Shadow protection (like Noir/Ink) cross-fades the bands
    // to the smooth ramp through the shadows, so faces keep their
    // modelling as strokes instead of collapsing into plateaus. Over
    // the graded paint, drawn contours: a Sobel pass over the softened
    // base (computed at quarter resolution) inks only the STRONG edges
    // — hair and jaw silhouettes, clothing folds, palm fronds, the
    // horizon — in a warm dark plum-brown, with alpha proportional to
    // edge strength; the softened base has already dissolved skin
    // texture, and the high threshold keeps the ink off faces, whose
    // shading gradients stay far below it. The ink is laid in TWO
    // tiers: the soft pass above, whose alpha tops out well under
    // full strength, and a second coat reserved for the strongest
    // contours (edgeStrong*), which brings those outlines close to
    // full ink so the drawn contour actually reads at full-frame
    // scale — a single soft coat left the silhouettes as little more
    // than a darker shading gradient. A fine paper grain finishes
    // the panel. The auto-exposure lift applies as in every grade.
    label: 'Key Art',
    sky: ['#2b1055', '#7597de'],
    skyTop: '#1c0b3d',
    sun: '#ffd166',
    sunCore: '#fff3b0',
    sunStops: ['#fff3b0', '#ffd166', '#ff944c'],
    // The sun is repainted in this grade (see drawSun): a warm painted
    // disc with soft shadow bands and a thin ink outline, not the
    // hard-slit clip-art disc of the graded classes.
    paintedSun: true,
    // The ramp's low end leans Vice again: the deepest stop is a saturated
    // violet and the low-mid stop a true magenta, so painted shadows and
    // backgrounds keep their purple-magenta depth instead of drifting
    // orange-brown (sepia) under the warm sample photos. The mid and
    // upper stops — the skin region — are untouched, so face modelling
    // keeps exactly the quality the painted faces were tuned with.
    ramp: [[0, [30, 10, 78]], [0.26, [148, 44, 134]], [0.5, [219, 92, 104]], [0.74, [255, 125, 68]], [1, [255, 224, 170]]],
    ease: [0.15, 0.85],
    protect: [0.04, 0.75],
    steps: 8,
    mix: 0.7,
    painterly: {
      scale: 0.45, passes: 3,
      edgeScale: 0.25, edgeLo: 0.3, edgeHi: 0.58,
      ink: [46, 20, 44], inkAlpha: 0.66,
      edgeStrongLo: 0.38, edgeStrongHi: 0.48, inkAlphaStrong: 1,
    },
    accent: '#ff2e63',
    tagText: '#1c0b3d',
    scrim: '10, 4, 20',
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
 *  pattern of reusing one shoot across several panels. A photo's second and
 *  later showings in the same layout are also mirrored (`flip`), so a
 *  repeat reads as a different moment of the shoot instead of a copy-paste;
 *  the first showing is never touched. */
export function panelPhoto(state, i) {
  const list = state.panels ?? [];
  if (!list.length) return null;
  const p = list[i % list.length];
  if (!p) return null;
  let seen = 0;
  for (let j = 0; j < i; j++) {
    const q = list[j % list.length];
    if (q && q.img && q.img === p.img) seen++;
  }
  const flip = seen > 0;
  if (state.layout === 'mosaic' && i === 3 && i < list.length) {
    // Panel 4's shared re-crop (zoom 1.35, oy 0.4) is framed for the Grid's
    // narrower satellites; in a wide Mosaic cell the width-driven cover-fit
    // pushes the subject's eyes out of the top. Reframe it for Mosaic only.
    return { img: p.img, zoom: 1.15, ox: p.ox ?? 0.3, oy: 0.72, flip };
  }
  if (i < list.length) return flip ? { ...p, flip } : p;
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
      flip,
    };
  }
  return {
    img: p.img,
    zoom: Math.min(3, (p.zoom ?? 1) * (1.18 + 0.12 * k)),
    ox: Math.max(-1, Math.min(1, -(p.ox ?? 0) + (k % 2 ? 0.3 : -0.3))),
    oy: 0.38,
    flip,
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

/** Bayer 8x8 ordered-dither thresholds (0..63), the classic dispersed-dot
 *  matrix: neighbouring thresholds are far apart in value, so a partially
 *  spilled plateau reads as fine print texture, never as clumps. */
const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

/** Small deterministic integer hash -> [0, 1), stable per (a, b) across
 *  renders and machines, so jittered halftone dots never shimmer between
 *  the preview and the export. */
function dotHash(a, b) {
  let n = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** The halftone gate map, per pixel of the source photo as drawn (before
 *  grading): 1 where the dot screen may live, 0 where it must not. Two
 *  fades multiply:
 *  - Texture: summed absolute luminance differences across a small span.
 *    Flat areas — sky, sea, water glint — measure near zero even when
 *    bright; fabric weave, hair and fine detail measure high, and the
 *    screen fades over them.
 *  - Neutral-bright: a bright, low-saturation surface (a white singlet,
 *    a sunlit wall) is luminance's blind spot — it is as bright as sky
 *    and nearly as smooth in its centre, but dots on it read as dirt on
 *    clothing, not print texture. There the screen now fades out
 *    COMPLETELY. The fade's saturation edge is set from the bundled
 *    photos' own measurements, not by eye: the pier singlet's bright
 *    fabric measures saturation ≈ 0.10 (98% of its bright pixels under
 *    0.16), while the boulevard sky's pale core measures ≈ 0.22 (only
 *    ~18% under 0.16) and its mid sky (luminance ±0.46) never reaches
 *    the luminance edge at all — so a full fade below saturation 0.12–
 *    0.16 at luminance above ~0.68 erases the screen from the clothing
 *    and leaves the sky's screen standing. Genuinely coloured bright
 *    areas (sunset sky, sea glint) keep the screen in full. */
function halftoneGateMap(px, cw, ch) {
  const lum = new Float32Array(cw * ch);
  const sat = new Float32Array(cw * ch);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    lum[j] = (r * 77 + g * 150 + b * 29) >> 8;
    const mx = Math.max(r, g, b);
    sat[j] = mx > 0 ? (mx - Math.min(r, g, b)) / mx : 0;
  }
  const s = Math.max(2, Math.min(4, Math.round(Math.min(cw, ch) / 143)));
  const gate = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    const ym = Math.max(0, y - s) * cw;
    const yp = Math.min(ch - 1, y + s) * cw;
    const yw = y * cw;
    for (let x = 0; x < cw; x++) {
      const xm = Math.max(0, x - s);
      const xp = Math.min(cw - 1, x + s);
      const tex = Math.abs(lum[yw + xp] - lum[yw + xm]) + Math.abs(lum[yp + x] - lum[ym + x]);
      const texGate = 1 - smoothstep(4.5, 12, tex);
      const neutral = smoothstep(0.6, 0.68, lum[yw + x] / 255) * (1 - smoothstep(0.12, 0.16, sat[yw + x]));
      gate[yw + x] = texGate * (1 - neutral);
    }
  }
  return gate;
}

/** Poster Ink's halftone screen: dots of the grade's deep ink colour on a
 *  coarse brick-offset grid, sized by the graded pixel luminance — but the
 *  mask only opens in the highlights (sky, paper-bright areas) and closes
 *  completely through the midtones and shadows, so faces stay clean and the
 *  texture reads as print in the background only. Luminance is sampled from
 *  the already-posterized panel, so the dots follow the print plateaus.
 *  A second gate reads the photo itself (see halftoneGateMap): where the
 *  source is detailed — fabric weave, hair, foliage — or bright but
 *  neutral (white clothing), the dots fade out even in bright areas,
 *  while smooth, coloured bright areas (sky, sea, glint) keep the full
 *  screen. Each dot centre is jittered deterministically by up to ±40% of
 *  the pitch: an un-jittered (or barely jittered) grid draws a visibly
 *  mechanical dotted line wherever a bright band (sea glint) crosses the
 *  screen, and at ±40% the rows dissolve into an organic scatter while
 *  the screen's density stays even. */
function applyHalftone(ctx, cw, ch, data, grade, gate) {
  const pitch = Math.max(6, Math.min(15, Math.round(Math.min(cw, ch) / 60)));
  const [ir, ig, ib] = grade.ramp[0][1];
  // Average the gate over the dot's own cell (centre + four points a
  // third of a pitch out), so the gate answers for the area the dot
  // would cover, not a single pixel.
  const gateAt = (x, y) => {
    if (!gate) return 1;
    const d = pitch / 3;
    let sum = 0;
    const pts = [[x, y], [x - d, y], [x + d, y], [x, y - d], [x, y + d]];
    for (const [qx, qy] of pts) {
      const px = Math.max(0, Math.min(cw - 1, Math.round(qx)));
      const py = Math.max(0, Math.min(ch - 1, Math.round(qy)));
      sum += gate[py * cw + px];
    }
    return sum / pts.length;
  };
  ctx.save();
  ctx.fillStyle = `rgba(${ir}, ${ig}, ${ib}, 0.6)`;
  ctx.beginPath();
  let row = 0;
  for (let gy = pitch / 2; gy < ch; gy += pitch, row++) {
    const off = row % 2 ? pitch / 2 : 0;
    let col = 0;
    for (let gx = pitch / 2 + off; gx < cw; gx += pitch, col++) {
      const x = gx + (dotHash(col, row) - 0.5) * pitch * 0.8;
      const y = gy + (dotHash(row, col + 57) - 0.5) * pitch * 0.8;
      const px = Math.max(0, Math.min(cw - 1, Math.round(x)));
      const py = Math.max(0, Math.min(ch - 1, Math.round(y)));
      const o = (py * cw + px) * 4;
      const lum = (data[o] * 77 + data[o + 1] * 150 + data[o + 2] * 29) >> 8;
      let s = smoothstep(0.67, 0.96, lum / 255);
      if (s > 0.02) s *= gateAt(x, y);
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

// --- Auto-exposure for dark photos ----------------------------------------

// Mean-luminance gate: a photo at or above it is considered well exposed
// and passes through the grader byte-for-byte untouched; below it, the
// photo is lifted before grading by a gentle gamma whose strength grows
// with how far under the gate the photo sits. Gamma lifts shadows and
// midtones while pinning the highlights, so a night photo becomes
// readable without blowing out its lights or losing the night mood.
// Measured on the bundled samples: the three bright scenes sit at
// 0.43–0.57 mean luminance, the night portrait at 0.23 — the gate at 0.33
// separates them cleanly.
const EXPO_GATE = 0.33;

// Below this mean a photo is not just dim but very dark (the night
// portrait, at 0.236, is the bundled case): it gets a substantially
// stronger gamma than the gate band's gentle slope — the band's slope
// left the night portrait's face a full step too dark to read — plus a
// soft highlight shoulder, so the stronger lift cannot push lit neon
// signs up into one clipped plateau (see photoExposure).
const EXPO_VERY_DARK = 0.26;

function photoExposure(img) {
  if (img.__vcExpo) return img.__vcExpo;
  let expo = { lut: null };
  try {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 64;
    const x = cv.getContext('2d');
    x.drawImage(img, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      sum += (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    }
    const mean = sum / (d.length / 4) / 255;
    if (mean < EXPO_GATE) {
      let gamma;
      let shoulder = false;
      if (mean < EXPO_VERY_DARK) {
        // Very dark: continue from the gate band's gamma at the 0.26
        // threshold (0.883) and steepen hard from there — slope 12 per
        // unit of mean, floored at 0.57, so a near-black photo is lifted
        // hard but never solarized. The bundled night portrait (mean
        // 0.236) lands at gamma ≈ 0.60: measured on its lettering-free
        // Grid panel, the cell mean rises +21.5% and the face zone
        // +25.8% against the gentler curve that preceded it, while the
        // shoulder below holds the panel's 99th-percentile brightness
        // where it was (0.577 -> 0.573 — no blow-out).
        gamma = Math.max(0.57, 0.883 - 12 * (EXPO_VERY_DARK - mean));
        shoulder = true;
      } else {
        const strength = (EXPO_GATE - mean) / EXPO_GATE;
        gamma = 1 - 0.55 * strength;
      }
      const lut = new Uint8Array(256);
      for (let v = 0; v < 256; v++) {
        let t = Math.pow(v / 255, gamma);
        // Highlight shoulder: a tanh roll-off asymptoting at 0.96, not
        // 1.0, so the stronger very-dark gamma cannot carry the
        // brightest lit signs past where the gentler lift put them —
        // their separation survives and nothing clips to a plateau.
        if (shoulder && t > 0.8) t = 0.8 + 0.16 * Math.tanh((t - 0.8) / 0.16);
        lut[v] = Math.round(255 * t);
      }
      expo = { lut };
    }
  } catch {
    // Exposure is best-effort: grading proceeds without it.
  }
  img.__vcExpo = expo;
  return expo;
}

/** Key Art's edge-aware soft base (light version): the panel is drawn
 *  down to `scale` and back up, `passes` times. Each round trip is a
 *  resampling, not a box blur: photographic micro-detail — skin texture,
 *  fabric weave, water sparkle — lives at the frequencies the small
 *  canvas cannot hold and dissolves, while the big shapes and the hard
 *  contours (a jaw against a neck, a hat against the sky) survive in
 *  softened form, exactly the base a cel painter works from. */
function softenBase(ctx, cw, ch, scale, passes) {
  const sw = Math.max(1, Math.round(cw * scale));
  const sh = Math.max(1, Math.round(ch * scale));
  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (let i = 0; i < passes; i++) {
    sctx.drawImage(ctx.canvas, 0, 0, sw, sh);
    ctx.drawImage(small, 0, 0, cw, ch);
  }
}

/** Key Art's drawn contours: a Sobel pass over the softened base's
 *  luminance (exposure lift applied, so a dark photo's contours count at
 *  their lifted strength), computed at the painterly edge resolution —
 *  a quarter of the panel — and returned as a small ink canvas to be
 *  drawn back up over the graded paint; the upscaling softens the ink
 *  into brush-width lines. The ink is two-tiered. The SOFT tier inks
 *  only strong edges: alpha is zero below `edgeLo` of the normalized
 *  gradient magnitude and ramps to `inkAlpha` at `edgeHi`. Because the
 *  base was softened first, skin carries no texture edges at all, and a
 *  face's own shading gradients (cheek, brow) sit far below the
 *  threshold — what clears it is the drawn outline of things: hair and
 *  jaw silhouettes, hat brims, clothing folds, palm fronds, the sea's
 *  horizon. The STRONG tier is a second coat over the same ink colour,
 *  reserved for the strongest contours of all: it starts far above the
 *  soft tier's floor (`edgeStrongLo`) and ramps to `inkAlphaStrong`,
 *  composited over the soft alpha, so a true silhouette — hair against
 *  sky, a jaw against a neck, a palm frond against the sunset — lands
 *  close to full-strength ink and the contour reads as drawn at
 *  full-frame scale, while face shading, which never reaches even the
 *  soft floor, stays untouched by either coat. */
function painterlyInkCanvas(px, cw, ch, expo, p) {
  const es = p.edgeScale;
  const ew = Math.max(2, Math.floor(cw * es));
  const eh = Math.max(2, Math.floor(ch * es));
  const lum = new Float32Array(ew * eh);
  for (let y = 0; y < eh; y++) {
    const sy = Math.min(ch - 1, Math.floor(y / es));
    for (let x = 0; x < ew; x++) {
      const sx = Math.min(cw - 1, Math.floor(x / es));
      const o = (sy * cw + sx) * 4;
      let r = px[o];
      let g = px[o + 1];
      let b = px[o + 2];
      if (expo.lut) {
        r = expo.lut[r];
        g = expo.lut[g];
        b = expo.lut[b];
      }
      lum[y * ew + x] = (r * 77 + g * 150 + b * 29) >> 8;
    }
  }
  const out = document.createElement('canvas');
  out.width = ew;
  out.height = eh;
  const octx = out.getContext('2d');
  const id = octx.createImageData(ew, eh);
  const od = id.data;
  const [ir, ig, ib] = p.ink;
  for (let y = 0; y < eh; y++) {
    for (let x = 0; x < ew; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(ew - 1, x + 1);
      const ym = Math.max(0, y - 1);
      const yp = Math.min(eh - 1, y + 1);
      const gx = (lum[ym * ew + xp] + 2 * lum[y * ew + xp] + lum[yp * ew + xp])
        - (lum[ym * ew + xm] + 2 * lum[y * ew + xm] + lum[yp * ew + xm]);
      const gy = (lum[yp * ew + xm] + 2 * lum[yp * ew + x] + lum[yp * ew + xp])
        - (lum[ym * ew + xm] + 2 * lum[ym * ew + x] + lum[ym * ew + xp]);
      const mag = Math.sqrt(gx * gx + gy * gy) / 1020;
      const aSoft = smoothstep(p.edgeLo, p.edgeHi, mag) * p.inkAlpha;
      const aStrong = p.edgeStrongHi
        ? smoothstep(p.edgeStrongLo, p.edgeStrongHi, mag) * p.inkAlphaStrong
        : 0;
      // The strong coat composites OVER the soft one (source-over), so
      // the strongest contours approach full ink without the two
      // alphas ever summing past it.
      const a = aSoft + aStrong * (1 - aSoft);
      if (a <= 0.004) continue;
      const o = (y * ew + x) * 4;
      od[o] = ir;
      od[o + 1] = ig;
      od[o + 2] = ib;
      od[o + 3] = Math.round(255 * a);
    }
  }
  octx.putImageData(id, 0, 0);
  return out;
}

/** A panel's photo, drawn cover-fit into its own canvas and run through the
 *  grade's gradient map. Cached per (photo, grade, panel size, framing) so
 *  repeat renders and exports stay fast. */
export function gradedPanelCanvas(shape, photo, gradeKey) {
  const cw = Math.max(1, Math.round(shape.w));
  const ch = Math.max(1, Math.round(shape.h));
  const img = photo.img;
  if (img.__vcId == null) img.__vcId = ++imgSeq;
  const key = [img.__vcId, gradeKey, cw, ch,
    (photo.zoom ?? 1).toFixed(3), (photo.ox ?? 0).toFixed(3), (photo.oy ?? 0.55).toFixed(3),
    photo.flip ? 'f' : ''].join('|');
  if (panelCache.has(key)) return panelCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const f = photoFrame({ x: 0, y: 0, w: cw, h: ch }, photo);
  if (photo.flip) {
    // Mirrored repeat showing: same cover-fit frame, content flipped, so
    // the panel reads as the reverse angle of the same moment.
    ctx.save();
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, f.dx, f.dy, f.dw, f.dh);
  if (photo.flip) ctx.restore();

  // Key Art paints from a softened base (see softenBase); every other
  // grade grades the photograph exactly as drawn.
  const painterly = (GRADES[gradeKey] ?? GRADES.sunset).painterly;
  if (painterly) softenBase(ctx, cw, ch, painterly.scale, painterly.passes);

  const grade = GRADES[gradeKey] ?? GRADES.sunset;
  const mix = grade.mix;
  // Dark photos are exposure-lifted before grading (bright photos get a
  // null LUT and the loop below is exactly the pre-lift behaviour).
  const expo = photoExposure(img);
  let graded = null;
  let gate = null;
  let inkCanvas = null;
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
    // The halftone's gate map is measured on the photo as drawn, before
    // grading (and before the exposure lift) changes its detail.
    gate = grade.halftone ? halftoneGateMap(px, cw, ch) : null;
    // Key Art's ink contours are measured on the softened base as drawn
    // (before the grading loop rewrites these pixels), at quarter
    // resolution — see painterlyInkCanvas.
    if (painterly) inkCanvas = painterlyInkCanvas(px, cw, ch, expo, painterly);
    // Ordered dithering (grades that carry `dither`: Noir). The posterized
    // lookup is taken at a luminance perturbed by the pixel's Bayer
    // threshold, scaled by the grade's amplitude in tonal steps: inside a
    // flat plateau, pixels whose threshold carries them over the step edge
    // take the neighbouring step, in Bayer proportion — the plateau
    // breaks into a fine print texture whose spatial average is the tone
    // the smooth ramp would have given, so gradation returns to faces
    // without surrendering the posterized steps anywhere. The smooth
    // (protect) lookup and the protect weight keep the unperturbed
    // luminance, so deep shadows — where protection already renders the
    // smooth ramp — stay smooth.
    const ditherAmp = grade.dither
      ? grade.dither * (255 / ((grade.steps ?? TONAL_STEPS) - 1))
      : 0;
    for (let y = 0; y < ch; y++) {
      const rowBase = y * cw;
      const bayerRow = BAYER8[y & 7];
      for (let x = 0; x < cw; x++) {
        const i = (rowBase + x) * 4;
        let r = px[i];
        let g = px[i + 1];
        let b = px[i + 2];
        if (expo.lut) {
          r = expo.lut[r];
          g = expo.lut[g];
          b = expo.lut[b];
        }
        const lum = (r * 77 + g * 150 + b * 29) >> 8;
        let o = lum * 3;
        if (ditherAmp) {
          const dl = Math.max(0, Math.min(255,
            Math.round(lum + ((bayerRow[x & 7] + 0.5) / 64 - 0.5) * ditherAmp)));
          o = dl * 3;
        }
        let tr = lut[o];
        let tg = lut[o + 1];
        let tb = lut[o + 2];
        if (smoothLut) {
          const so = lum * 3;
          const wgt = smoothstep(protect[0], protect[1], lum / 255);
          tr = smoothLut[so] + (tr - smoothLut[so]) * wgt;
          tg = smoothLut[so + 1] + (tg - smoothLut[so + 1]) * wgt;
          tb = smoothLut[so + 2] + (tb - smoothLut[so + 2]) * wgt;
        }
        px[i] = r + (tr - r) * mix;
        px[i + 1] = g + (tg - g) * mix;
        px[i + 2] = b + (tb - b) * mix;
      }
    }
    ctx.putImageData(data, 0, 0);
    graded = px;
  }
  if (grade.halftone && graded) applyHalftone(ctx, cw, ch, graded, grade, gate);
  if (painterly && graded && inkCanvas) {
    // The drawn contours go over the graded paint, drawn back up from
    // their quarter-resolution canvas so the lines land at brush width
    // with soft edges; then a whisper of the print-grain tile at panel
    // level, so the paint itself carries paper texture under the
    // poster's own finishing pass.
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(inkCanvas, 0, 0, cw, ch);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(getGrainTile(), 0, 0, cw, ch);
    ctx.restore();
  }

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

/** The painted sun (Key Art only, via the grade's `paintedSun` flag): the
 *  disc is repainted like the panels around it — a flat warm gradient in
 *  the grade's own sun colours, crossed by SOFT shadow bands that widen
 *  toward the base and feather into the paint at both edges (a deep warm
 *  shade, never the hard skyTop bars of the slit sun), and finished with
 *  a thin ink outline in the same plum-brown as the panel contours, so
 *  the sun reads as part of the painting instead of a clip-art sticker
 *  laid over it. The print grain pass runs over the whole composite
 *  afterwards, which settles the disc into the surface for good. */
export function drawPaintedSun(ctx, cx, cy, r, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, grade.sunStops[0]);
  g.addColorStop(0.45, grade.sunStops[1]);
  g.addColorStop(0.72, grade.sunStops[1]);
  g.addColorStop(1, grade.sunStops[2]);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Soft painted bands: [centre offset (× r, from cy), height (× r), alpha].
  const bands = [[0.14, 0.1, 0.13], [0.36, 0.14, 0.17], [0.6, 0.19, 0.21], [0.85, 0.24, 0.25]];
  for (const [off, bh, a] of bands) {
    const y0 = cy + r * off - (r * bh) / 2;
    const bg = ctx.createLinearGradient(0, y0, 0, y0 + r * bh);
    bg.addColorStop(0, 'rgba(168, 52, 32, 0)');
    bg.addColorStop(0.5, `rgba(168, 52, 32, ${a})`);
    bg.addColorStop(1, 'rgba(168, 52, 32, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(cx - r, y0, r * 2, r * bh);
  }
  ctx.restore();
  // Thin ink outline, same family as the panel contour ink.
  const ink = grade.painterly?.ink ?? [46, 20, 44];
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - Math.max(1, r * 0.028), 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${ink[0]}, ${ink[1]}, ${ink[2]}, 0.55)`;
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.stroke();
  ctx.restore();
}

/** Classic slit sun: a disc with a vertical grade gradient (a grade may
 *  carry a richer `sunGrad` — Noir's runs white -> light grey -> mid grey
 *  -> deep grey so the disc keeps real shading instead of reading as a
 *  flat white sticker — and soft-edged dark-grey slits via `sunSlitSoft`,
 *  instead of hard pure-black bars), cut by widening horizontal gaps
 *  toward the bottom. A grade with `paintedSun` (Key Art) takes the
 *  painted disc above instead. */
export function drawSun(ctx, cx, cy, r, grade) {
  if (grade.paintedSun) { drawPaintedSun(ctx, cx, cy, r, grade); return; }
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  if (grade.sunGrad) {
    for (const [p, c] of grade.sunGrad) g.addColorStop(p, c);
  } else {
    g.addColorStop(0, grade.sunStops[0]);
    g.addColorStop(0.55, grade.sunStops[1]);
    g.addColorStop(1, grade.sunStops[2]);
  }
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  let yy = cy + r * 0.05;
  let gap = r * 0.045;
  while (yy < cy + r) {
    if (grade.sunSlitSoft) {
      // Soft slit: dark grey (never pure black) with feathered top and
      // bottom edges, so the bars read as shade printed into the disc.
      const sg = ctx.createLinearGradient(0, yy, 0, yy + gap);
      sg.addColorStop(0, 'rgba(38, 38, 38, 0.4)');
      sg.addColorStop(0.5, 'rgba(38, 38, 38, 0.92)');
      sg.addColorStop(1, 'rgba(38, 38, 38, 0.4)');
      ctx.fillStyle = sg;
    } else {
      ctx.fillStyle = grade.skyTop;
    }
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

function drawTitle(ctx, w, title, noir, size, baseline) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const grad = ctx.createLinearGradient(0, baseline - size, 0, baseline + size * 0.12);
  if (noir) {
    // Polished chrome: a lit crown, a hard bright band just above the
    // middle, a sudden drop to the dark horizon line, then the reflected
    // sheen below it and a deep base — the full chrome-lettering ramp of
    // the classic crime cover, never flat white or plain silver.
    grad.addColorStop(0, '#f8f8f8');
    grad.addColorStop(0.3, '#cfcfcf');
    grad.addColorStop(0.46, '#ffffff');
    grad.addColorStop(0.52, '#6f6f6f');
    grad.addColorStop(0.6, '#9a9a9a');
    grad.addColorStop(0.78, '#e2e2e2');
    grad.addColorStop(1, '#555555');
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
  } else {
    // Edge depth for the chrome: a pale rim stroked a hair above the
    // lettering first, so once the black outline and the chrome fill
    // land on top of it, a bright bevel line survives along the top
    // edge of every letter — the highlight a real chrome letter
    // catches, and the depth a flat silver fill never has.
    ctx.strokeStyle = 'rgba(235, 235, 235, 0.4)';
    ctx.lineWidth = size * 0.16 + Math.max(3, size * 0.05);
    ctx.strokeText(title, w / 2, baseline - size * 0.045);
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
  const mosaic = state.layout === 'mosaic';
  // Mosaic's lettering never overlays the grid: the nine cells occupy the
  // top ~78% of the canvas and the title + tagline sit in a title band of
  // their own below the grid (filled after the panels, before the
  // gutters), so all nine panels stay 100% visible — bottom row included
  // — in the editor and in every export.
  const gridH = mosaic ? Math.round(h * 0.78) : h;
  const { shapes } = panelShapes(w, gridH, state.layout);

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
  // The Mosaic title band: a deep strip in the grade's scrim colour below
  // the grid. It is filled before the gutter pass, so the grid's bottom
  // gutter line and pinstripe print cleanly across the band's top edge.
  if (mosaic) {
    const bg = ctx.createLinearGradient(0, gridH, 0, h);
    bg.addColorStop(0, `rgba(${grade.scrim}, 0.94)`);
    bg.addColorStop(1, `rgba(${grade.scrim}, 1)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, gridH, w, h - gridH);
  }
  strokeGutters();

  // Decor: slit sun on the sea panel's horizon (see sunAnchor — never
  // top-centre, where it sat on the middle subject's hat). The sun and its glow are clipped to the sea panel's
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
  // Print finishing over the composite, before the lettering.
  applyFinishing(ctx, w, h);

  // Lettering: gradient title with a double outline, neon script tagline.
  const title = (state.title || '').trim().toUpperCase();
  let titleBox = null;
  if (mosaic) {
    // In the band: the title is sized to the band's height and the pair
    // (title + tagline) is centred inside the strip — no scrim over the
    // panels is needed, the band is the scrim.
    const bandH = h - gridH;
    if (title) {
      const size = fitFont(ctx, title, w * 0.94, bandH * 0.46, 'Anton, "Arial Black", sans-serif');
      titleBox = drawTitle(ctx, w, title, noir, size, gridH + bandH * 0.55);
    }
  } else {
    // Scrim so the lettering reads over any photo.
    const scrim = ctx.createLinearGradient(0, h * 0.52, 0, h);
    scrim.addColorStop(0, `rgba(${grade.scrim}, 0)`);
    scrim.addColorStop(1, `rgba(${grade.scrim}, 0.82)`);
    ctx.fillStyle = scrim;
    ctx.fillRect(0, h * 0.52, w, h * 0.48);
    if (title) {
      const size = fitFont(ctx, title, w * 0.94, h * 0.17, 'Anton, "Arial Black", sans-serif');
      titleBox = drawTitle(ctx, w, title, noir, size, h * 0.865);
    }
  }
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
