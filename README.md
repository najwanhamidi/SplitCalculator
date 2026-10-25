# Split Calculator

A mobile-friendly web app (installable PWA, works offline) that turns a distance and a goal time into pacing plans.

**Race pacing** (pacing profiles described in sports-science research): even pace, negative split, fast start (positive split), U-shaped, J-shaped, reverse J, controlled start, sit and kick, mid-race surge, and a three-block plan (e.g. 10-10-10 marathon).

**Marathon-pace templates** (set your target marathon pace; those parts keep exactly that pace and the easy parts adjust so distance and goal time still match): marathon-pace block (one or several blocks), marathon-pace finish, marathon pace to faster, and marathon-pace repeats (choose the number of blocks; block length fills the run so there are no leftover slivers). A warning appears if the goal can't fit, e.g. it would need the easy parts faster than marathon pace.

**Workouts**: alternating pyramids (any number of pyramids, optionally flipping direction each time), progression run, fast-finish long run, tempo run, alternating, fartlek, pyramid, stair steps, interval style, ladder intervals, steady with surges, tempo sandwich, and run-walk (Galloway-style walk breaks at a set walking pace).

**Setup**
- Goal as finish time, average pace or average speed. Switching between them keeps the same goal.
- Any split length in metres, with presets for 200 m, 400 m, 500 m, 1 km, 1 mile, 2 km and 5 km.
- Outdoor or treadmill. Treadmill plans are in km/h, snapped to 0.1 km/h.

**Options**
- Rounding: round pace to the nearest 1/5/10/15 s, or treadmill speed to 0.1/0.2/0.5/1.0 km/h. Hold one pace per split, per km or per 2/3/5/10 km block, and optionally compensate to stay on target.
- Race adjustments for every strategy: an easier first km and a finish kick in the last km. The rest of the run rebalances to keep the goal time.
- Per-strategy tuning in each card: pace swing, negative-split switch point, alternating length, pyramid peak position, number of stair steps, and interval hard/easy/warm-up/cool-down splits, J-curve slowest point, tempo warm-up/cool-down share, fast-finish length, fartlek pattern, and run-walk interval, walk time and walking pace.

**Output for each strategy**
- Finish time, difference from goal, average, fastest and slowest pace, and both halves.
- Pace plan as merged blocks with the elapsed time at each change, plus checkpoint times every 5 km and at the half.
- Chart of pace (or speed) by distance, or time ahead of or behind even pace. Tap the chart for split details.
- Split table with pace, speed, time, elapsed time and time vs even pace. View it per selected split, per km or per 5 km; rows where the pace changes mid-row show the average. "Copy plan" copies it as text.
- A comparison chart and table when several strategies are selected.
- "Copy share link" copies a link that opens the app with the same settings.

## Host on GitHub Pages
1. Push these files to the root of the `main` branch of `najwanhamidi/SplitCalculator`.
2. In the repo go to **Settings → Pages**, set **Source** to *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. Open `https://najwanhamidi.github.io/SplitCalculator/` on your phone, then use *Add to Home Screen*.

## Develop
No build step. Serve the folder (`python3 -m http.server`) and open `index.html`. The pure calculation code is in `engine.js`; `node test.js` runs its checks.
