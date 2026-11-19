// VICE COVER poster renderer: draws a multi-panel GTA-style poster onto any
// 2D canvas. Pure drawing code — no network, no DOM input, no Rockstar assets.
// A poster is: slanted photo panels + a slit sun + code-drawn palm silhouettes
// + a scrim + layered display lettering (outline, gradient fill, shadow).

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

export const LAYOUTS = {
  trio: { panels: 3, slant: 0.045, label: 'Vice Trio' },
  duo: { panels: 2, slant: 0.055, label: 'Split Duo' },
  solo: { panels: 1, slant: 0, label: 'Solo Hero' },
};

export const GRADES = {
  sunset: {
    label: 'Sunset',
    sky: ['#2b1055', '#7597de'],
    skyTop: '#1c0b3d',
    tint: 'rgba(255, 94, 60, 0.20)',
    sun: '#ffd166',
    sunCore: '#fff3b0',
    titleFrom: '#fff7ae',
    titleTo: '#ff7b00',
    accent: '#ff2e63',
    tagText: '#1c0b3d',
    scrim: '10, 4, 20',
  },
  neon: {
    label: 'Neon Nights',
    sky: ['#0f0c29', '#302b63'],
    skyTop: '#080614',
    tint: 'rgba(255, 0, 168, 0.18)',
    sun: '#00f5ff',
    sunCore: '#d8fbff',
    titleFrom: '#a5fbff',
    titleTo: '#ff00a8',
    accent: '#00f5ff',
    tagText: '#080614',
    scrim: '6, 2, 24',
  },
  gold: {
    label: 'Palm Gold',
    sky: ['#3a2503', '#8a5a00'],
    skyTop: '#241703',
    tint: 'rgba(255, 183, 0, 0.18)',
    sun: '#ffe9a3',
    sunCore: '#fffbe0',
    titleFrom: '#fff3b0',
    titleTo: '#e8a100',
    accent: '#ffb700',
    tagText: '#241703',
    scrim: '20, 12, 2',
  },
  noir: {
    label: 'Noir',
    sky: ['#0a0a0a', '#4a4a4a'],
    skyTop: '#050505',
    tint: 'rgba(255, 255, 255, 0.10)',
    sun: '#e8e8e8',
    sunCore: '#ffffff',
    titleFrom: '#ffffff',
    titleTo: '#9a9a9a',
    accent: '#f2f2f2',
    tagText: '#0a0a0a',
    scrim: '0, 0, 0',
  },
};

