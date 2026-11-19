// VICE COVER editor wiring: photo per panel, crop by drag, zoom, caption,
// layout / grade / size pickers, and PNG export at the chosen post size.
// Photos are read on this machine only (object URLs / bundled samples).
import { drawPoster, renderExport, panelShapes, GRADES, LAYOUTS, SIZES } from './poster.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('stage');
const statusEl = document.getElementById('status');
const titleInput = document.getElementById('title');
const tagInput = document.getElementById('tagline');
const zoomInput = document.getElementById('zoom');
const zoomVal = document.getElementById('zoomVal');
const panelLabel = document.getElementById('panelLabel');

const SAMPLES = ['samples/boulevard.jpg', 'samples/pier.jpg', 'samples/convertible.jpg'];

const state = {
  layout: 'trio',
  grade: 'sunset',
  size: '1080x1080',
  title: 'VICE HEAT',
  tagline: 'ONE LAST SCORE IN THE SUNSET',
  active: 0,
  panels: [
    { src: SAMPLES[0], img: null, zoom: 1.1, ox: 0, oy: 0.55 },
    { src: SAMPLES[1], img: null, zoom: 1.1, ox: 0, oy: 0.55 },
    { src: SAMPLES[2], img: null, zoom: 1.1, ox: 0, oy: 0.55 },
    { src: SAMPLES[0], img: null, zoom: 1.35, ox: 0.3, oy: 0.4 },
    { src: SAMPLES[1], img: null, zoom: 1.02, ox: 0.3, oy: 1 },
  ],
};

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function previewSize() {
  const [w, h] = SIZES[state.size];
  const scale = 900 / Math.max(w, h);
  return [Math.round(w * scale), Math.round(h * scale)];
}

export function redraw() {
  const [w, h] = previewSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawPoster(canvas, state);
  syncPanelControls();
}

function syncPanelControls() {
  const p = state.panels[state.active];
  const count = LAYOUTS[state.layout].panels;
  panelLabel.textContent = `Panel ${state.active + 1} of ${count}`;
  zoomInput.value = String(Math.round(p.zoom * 100));
  zoomVal.textContent = `${Math.round(p.zoom * 100)}%`;
  document.querySelectorAll('.panel-pick').forEach((b, i) => {
    b.disabled = i >= count;
    b.classList.toggle('on', i === state.active && i < count);
  });
}

function markReady() {
  window.__shotReady = true;
}

async function loadSamples() {
  await Promise.all(state.panels.map(async (p) => {
    if (!p.img) p.img = await loadImage(p.src);
  }));
}

async function setPanelPhoto(i, src, img) {
  state.panels[i].src = src;
  state.panels[i].img = img;
  state.panels[i].zoom = 1.1;
  state.panels[i].ox = 0;
  state.panels[i].oy = 0.55;
  redraw();
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

// --- Control wiring -------------------------------------------------------

document.querySelectorAll('[data-layout]').forEach((b) => {
  b.addEventListener('click', () => {
    state.layout = b.dataset.layout;
    if (state.active >= LAYOUTS[state.layout].panels) state.active = 0;
    document.querySelectorAll('[data-layout]').forEach((x) => x.classList.toggle('on', x === b));
    redraw();
  });
});

document.querySelectorAll('[data-grade]').forEach((b) => {
  b.addEventListener('click', () => {
    state.grade = b.dataset.grade;
    document.querySelectorAll('[data-grade]').forEach((x) => x.classList.toggle('on', x === b));
    redraw();
  });
});

document.querySelectorAll('[data-size]').forEach((b) => {
  b.addEventListener('click', () => {
    state.size = b.dataset.size;
    document.querySelectorAll('[data-size]').forEach((x) => x.classList.toggle('on', x === b));
    redraw();
  });
});

document.querySelectorAll('.panel-pick').forEach((b, i) => {
  b.addEventListener('click', () => {
    state.active = i;
    redraw();
  });
});

document.getElementById('photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = await loadImage(URL.createObjectURL(file));
  await setPanelPhoto(state.active, `upload:${file.name}`, img);
  setStatus(`Loaded ${file.name} into panel ${state.active + 1}.`);
  e.target.value = '';
});

