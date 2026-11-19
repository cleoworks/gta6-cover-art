// Fixed scenes for screenshots, driven by the URL query:
//   ?shot=editor&layout=trio&grade=sunset&size=1080x1080 — the editor live.
//   ?shot=cover&layout=trio&grade=noir&size=1920x1080 — the exported PNG itself,
//   shown full-bleed so the screenshot is the PNG the app wrote, scaled down.
// `photo` picks the sample for panel 1 (samples/<photo>.jpg), `photo2` for
// panel 2, `photo3` for panel 3, `photo4` for panel 4 (the night sample),
// `photo5` for panel 5 (the marina sample) and `photo6` for panel 6 (the
// surfer sample); panels 7-9 repeat panels 1-3 with the same Image
// objects, so the renderer mirrors them — a Grid shows five different
// photos and Mosaic rotates six. window.__shotReady is set
// once the scene is painted.
import { GRADES, LAYOUTS, SIZES } from './poster.js';

export async function runShot(shot, query, helpers) {
  const { state, loadImage, redraw, exportPNG, markReady } = helpers;

  if (query.get('layout') && LAYOUTS[query.get('layout')]) state.layout = query.get('layout');
  if (query.get('grade') && GRADES[query.get('grade')]) state.grade = query.get('grade');
  if (query.get('size') && SIZES[query.get('size')]) state.size = query.get('size');
  if (query.get('title')) state.title = query.get('title');
  if (query.get('tagline')) state.tagline = query.get('tagline');
  if (query.get('dressing')) state.dressing = query.get('dressing') !== '0';

  // Load the samples into the panels: six distinct photos up front —
  // so a TRIO shows three different photos, a Grid five panels over five
  // photos, and Mosaic repeats less (six photos over nine cells).
  const first = `samples/${query.get('photo') ?? 'boulevard'}.jpg`;
  const second = `samples/${query.get('photo2') ?? 'pier'}.jpg`;
  const third = `samples/${query.get('photo3') ?? 'convertible'}.jpg`;
  const fourth = `samples/${query.get('photo4') ?? 'night'}.jpg`;
  const fifth = `samples/${query.get('photo5') ?? 'marina'}.jpg`;
  const sixth = `samples/${query.get('photo6') ?? 'surfer'}.jpg`;
  const [imgA, imgB, imgC, imgD, imgE, imgF] = await Promise.all([loadImage(first), loadImage(second), loadImage(third), loadImage(fourth), loadImage(fifth), loadImage(sixth)]);
  const put = (i, src, img, framing) => {
    if (!state.panels[i]) return;
    state.panels[i].img = img;
    state.panels[i].src = src;
    if (framing) Object.assign(state.panels[i], framing);
  };
  // The Blockbuster Grid showcase's hero framing (round 13): a mid
  // shot, not the old tight crop. At zoom 1.22 the photo's window
  // ended at her belt, so everything the title band covered was her —
  // the band cut her at the neck and left a floating head with no
  // body and no car. At zoom 1, favouring the top of the photo, the
  // window runs from just above her hair to her upper thighs: head,
  // shoulders and upper chest stay ABOVE the title's top edge, and
  // what the letters and the script cross below them is the car's
  // zone and her belt line — the winners' pattern, where the
  // lettering rides the car, never the person. The sky band across
  // the panel's top still clears her hair for the review row (her
  // hair's top lands ~0.10 down the panel, the pill ends at 0.074).
  // Only this scene is reframed; every other shot keeps the
  // renderer's default framing exactly.
  const heroFrame = (state.layout === 'grid' && state.grade === 'blockbuster')
    ? { zoom: 1, oy: 0.85 }
    : undefined;
  // The Blockbuster Grid showcase's scene panels get their own
  // framings, for the same reason the hero does. The causeway photo
  // (round 16: a lifeguard tower with the sun blazing through it)
  // is a wide sunset shot whose tower stands right of centre, while
  // its cell (bottom-left, beside the title band) only shows its
  // right strip clear of the letters: the showcase zooms in and
  // pans so that strip holds the tower's sunlit cabin and slats,
  // rides to the bottom of the frame (oy -1) so the strip ends on
  // the sand between the tower's legs, and the panel's chip — which
  // the buried rule parks low in that same cell — lands on open
  // sand between the legs, clear of the tower, the distant walkers
  // and every palm. The neon street (round 16: a sports car under
  // Ueno signage) is a portrait shot that fills its cell whole; its
  // pan is a no-op kept for symmetry with the old crowd shot's
  // framing. Any other scene keeps the renderer's default framing
  // exactly.
  const showcaseScene = state.layout === 'grid' && state.grade === 'blockbuster';
  const coastFrame = (showcaseScene && third.endsWith('coast.jpg'))
    ? { zoom: 1.38, ox: -0.17, oy: -1 }
    : undefined;
  const neonFrame = (showcaseScene && fourth.endsWith('neon.jpg'))
    ? { ox: 0.35 }
    : undefined;
  put(0, first, imgA, heroFrame);
  put(1, second, imgB);
  put(2, third, imgC, coastFrame);
  put(3, fourth, imgD, neonFrame);
  put(4, fifth, imgE);
  put(5, sixth, imgF);
  // Mosaic's last row: second showings of the first three photos, sharing
  // their Image objects so the renderer mirrors them like the editor does.
  put(6, first, imgA);
  put(7, second, imgB);
  put(8, third, imgC);

  // Keep the editor controls in sync with the scene's choices.
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('on', b.dataset.size === state.size));
  document.getElementById('title').value = state.title;
  document.getElementById('tagline').value = state.tagline;
  const dressingBtn = document.getElementById('dressingBtn');
  dressingBtn.classList.toggle('on', !!state.dressing);
  dressingBtn.textContent = state.dressing ? 'Poster dressing: On' : 'Poster dressing: Off';

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
