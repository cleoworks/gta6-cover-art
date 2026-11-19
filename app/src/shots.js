// Fixed scenes for screenshots, driven by the URL query:
//   ?shot=editor&layout=trio&grade=sunset&size=1080x1080 — the editor live.
//   ?shot=cover&layout=trio&grade=noir&size=1920x1080 — the exported PNG itself,
//   shown full-bleed so the screenshot is the PNG the app wrote, scaled down.
// `photo` picks the sample for panel 1 (samples/<photo>.jpg), `photo2` for
// panel 2, `photo3` for panel 3, `photo4` for panel 4 (the night sample)
// and `photo5` for panel 5 (the marina sample) — so a Grid shows five
// different photos and Mosaic rotates five. window.__shotReady is set
// once the scene is painted.
import { GRADES, LAYOUTS, SIZES } from './poster.js';

export async function runShot(shot, query, helpers) {
  const { state, loadImage, redraw, exportPNG, markReady } = helpers;

  if (query.get('layout') && LAYOUTS[query.get('layout')]) state.layout = query.get('layout');
  if (query.get('grade') && GRADES[query.get('grade')]) state.grade = query.get('grade');
  if (query.get('size') && SIZES[query.get('size')]) state.size = query.get('size');
  if (query.get('title')) state.title = query.get('title');
  if (query.get('tagline')) state.tagline = query.get('tagline');

  // Load the samples into the panels: five distinct photos up front —
  // so a TRIO shows three different photos, a Grid five panels over five
  // photos, and Mosaic repeats less.
  const first = `samples/${query.get('photo') ?? 'boulevard'}.jpg`;
  const second = `samples/${query.get('photo2') ?? 'pier'}.jpg`;
  const third = `samples/${query.get('photo3') ?? 'convertible'}.jpg`;
  const fourth = `samples/${query.get('photo4') ?? 'night'}.jpg`;
  const fifth = `samples/${query.get('photo5') ?? 'marina'}.jpg`;
  const [imgA, imgB, imgC, imgD, imgE] = await Promise.all([loadImage(first), loadImage(second), loadImage(third), loadImage(fourth), loadImage(fifth)]);
  const put = (i, src, img, framing) => {
    if (!state.panels[i]) return;
    state.panels[i].img = img;
    state.panels[i].src = src;
    if (framing) Object.assign(state.panels[i], framing);
  };
  put(0, first, imgA);
  put(1, second, imgB);
  put(2, third, imgC);
  put(3, fourth, imgD);
  put(4, fifth, imgE);

  // Keep the editor controls in sync with the scene's choices.
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('on', b.dataset.size === state.size));
  document.getElementById('title').value = state.title;
  document.getElementById('tagline').value = state.tagline;

  // Wait for the display faces explicitly: fonts.ready alone can resolve
  // before an unused @font-face (Yellowtail) has actually been fetched.
  await Promise.all([
    document.fonts.load('80px Anton'),
    document.fonts.load('40px Yellowtail'),
    document.fonts.load('40px "Bebas Neue"'),
    document.fonts.ready,
  ]);
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
