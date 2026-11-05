# Reely BrosWars Studio

- `engine/engine.html` + `engine/render.js` – vykreslí reel 1080×1920 / 30 fps z JSON specifikace (`node engine/render.js specs/X.json out/X.mp4`; s 3. argumentem `1,4,8` jen náhledové snímky).
- Typy scén: `hook` (velký text, volitelně `bg`), `image` (fotka + text), `clip` (gameplay video z `assets/clips`), `chat` (konverzace), `list` (body), `cta` (ikona/`art`, nadpis, `pill`, `foot`). Zvýraznění slov: `*slovo*`.
- Motivy barev: `specs/_themes.json`. Hudba: `assets/music` (Pixabay licence).
- Hotová videa se kopírují do `/r/` (veřejně na https://broswarsstudio.chatnelo.com/r/NAZEV.mp4) a fronta publikace je v `queue.json`.
