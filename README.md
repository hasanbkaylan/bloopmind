<div align="center">

<img src="assets/favicon.svg" alt="BloopMind logo" width="96" height="96">

# BloopMind

**Reminders that live as bubbles.**<br>
Drop them in a glass box, watch them bounce, and let time make the important ones grow.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
![No dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![Vanilla JavaScript](https://img.shields.io/badge/JavaScript-vanilla-f7df1e)
![Languages](https://img.shields.io/badge/languages-EN%20%C2%B7%20TR%20%C2%B7%20DE-informational)

</div>

<!-- Add a screenshot or GIF here once you have one:
<p align="center"><img src="docs/screenshot.png" alt="BloopMind screenshot" width="360"></p>
-->

---

## Why BloopMind?

A to-do list is a flat column of equally important lines. BloopMind is a box of bubbles instead. Every reminder you add falls into the box, collides with its neighbours and settles at the bottom. The longer a reminder sits there, the bigger its bubble gets, so the things you keep putting off become hard to ignore. When you are done with one, you hold it until it pops.

It is a single static web app: no account, no server, no build step, no dependencies.

## Features

- **Physics-driven bubbles.** A custom circle-physics engine gives bubbles weight, bounce, friction and a little jelly squash on impact.
- **Time-aware sizing.** Bubbles start small and grow as they age. Their color stays the same, so you can recognise each one at a glance.
- **A box that fills up.** Each box has limited room. When it is full, pop a bubble or open a new box (up to eight).
- **Tap, hold, drag.** Tap a bubble for details, hold it to pop it, or drag and toss it around the box.
- **Undo.** Popped by accident? A toast offers to bring the bubble back.
- **Due dates.** Add an optional date; bubbles that are due or overdue get a warning badge.
- **39 icons** and automatically chosen, well-spaced colors for every reminder.
- **Settings panel.** Turn sound on or off, switch language, and see project details (version, author, license, source link).
- **Multilingual.** English, Turkish (Türkçe) and German (Deutsch), picked from your browser language and changeable at any time. Dates and relative times are localized with the browser's `Intl` APIs.
- **Procedural sound.** Every collision, pop and click is synthesized live with the Web Audio API. There are no audio files.
- **Private by design.** Everything is stored in your browser's `localStorage`. Nothing is sent anywhere.
- **Light and dark themes** that follow your system setting.
- **Accessible.** Keyboard-operable dialogs, a screen-reader list of all reminders, visible focus states and `prefers-reduced-motion` support.
- **Works on desktop and mobile**, with touch gestures and safe-area handling.

## Quick start

BloopMind is plain HTML, CSS and JavaScript, so there is nothing to install.

**Option 1: open the file**

Download or clone the repository and open `index.html` in a modern browser.

**Option 2: serve it locally**

```bash
git clone https://github.com/hasanbkaylan/bloopmind.git
cd bloopmind

# any static server works, for example:
python3 -m http.server 8080
# then visit http://localhost:8080
```

> The UI fonts (Bricolage Grotesque and Figtree) are loaded from Google Fonts. If they cannot be reached, the app falls back to your system fonts and works exactly the same.

## How to use it

| Action | What it does |
| --- | --- |
| **Add** button | Opens the new-reminder sheet. Pick a title, an optional note, an icon and an optional date. |
| **Tap** a bubble | Opens its details so you can edit or pop it. |
| **Hold** a bubble | A ring fills up, then the bubble pops. |
| **Drag** a bubble | Pick it up and throw it around. |
| **Gear** button | Opens settings: sound, language and project info. |
| **Esc** | Closes the open sheet or settings panel. |

The first launch fills the box with a few example reminders so you can try everything right away. Use **Delete examples** in the header to clear them.

## Project structure

```
bloopmind/
├── index.html            App shell and markup
├── css/
│   └── style.css         Themes, layout, sheets and settings styles
├── js/
│   ├── physics.js        Circle physics engine (position-based dynamics)
│   ├── icons.js          Icon set and canvas icon rasteriser
│   ├── i18n.js           Tiny translation layer
│   ├── locales/
│   │   ├── en.js         English (fallback language)
│   │   ├── tr.js         Turkish
│   │   └── de.js         German
│   ├── sound.js          Web Audio sound effects
│   └── app.js            State, rendering, input, sheets and settings
├── assets/
│   └── favicon.svg       Logo and favicon
├── LICENSE               GNU GPL v3
└── README.md
```

The scripts are classic (non-module) scripts loaded in order, so the app also works when you open `index.html` straight from disk, where ES modules would be blocked by the browser.

## Adding a language

Translations live in `js/locales/`, one file per language, and English is the fallback for any missing key.

1. Copy `js/locales/en.js` to `js/locales/<code>.js`, for example `fr.js`.
2. Change the first line of the registration to your language code and its native name:

   ```js
   I18n.register('fr', 'Français', {
     'add': 'Ajouter',
     // ...translate every value, keep the keys
   });
   ```

3. Add a script tag for it in `index.html`, before `js/sound.js`:

   ```html
   <script src="js/locales/fr.js"></script>
   ```

That is all: the language shows up in the settings panel and is also picked automatically when it matches the browser language.

Notes for translators:

- `{n}`, `{t}`, `{d}` and `{rel}` are placeholders. Keep them in your translation.
- Counts use `count.one` and `count.other`, chosen with `Intl.PluralRules`. Languages that need more plural forms can extend `I18n.tn` in `js/i18n.js`.
- The `ex.*` keys are the example reminders created on first launch.

## How it works

- **Rendering.** The box and bubbles are drawn on a single `<canvas>` with gradients and highlights. The sheets, header and settings are regular HTML.
- **Physics.** `js/physics.js` implements position-based dynamics with a fixed 480 Hz sub-step, a few constraint iterations per step, tangential friction and restitution. The box has a floor and two walls, with an open top.
- **Sizing.** A bubble's radius follows `rMin + (rMax - rMin) * (1 - e^(-days / 9))`. If the combined bubble area exceeds the box capacity, bubbles are scaled down to fit until you free up room.
- **Storage.** State is saved to `localStorage` under the key `bloopmind.v1`, and the chosen language under `bloopmind.lang`. Stored data is validated when it is loaded.
- **Sound.** `js/sound.js` builds every effect from oscillators and filtered noise, with a compressor on the output to keep it comfortable.

## Browser support

Any current version of Chrome, Edge, Firefox or Safari, on desktop or mobile. BloopMind uses `<canvas>`, Pointer Events, the Web Audio API, `Intl.RelativeTimeFormat`, `Intl.PluralRules` and CSS `color-mix()`.

## Privacy

BloopMind has no backend, analytics or accounts. Your reminders never leave your device. Clearing your browser's site data for the page removes them.

The only external request is for the fonts from Google Fonts. If you prefer to avoid it, remove the three `fonts.googleapis.com` / `fonts.gstatic.com` lines from `index.html` or self-host the fonts.

## Deploying on GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`.
4. Your app will be available at `https://hasanbkaylan.github.io/bloopmind/`.

## Contributing

Bug reports, ideas and pull requests are welcome. For larger changes, please open an issue first so we can talk it through. Because the project has no build step, you can edit the files and refresh the browser to see your changes.

If you add a user-facing string, add its key to every file in `js/locales/`.

## License

BloopMind is free software, released under the **GNU General Public License v3.0**. You can redistribute it and modify it under the terms of the GPL as published by the Free Software Foundation, either version 3 of the License or, at your option, any later version.

It is distributed in the hope that it will be useful, but **without any warranty**, without even the implied warranty of merchantability or fitness for a particular purpose. See the [LICENSE](LICENSE) file for the full text.

Copyright © 2026 [Hasan Berat Kaylan](https://github.com/hasanbkaylan)
