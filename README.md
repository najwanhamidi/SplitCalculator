# Split Calculator

A mobile-friendly web app (installable PWA, works offline) that turns a distance and a goal time into pacing plans.

**Race pacing** (pacing profiles described in sports-science research): even pace, negative split, fast start (positive split), U-shaped, J-shaped, reverse J, controlled start, sit and kick, mid-race surge, and a three-block plan (e.g. 10-10-10 marathon).

**Marathon-pace templates** (set your target marathon pace; those parts keep exactly that pace and the easy parts adjust so distance and goal time still match): marathon-pace block (one or several blocks), marathon-pace finish, marathon pace to faster, and marathon-pace repeats (choose the number of blocks; block length fills the run so there are no leftover slivers). A warning appears if the goal can't fit, e.g. it would need the easy parts faster than marathon pace.

**Long-run structures** (30 templates from the marathon-pace and other long-run workout guides, each with its own sliders). *Marathon-pace long runs:* Pfitzinger classic, McMillan fast-finish, MP sandwich, mid-run belly block, classic broken MP reps, descending MP ladder, MP micro-blocks, Daniels M-T-M, Canova over/under, on/off float, 1K/1K ratchet, thirds progression, step-down cutdown, Squires surge long run. *Other long runs:* sub-threshold embedded, bookend threshold sandwich, late-run cruise intervals, Daniels T-L-T, multi-stage cutdown pyramid, kitchen sink hybrid, alternating wave, road Michigan, 1/4 rhythm disrupter, Deek 5-on/5-off, Kenyan ladder fartlek, double Mona fartlek, HMP destroyer, fast-finish sub-threshold grind, hill-to-threshold, Lydiard hill circuit.

All zones are set from your marathon pace. Edit the offsets (steady, float, sub-threshold, threshold, half-marathon, 10K, 5K) under *Pace zones* in the marathon-pace box. Easy parts share one pace that is solved so distance and goal time still match. Time-based steps (e.g. 90 s) last exactly that long. Hill steps carry an incline on the treadmill, which goes into the QZ XML. If a structure is longer than the run, it is scaled down and a note says so.

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


## Split table views

Rows per selected split, per km, per 5 km, or **Custom**: every N km, or every N minutes of running (time-based rows end exactly on the clock, e.g. 10:00, 20:00, … and the last row ends at the finish).

## Heart rate and training zones

Optional. Enter your lactate-threshold heart rate (LTHR) and a recent race (distance and time), then pick a pace-zone model and a heart-rate zone system.

**Pace zones** (from the race):
- **Jack Daniels VDOT**: Daniels/Gilbert formulas. E 59–74% VO2max, M = predicted marathon, T = 1-hour race pace, I 95–100% VO2max, R ≈ mile pace.
- **McMillan**: stamina and speed zones from McMillan's race-duration equivalents (steady state 1:15–2:30 race pace, tempo 40–75 min, cruise intervals 25–45 min, speed 5–25 min, sprint 2–8 min). Easy, long and recovery paces use ratios to 5K pace taken from McMillan calculator output.
- **Tinman (Tom Schwartz)**: built around critical velocity (90% VO2max, ~30–35 min race pace); easy 65–75% vVO2max, tempo 90% and threshold 95% of CV. His own calculator is unpublished, so these are estimates.
- **Hansons**: from predicted marathon pace. Easy MP + 1–2 min/mile, long runs MP + 40–50 s/mile, tempo = MP, strength MP − 10 s/mile, speed at 10K–5K pace.
- **Riegel** (T2 = T1·(D2/D1)^1.06) and **Cameron** (world-record-fitted formula): race-equivalent paces (marathon, half, 1-hour threshold, 10K, 5K, mile); easy runs set at 12–30% slower than marathon pace.
- **Best estimate**: each kind of zone averaged across all six models; predictions average Daniels, Riegel and Cameron.

**Heart-rate zones** (% of LTHR): Joe Friel running, Joe Friel cycling/multisport, 80/20 Endurance (Z1, Z2, X, Z3, Y, Z4, Z5), Andy Coggan, Dr Will O'Connor (his site has you set HR zones with Friel's running percentages; above threshold he trains by pace), COROS LTHR, Garmin %LTHR (default percentages shown on the watch), Amazfit/Zepp LTHR (Zepp doesn't publish defaults; uses the commonly recommended Zepp LTHR setup), and a **best estimate** whose six zone boundaries are the averages of the matching boundaries in all those systems.

Each part of the plan gets its pace zone (from its pace) and an expected heart rate: speed as a share of threshold speed is turned into % of LTHR with the 80/20 Endurance pairing of pace and heart-rate zones, then placed in the chosen system. Plans show time in pace zones and in heart-rate zones, a zone badge and bpm range on every pace-plan step and table row, and zones in the copied plan and QZ workout messages. A compare panel lists every pace model and every HR system side by side. A button can set your marathon pace from the prediction.
