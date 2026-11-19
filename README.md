# gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/cleoworks/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/cleoworks/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

VICE COVER turns your photos and a caption into GTA 6-style poster cover art: multi-panel layouts (Vice Trio, Split Duo, Solo Hero, a five-panel Cover Grid with one hero panel and four satellites, and Mosaic — a nine-panel 3×3 grid in the classic cover pattern whose lettering sits in a title band below the grid, so all nine panels stay fully visible), a sunset-gradient title with a double outline (a polished chrome gradient in Noir), a neon script tagline, and five colour grades (Sunset, Neon, Palm Gold, Noir, and Poster Ink — a bold screen-print duotone with a firmer posterize and a jittered halftone dot screen that lives in smooth highlights — sky, sea, glint — and fades out over detailed texture (fabric, hair) and off bright neutral surfaces like white clothing entirely, never on faces), all applied as true gradient maps with a light cel-shade posterize. Noir and Poster Ink carry shadow protection: through the shadows their ramps cross-fade to an un-posterized gradient map, so a face sitting in shade — or a whole photo taken at night — keeps its features instead of collapsing into one flat tone; Noir additionally runs an ordered Bayer dither through its posterize, breaking the flat grey plateaus a B/W quantization leaves on faces into a fine print texture that restores their tonal modelling. An automatic exposure lift steadies dark photos before grading (measured on the photo's mean luminance; bright photos pass through completely untouched, genuinely very dark photos get a substantially stronger lift whose highlight shoulder keeps lit neon signs separated instead of blown out, and night shots still look like night). Where a layout has more panels than loaded photos, a photo's later showings are mirrored and re-cropped, so a repeat reads as a different moment of the same shoot rather than a copy-paste. Six bundled sample photos (three bright Vice scenes, a neon night portrait, a marina portrait in a red dress and a surfer carrying her board at golden hour) show the range; drop in any photos of your own, drag to crop each panel, pick a post size (square, portrait or landscape), and export a share-ready PNG — one size, or all three sizes at once. Everything runs locally in the browser — your photos never leave your machine, and the app works fully offline with no network calls and no Rockstar artwork, logos or fonts.

Open `app/index.html` in a browser to use it.

## Run it

```sh
node main.ts
```

`main.ts` (Node 22, standard library only, no network) writes the submission dossier for the entry.

---

<sub>Entered on [make.fun](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