document.querySelectorAll('[data-sample]').forEach((b) => {
  b.addEventListener('click', async () => {
    const img = await loadImage(b.dataset.sample);
    await setPanelPhoto(state.active, b.dataset.sample, img);
    setStatus(`Sample photo loaded into panel ${state.active + 1}.`);
  });
});

document.getElementById('fillAll').addEventListener('click', () => {
  const src = state.panels[state.active];
  state.panels.forEach((p, i) => {
    if (i === state.active) return;
    p.src = src.src;
    p.img = src.img;
    p.zoom = src.zoom;
    p.ox = src.ox;
    p.oy = src.oy;
  });
  redraw();
  setStatus('Same photo in every panel — crop each one differently if you like.');
});

document.getElementById('resetFrame').addEventListener('click', () => {
  const p = state.panels[state.active];
  p.zoom = 1.1;
  p.ox = 0;
  p.oy = 0.55;
  redraw();
});

zoomInput.addEventListener('input', () => {
  state.panels[state.active].zoom = Number(zoomInput.value) / 100;
  redraw();
});

titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
tagInput.addEventListener('input', () => { state.tagline = tagInput.value; redraw(); });

// Drag on the canvas pans the active panel's photo; wheel zooms it.
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const r = canvas.getBoundingClientRect();
  const p = state.panels[state.active];
  const shape = panelShapes(canvas.width, canvas.height, state.layout).shapes[state.active];
  const pw = (shape ? shape.w / canvas.width : 1 / LAYOUTS[state.layout].panels) * r.width;
  const ph = (shape ? shape.h / canvas.height : 1) * r.height;
  p.ox += ((e.clientX - drag.x) / pw) * 1.6;
  p.oy += ((e.clientY - drag.y) / ph) * 1.6;
  p.ox = Math.max(-1, Math.min(1, p.ox));
  p.oy = Math.max(-1, Math.min(1, p.oy));
  drag = { x: e.clientX, y: e.clientY };
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = state.panels[state.active];
  p.zoom = Math.max(1, Math.min(3, p.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  redraw();
}, { passive: false });

// Export: render at full post size and download the PNG.
function download(canvasOut, name) {
  return new Promise((resolve) => {
    canvasOut.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
}

document.getElementById('export').addEventListener('click', async () => {
  const [w, h] = SIZES[state.size];
  await download(renderExport(state), `vice-cover-${w}x${h}.png`);
  setStatus(`Saved vice-cover-${w}x${h}.png — ${w} x ${h}.`);
});

// Export all sizes: one PNG per post size, from the current poster state.
document.getElementById('exportAll').addEventListener('click', async () => {
  const keys = Object.keys(SIZES);
  for (let i = 0; i < keys.length; i++) {
    const [w, h] = SIZES[keys[i]];
    await download(renderExport(state, keys[i]), `vice-cover-${w}x${h}.png`);
    if (i < keys.length - 1) await new Promise((r) => setTimeout(r, 350));
  }
  setStatus('Saved all three post sizes — 1080 x 1080, 1080 x 1350, 1920 x 1080.');
});

/** Export the current poster as a PNG blob (used by the cover screenshot scene). */
export function exportPNG() {
  return new Promise((resolve) => renderExport(state).toBlob(resolve, 'image/png'));
}

// --- Boot -----------------------------------------------------------------

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, { state, loadImage, redraw, exportPNG, markReady, setStatus });
} else {
  loadSamples()
    .then(() => Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px Yellowtail'),
      document.fonts.ready,
    ]))
    .then(() => redraw())
    .catch(() => redraw());
}
