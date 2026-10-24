# Split Calculator

A mobile-friendly web app (installable PWA, works offline) that turns a distance and a goal time into pacing plans.

**Strategies:** even pace, negative split, progressive build, fast start (positive split), alternating, pyramid, stair steps, interval style.

**Options**
- Round paces to the nearest 1/5/10 s, and hold one pace for each split or for 2/3/5 km blocks. Optionally compensate so the finish stays on target.
- Treadmill mode: plans are shown in km/h and snapped to 0.1 km/h (or 0.2/0.5/1.0 when rounding is on).
- Split length of 1 km, 500 m or 400 m, adjustable pace variation, and interval hard/easy pattern.

Each selected strategy shows a summary, a pace plan, a chart and a split table, plus a comparison chart. "Copy plan" copies the plan as text.

## Host on GitHub Pages
1. Push these files to the root of the `main` branch of `najwanhamidi/SplitCalculator`.
2. In the repo go to **Settings → Pages**, set **Source** to *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. Open `https://najwanhamidi.github.io/SplitCalculator/` on your phone, then use *Add to Home Screen*.

## Develop
No build step. Serve the folder (`python3 -m http.server`) and open `index.html`. The pure calculation code is in `engine.js`; `node test.js` runs its checks.
