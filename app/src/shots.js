// Fixed scenes for screenshots, driven by the URL query:
//   ?shot=editor&layout=trio&grade=sunset&size=1080x1080 — the editor live.
//   ?shot=cover&layout=trio&grade=noir&size=1920x1080 — the exported PNG itself,
//   shown full-bleed so the screenshot is the PNG the app wrote, scaled down.
// `photo` picks the sample for panel 1 (samples/<photo>.jpg), `photo2` for
// panel 2. window.__shotReady is set once the scene is painted.
import { GRADES, LAYOUTS, SIZES } from './poster.js';

export async function runShot(shot, query, helpers) {
  const { state, loadImage, redraw, exportPNG, markReady } = helpers;

  if (query.get('layout') && LAYOUTS[query.get('layout')]) state.layout = query.get('layout');
  if (query.get('grade') && GRADES[query.get('grade')]) state.grade = query.get('grade');
  if (query.get('size') && SIZES[query.get('size')]) state.size = query.get('size');
  if (query.get('title')) state.title = query.get('title');
  if (query.get('tagline')) state.tagline = query.get('tagline');

  // Load the samples into the panels (panel 2 may take its own sample).
  const first = `samples/${query.get('photo') ?? 'boulevard'}.jpg`;
  const second = `samples/${query.get('photo2') ?? 'pier'}.jpg`;
  const [imgA, imgB] = await Promise.all([loadImage(first), loadImage(second)]);
  state.panels[0].img = imgA;
  state.panels[0].src = first;
  if (state.panels[1]) { state.panels[1].img = imgB; state.panels[1].src = second; }
  if (state.panels[2]) { state.panels[2].img = imgA; state.panels[2].src = first; }

  // Keep the editor controls in sync with the scene's choices.
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('on', b.dataset.size === state.size));
  document.getElementById('title').value = state.title;
  document.getElementById('tagline').value = state.tagline;

  await document.fonts.ready;
  redraw();

  if (shot === 'cover') {
    // Show the exported PNG itself, not the live canvas.
    const blob = await exportPNG();
    const url = URL.createObjectURL(blob);
    const img = document.createElement('img');
    img.id = 'shotCover';
    img.src = url;
    img.alt = 'Exported cover PNG';
    await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
    document.body.classList.add('shot-cover');
    document.querySelector('.stage').replaceChildren(img);
  }

  requestAnimationFrame(() => requestAnimationFrame(markReady));
}