/** Panel polygons for a layout: slanted quads leaning right as they fall. */
export function panelShapes(w, h, layout) {
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

function tracePoly(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

/** Draws one photo cover-filling a panel, with zoom and pan offsets.
 *  ox, oy in [-1, 1]; oy > 0 favours the top of the photo (faces stay in). */
export function drawPanelPhoto(ctx, shape, photo) {
  const { img, zoom = 1, ox = 0, oy = 0.55 } = photo;
  if (!img) return;
  const { x, y, w, h } = shape;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(w / iw, h / ih);
  const dw = iw * base * zoom;
  const dh = ih * base * zoom;
  const ex = dw - w;
  const ey = dh - h;
  const dx = x - ex / 2 + (ox * ex) / 2;
  const dy = y - ey / 2 + (oy * ey) / 2;
  ctx.save();
  tracePoly(ctx, shape.poly);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** Classic slit sun: a disc cut by widening horizontal gaps toward the bottom. */
export function drawSun(ctx, cx, cy, r, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, grade.sunCore);
  g.addColorStop(1, grade.sun);
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
  ctx.restore();
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

function fitTitleFont(ctx, text, maxW, startSize, family) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (ctx.measureText(text).width > maxW && size > 12) {
    size -= 2;
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

/**
 * Draws the whole poster. `state` is:
 * { layout, grade, panels: [{img, zoom, ox, oy}...], title, tagline }
 * The canvas keeps its own width/height; export uses a full-size canvas.
 */
export function drawPoster(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const { shapes, slant } = panelShapes(w, h, state.layout);

  // Sky base (shows through only where panels do not cover).
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(0.55, grade.sky[0]);
  sky.addColorStop(1, grade.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Panels: photo, then grade wash, then slanted dividers.
  const noir = state.grade === 'noir';
  for (let i = 0; i < shapes.length; i++) {
    const photo = state.panels[i];
    if (photo && photo.img) {
      if (noir) ctx.filter = 'grayscale(1) contrast(1.12) brightness(1.06)';
      drawPanelPhoto(ctx, shapes[i], photo);
      if (noir) ctx.filter = 'none';
    } else {
      // Empty panel: deep gradient so the poster never shows a hole.
      ctx.save();
      tracePoly(ctx, shapes[i].poly);
      ctx.clip();
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, grade.sky[0]);
      g.addColorStop(1, grade.skyTop);
      ctx.fillStyle = g;
      ctx.fillRect(shapes[i].x, 0, shapes[i].w, h);
      ctx.restore();
    }
    ctx.save();
    tracePoly(ctx, shapes[i].poly);
    ctx.clip();
    ctx.fillStyle = grade.tint;
    ctx.fillRect(shapes[i].x, 0, shapes[i].w, h);
    ctx.restore();
  }
  if (shapes.length > 1) {
    for (let i = 0; i < shapes.length - 1; i++) {
      const tx = shapes[i].dividerTop;
      ctx.strokeStyle = 'rgba(8, 4, 18, 0.9)';
      ctx.lineWidth = Math.max(4, w * 0.008);
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.lineTo(tx + slant, h);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = Math.max(1.5, w * 0.002);
      ctx.beginPath();
      ctx.moveTo(tx + Math.max(4, w * 0.008) / 2 + 1, 0);
      ctx.lineTo(tx + slant + Math.max(4, w * 0.008) / 2 + 1, h);
      ctx.stroke();
    }
  }

  // Decor: slit sun tucked high at top centre, above the faces' eye line,
  // palms framing the lower corners.
  drawSun(ctx, w * 0.5, h * 0.075, Math.min(w, h) * 0.07, grade);
  const palmColor = 'rgba(10, 4, 18, 0.88)';
  drawPalm(ctx, w * 0.02, h * 0.99, h * 0.3, false, palmColor);
  drawPalm(ctx, w * 0.99, h * 1.0, h * 0.25, true, palmColor);

  // Scrim so the lettering reads over any photo.
  const scrim = ctx.createLinearGradient(0, h * 0.52, 0, h);
  scrim.addColorStop(0, `rgba(${grade.scrim}, 0)`);
  scrim.addColorStop(1, `rgba(${grade.scrim}, 0.82)`);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.52, w, h * 0.48);

  // Title: layered lettering — shadow, thick dark outline, vertical gradient.
  const title = (state.title || '').trim().toUpperCase();
  if (title) {
    const size = fitTitleFont(ctx, title, w * 0.94, h * 0.17, 'Anton, "Arial Black", sans-serif');
    const baseline = h * 0.9;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    const grad = ctx.createLinearGradient(0, baseline - size, 0, baseline + size * 0.12);
    grad.addColorStop(0, grade.titleFrom);
    grad.addColorStop(1, grade.titleTo);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.05;
    ctx.strokeStyle = '#14081f';
    ctx.lineWidth = size * 0.16;
    ctx.strokeText(title, w / 2, baseline);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = grad;
    ctx.fillText(title, w / 2, baseline);
    // Thin bright top edge on the letters for a printed-poster feel.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = Math.max(1, size * 0.015);
    ctx.strokeText(title, w / 2, baseline);
  }

  // Tagline: skewed accent bar with condensed dark caps.
  const tag = (state.tagline || '').trim().toUpperCase();
  if (tag) {
    const barH = h * 0.052;
    const barY = h * 0.925;
    let size = barH * 0.62;
    ctx.font = `${size}px "Bebas Neue", "Arial Narrow", sans-serif`;
    try { ctx.letterSpacing = `${Math.max(2, size * 0.14)}px`; } catch (e) { /* older canvas: no letter-spacing */ }
    let tw = ctx.measureText(tag).width;
    while (tw > w * 0.8 && size > 10) {
      size -= 1;
      ctx.font = `${size}px "Bebas Neue", "Arial Narrow", sans-serif`;
      tw = ctx.measureText(tag).width;
    }
    const skew = barH * 0.5;
    const barW = tw + size * 2.2;
    const bx = (w - barW) / 2;
    ctx.fillStyle = grade.accent;
    ctx.beginPath();
    ctx.moveTo(bx + skew, barY);
    ctx.lineTo(bx + barW + skew, barY);
    ctx.lineTo(bx + barW, barY + barH);
    ctx.lineTo(bx, barY + barH);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = grade.tagText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, w / 2 + skew / 2, barY + barH / 2 + size * 0.04);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* reset */ }
  }

  // Thin poster frame.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = Math.max(2, w * 0.002);
  ctx.strokeRect(w * 0.012, h * 0.012, w * 0.976, h * 0.976);
}

/** Renders the poster at full export size and returns the canvas. */
export function renderExport(state) {
  const [w, h] = SIZES[state.size] ?? SIZES['1080x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawPoster(canvas, state);
  return canvas;
}
