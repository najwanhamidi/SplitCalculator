(function () {
  'use strict';
  var E = window.SplitEngine;
  var KEY = 'splitcalc.v2';
  var $ = function (id) { return document.getElementById(id); };
  var DEFAULTS = {
    km: 10, goal: 'time', T: 3060,
    splitM: 1000, mode: 'outdoor', round: false, paceStep: 5, speedStep: 0.5, group: 0, comp: false,
    firstSlow: 0, kick: 0,
    sel: ['even', 'negative', 'alternating'],
    sp: {},      // per-strategy settings
    view: {},    // per-card chart view: 'pace' | 'bank'
    tview: 'split', // table rows: 'split' | 'km' | '5k'
    incline: 0,
    slots: {}    // strategy -> colour slot 1..8, kept while selected
  };
  var STRATS = E.STRATEGIES;
  var st = load();
  var ui = { tuneOpen: {}, tableClosed: {}, expOpen: {} };   // per-session UI state, not saved
  var last = {};                                 // latest plan per strategy (for hover/copy)

  /* Per-strategy controls shown in each card's "Adjust" panel. */
  var SW = function (v) { return '±' + v + '%'; }, PCT = function (v) { return v + '% of distance'; };
  var TUNE = {
    negative: [
      { k: 'v', label: 'Pace swing', min: 0.5, max: 8, step: 0.5, fmt: function (v) { return '±' + v + '%'; } },
      { k: 'at', label: 'Speed up at', min: 20, max: 80, step: 5, fmt: function (v) { return v + '% of distance'; } }
    ],
    progressive: [{ k: 'v', label: 'Start to finish swing', min: 0.5, max: 8, step: 0.5, fmt: function (v) { return '±' + v + '%'; } }],
    positive: [{ k: 'v', label: 'Start to finish swing', min: 0.5, max: 8, step: 0.5, fmt: function (v) { return '±' + v + '%'; } }],
    alternating: [
      { k: 'v', label: 'Pace swing', min: 0.5, max: 8, step: 0.5, fmt: function (v) { return '±' + v + '%'; } },
      { k: 'len', label: 'Switch every', min: 1, max: 5, step: 1, fmt: function (v) { return v + (v > 1 ? ' splits' : ' split'); } }
    ],
    pyramid: [
      { k: 'v', label: 'Pace swing', min: 0.5, max: 8, step: 0.5, fmt: function (v) { return '±' + v + '%'; } },
      { k: 'peak', label: 'Fastest at', min: 20, max: 80, step: 5, fmt: function (v) { return v + '% of distance'; } }
    ],
    stairs: [
      { k: 'v', label: 'Pace swing', min: 0.5, max: 8, step: 0.5, fmt: function (v) { return '±' + v + '%'; } },
      { k: 'steps', label: 'Steps', min: 2, max: 8, step: 1, fmt: function (v) { return v; } }
    ],
    interval: [
      { k: 'v', label: 'Hard vs easy', min: 1, max: 12, step: 0.5, fmt: function (v) { return '±' + v + '%'; } },
      { k: 'hard', label: 'Hard', min: 1, max: 10, step: 1, fmt: function (v) { return v + (v > 1 ? ' splits' : ' split'); } },
      { k: 'easy', label: 'Easy', min: 1, max: 10, step: 1, fmt: function (v) { return v + (v > 1 ? ' splits' : ' split'); } },
      { k: 'wu', label: 'Warm-up', min: 0, max: 5, step: 1, fmt: function (v) { return v + (v === 1 ? ' split' : ' splits'); } },
      { k: 'cd', label: 'Cool-down', min: 0, max: 5, step: 1, fmt: function (v) { return v + (v === 1 ? ' split' : ' splits'); } }
    ],
    ushape: [{ k: 'v', label: 'Pace swing', min: 0.5, max: 8, step: 0.5, fmt: SW }],
    jshape: [
      { k: 'v', label: 'Pace swing', min: 0.5, max: 8, step: 0.5, fmt: SW },
      { k: 'low', label: 'Slowest at', min: 25, max: 75, step: 5, fmt: PCT }
    ],
    revj: [
      { k: 'v', label: 'Pace swing', min: 0.5, max: 8, step: 0.5, fmt: SW },
      { k: 'low', label: 'Slowest at', min: 25, max: 75, step: 5, fmt: PCT }
    ],
    fastfinish: [
      { k: 'v', label: 'Pace swing', min: 1, max: 10, step: 0.5, fmt: SW },
      { k: 'last', label: 'Fast for the last', min: 5, max: 50, step: 5, fmt: PCT }
    ],
    tempo: [
      { k: 'v', label: 'Easy vs tempo', min: 2, max: 15, step: 0.5, fmt: SW },
      { k: 'wu', label: 'Warm-up', min: 0, max: 40, step: 5, fmt: PCT },
      { k: 'cd', label: 'Cool-down', min: 0, max: 40, step: 5, fmt: PCT }
    ],
    fartlek: [
      { k: 'v', label: 'Surge size', min: 1, max: 12, step: 0.5, fmt: SW },
      { k: 'seed', label: 'Pattern', min: 1, max: 30, step: 1, fmt: function (v) { return '#' + v; } }
    ],
    runwalk: [
      { k: 'every', label: 'Walk every', min: 0.4, max: 5, step: 0.1, fmt: function (v) { return (+v).toFixed(1) + ' km'; } },
      { k: 'ws', label: 'Walk for', min: 15, max: 180, step: 5, fmt: function (v) { return v + ' s'; } },
      { k: 'wp', label: 'Walking pace', min: 420, max: 960, step: 15, fmt: function (v) { return E.fmtT(v) + ' /km'; } }
    ],
    controlled: [
      { k: 'v', label: 'Slower by', min: 0.5, max: 8, step: 0.5, fmt: function (v) { return v + '%'; } },
      { k: 'first', label: 'Hold back for the first', min: 5, max: 40, step: 5, fmt: PCT }
    ],
    sitkick: [
      { k: 'v', label: 'Kick faster by', min: 1, max: 15, step: 0.5, fmt: function (v) { return v + '%'; } },
      { k: 'last', label: 'Kick for the last', min: 2, max: 25, step: 1, fmt: PCT }
    ],
    midsurge: [
      { k: 'v', label: 'Surge faster by', min: 1, max: 10, step: 0.5, fmt: function (v) { return v + '%'; } },
      { k: 'at', label: 'Centred at', min: 20, max: 80, step: 5, fmt: PCT },
      { k: 'len', label: 'Surge length', min: 5, max: 40, step: 5, fmt: PCT }
    ],
    blocks3: [
      { k: 'v', label: 'Block swing', min: 0.5, max: 8, step: 0.5, fmt: SW },
      { k: 'a', label: 'Easy block', min: 10, max: 60, step: 1, fmt: PCT },
      { k: 'b', label: 'Goal-pace block', min: 10, max: 60, step: 1, fmt: PCT }
    ],
    ladder: [
      { k: 'v', label: 'Hard vs easy', min: 1, max: 12, step: 0.5, fmt: SW },
      { k: 'peak', label: 'Longest rep', min: 2, max: 6, step: 1, fmt: function (v) { return v + (v == 1 ? ' split' : ' splits'); } },
      { k: 'easy', label: 'Recovery', min: 1, max: 4, step: 1, fmt: function (v) { return v + (v == 1 ? ' split' : ' splits'); } },
      { k: 'wu', label: 'Warm-up', min: 0, max: 5, step: 1, fmt: function (v) { return v + (v == 1 ? ' split' : ' splits'); } },
      { k: 'cd', label: 'Cool-down', min: 0, max: 5, step: 1, fmt: function (v) { return v + (v == 1 ? ' split' : ' splits'); } }
    ],
    surges: [
      { k: 'v', label: 'Surge faster by', min: 1, max: 12, step: 0.5, fmt: function (v) { return v + '%'; } },
      { k: 'every', label: 'Surge every', min: 2, max: 10, step: 1, fmt: function (v) { return v + (v == 1 ? ' split' : ' splits'); } },
      { k: 'len', label: 'Surge length', min: 1, max: 3, step: 1, fmt: function (v) { return v + (v == 1 ? ' split' : ' splits'); } }
    ],
    sandwich: [
      { k: 'v', label: 'Easy vs tempo', min: 2, max: 15, step: 0.5, fmt: SW },
      { k: 'wu', label: 'Warm-up', min: 0, max: 30, step: 5, fmt: PCT },
      { k: 'mid', label: 'Recovery between', min: 5, max: 40, step: 5, fmt: PCT },
      { k: 'cd', label: 'Cool-down', min: 0, max: 30, step: 5, fmt: PCT }
    ]
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(into, from) { for (var k in from) if (k in into) into[k] = from[k]; return into; }
  function load() {
    var o = clone(DEFAULTS);
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) merge(o, JSON.parse(raw));
    } catch (e) {}
    // Shared link: #s=<base64 json>
    try {
      var m = location.hash.match(/^#s=(.+)$/);
      if (m) {
        merge(o, JSON.parse(atob(decodeURIComponent(m[1]))));
        history.replaceState(null, '', location.pathname + location.search);
      }
    } catch (e) {}
    return o;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  /* Colours: up to 8 selected strategies each hold a categorical slot while selected, so a colour
     never jumps when others are toggled. Any further selections are drawn in neutral grey. */
  function syncSlots() {
    var used = {};
    Object.keys(st.slots).forEach(function (id) {
      if (st.sel.indexOf(id) < 0 || used[st.slots[id]]) delete st.slots[id]; else used[st.slots[id]] = 1;
    });
    st.sel.forEach(function (id) {
      if (st.slots[id]) return;
      for (var k = 1; k <= 8; k++) if (!used[k]) { st.slots[id] = k; used[k] = 1; return; }
    });
  }
  var colorOf = function (id) { return st.slots[id] ? 'var(--s' + st.slots[id] + ')' : 'var(--ink3)'; };
  var nameOf = function (id) { return STRATS.filter(function (s) { return s.id === id; })[0].name; };
  var tm = function () { return st.mode === 'treadmill'; };
  var unit = function () { return tm() ? 'km/h' : '/km'; };
  var kmTxt = function (m) { return E.fmtKm(m); };
  function pv(pace) { return tm() ? (3600 / pace).toFixed(1) + ' km/h' : E.fmtT(pace) + ' /km'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function targetSec() { return st.T; }
  /* Goal from whichever goal fields are showing (time, pace or speed). */
  function goalFromFields() {
    if (st.goal === 'pace') return (num('pm', 0) * 60 + num('ps', 0)) * st.km;
    if (st.goal === 'speed') { var v = num('spd', 0); return v > 0 ? st.km / v * 3600 : 0; }
    return num('th', 0) * 3600 + num('tm', 0) * 60 + num('ts', 0);
  }
  function cfg() {
    return {
      km: st.km, T: targetSec(), treadmill: tm(), round: st.round, paceStep: st.paceStep, speedStep: st.speedStep,
      group: st.group, comp: st.comp, splitM: st.splitM, sp: st.sp, firstSlow: st.firstSlow, kick: st.kick
    };
  }

  /* ---------- inputs <-> state ---------- */
  function fill() {
    $('km').value = st.km; setGoalFields(st.T);
    $('splitM').value = st.splitM;
    $('round').checked = st.round; $('comp').checked = st.comp;
    $('paceStep').value = st.paceStep; $('speedStep').value = st.speedStep; $('group').value = st.group;
    $('incline').value = st.incline; $('firstSlow').value = st.firstSlow; $('kick').value = st.kick;
    var box = $('strats'), html = '';
    [['race', 'Race pacing'], ['workout', 'Workouts']].forEach(function (g) {
      html += '<h3 class="sub-h">' + g[1] + '</h3><div class="chips strat" role="group" aria-label="' + g[1] + '">';
      STRATS.forEach(function (s) {
        if (s.group === g[0]) html += '<button type="button" data-id="' + s.id + '"><span class="dot"></span>' + s.name + '</button>';
      });
      html += '</div>';
    });
    box.innerHTML = html;
    syncUi();
  }
  /* Show the goal in all three forms. The goal time st.T stays the source of truth. */
  function setGoalFields(T) {
    if (!(T > 0) || !(st.km > 0)) return;
    var t = Math.round(T), p = Math.round(T / st.km);
    $('th').value = Math.floor(t / 3600) || ''; $('tm').value = Math.floor((t % 3600) / 60) || ''; $('ts').value = t % 60 || '';
    $('pm').value = Math.floor(p / 60); $('ps').value = p % 60 || '';
    $('spd').value = Math.round(st.km / T * 36000) / 10;
  }
  function pressed(sel, fn) { document.querySelectorAll(sel).forEach(function (b) { b.setAttribute(b.getAttribute('role') === 'radio' ? 'aria-checked' : 'aria-pressed', String(fn(b))); }); }
  function syncUi() {
    pressed('[data-mode]', function (b) { return b.dataset.mode === st.mode; });
    pressed('[data-goal]', function (b) { return b.dataset.goal === st.goal; });
    syncSlots();
    pressed('#strats button', function (b) { return st.sel.indexOf(b.dataset.id) >= 0; });
    document.querySelectorAll('#strats button').forEach(function (b) { b.style.setProperty('--c', colorOf(b.dataset.id)); });
    pressed('#presets button', function (b) { return Math.abs(+b.dataset.km - st.km) < 1e-6; });
    pressed('#splitPresets button', function (b) { return Math.abs(+b.dataset.split - st.splitM) < 0.01; });
    $('goalTime').hidden = st.goal !== 'time'; $('goalPace').hidden = st.goal !== 'pace'; $('goalSpeed').hidden = st.goal !== 'speed';
    $('roundOpts').hidden = !st.round;
    $('paceStep').hidden = tm(); $('speedStep').hidden = !tm();
    $('stepLbl').textContent = tm() ? 'Round speed to nearest' : 'Round pace to nearest';
    $('tmHint').hidden = !(tm() && !st.round);
    $('compWrap').hidden = !(st.round || tm());
    $('firstOut').textContent = st.firstSlow; $('kickOut').textContent = st.kick;
  }
  function num(id, def) { var v = parseFloat($(id).value); return isFinite(v) ? v : def; }
  function readInputs() {
    st.km = num('km', 0);
    st.splitM = num('splitM', 0);
    st.round = $('round').checked; st.comp = $('comp').checked;
    st.paceStep = +$('paceStep').value; st.speedStep = +$('speedStep').value; st.group = +$('group').value;
    st.firstSlow = +$('firstSlow').value; st.kick = +$('kick').value;
    st.incline = Math.min(15, Math.max(0, num('incline', 0)));
  }

  /* ---------- rendering ---------- */
  function render() {
    save(); syncUi();
    var T = targetSec();
    var msg = $('msg'), res = $('results');
    var err = '';
    if (!(st.km >= 0.1 && st.km <= 250)) err = 'Enter a distance between 0.1 and 250 km.';
    else if (!(T > 0)) err = 'Enter a goal greater than zero.';
    else if (!(st.splitM >= 50)) err = 'Enter a split length of at least 50 m.';
    else if (st.km * 1000 / st.splitM > 500) err = 'That makes more than 500 splits. Choose a longer split length.';
    if (err) { msg.textContent = err; msg.hidden = false; res.innerHTML = ''; $('avg').textContent = ''; return; }
    msg.hidden = true;

    var avgPace = T / st.km;
    var nSplits = Math.ceil(st.km * 1000 / st.splitM - 0.0005);
    $('avg').innerHTML = 'Goal <b>' + E.fmtT(T) + '</b> · <b>' + E.fmtT(avgPace) + ' /km</b> · <b>' + (3600 / avgPace).toFixed(1) + ' km/h</b> · ' + nSplits + ' splits';
    if (3600 / avgPace > 30) { msg.textContent = 'That goal needs over 30 km/h. Check the distance and goal.'; msg.hidden = false; }

    var c = cfg();
    var plans = STRATS.filter(function (s) { return st.sel.indexOf(s.id) >= 0; }).map(function (s) {
      var r = E.plan(s.id, c); last[s.id] = r; return { s: s, r: r };
    });
    if (!plans.length) { res.innerHTML = '<p class="hint">Pick at least one strategy above.</p>'; return; }
    var html = '';
    if (plans.length > 1) html += '<article class="card" id="compare" style="--c:var(--ink3)">' + compareInner(plans) + '</article>';
    plans.forEach(function (p) { html += card(p); });
    res.innerHTML = html;
  }

  function stat(label, value) { return '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>'; }

  function card(p) {
    var id = p.s.id;
    return '<article class="card" style="--c:' + colorOf(id) + '" data-id="' + id + '">' +
      '<h3>' + esc(p.s.name) + '</h3><p class="blurb">' + esc(p.s.blurb) + '</p>' +
      tuneHtml(id) + '<div class="body" id="body-' + id + '">' + bodyHtml(p.r) + '</div></article>';
  }

  function tuneHtml(id) {
    var defs = TUNE[id];
    if (!defs) return '';
    var prm = E.params(id, st.sp);
    var fields = defs.map(function (d) {
      return '<label><span>' + d.label + ': <b data-out="' + d.k + '">' + d.fmt(prm[d.k]) + '</b></span>' +
        '<input type="range" data-strat="' + id + '" data-k="' + d.k + '" min="' + d.min + '" max="' + d.max + '" step="' + d.step + '" value="' + prm[d.k] + '"></label>';
    }).join('');
    return '<details class="tune" data-tune="' + id + '"' + (ui.tuneOpen[id] ? ' open' : '') + '><summary>Adjust this strategy</summary>' +
      '<div class="grid2">' + fields + '</div><button type="button" class="btn" data-resetstrat="' + id + '">Reset to default</button></details>';
  }

  /* Table row options: the chosen split, whole km, and 5 km blocks where they add something. */
  function splitName() {
    var m = st.splitM;
    if (Math.abs(m - 1609.34) < 0.5) return '1 mile';
    return m >= 1000 ? (Math.round(m / 10) / 100) + ' km' : Math.round(m) + ' m';
  }
  function tableViews(r) {
    var v = [{ k: 'split', label: 'Per split (' + splitName() + ')', len: st.splitM }];
    if (Math.abs(st.splitM - 1000) > 0.01 && r.totalM > 1000) v.push({ k: 'km', label: 'Per km', len: 1000 });
    if (Math.abs(st.splitM - 5000) > 0.01 && r.totalM > 10000) v.push({ k: '5k', label: 'Per 5 km', len: 5000 });
    return v;
  }
  function currentView(tv) { return tv.filter(function (v) { return v.k === st.tview; })[0] || tv[0]; }

  /* Treadmill plan used for the QZ workout file: speeds always on the 0.1 km/h grid, time kept on target. */
  function exportPlan(id) {
    var c = cfg();
    if (!c.treadmill) { c.treadmill = true; c.comp = true; c.speedStep = 0.1; }
    return E.plan(id, c);
  }
  function exportHtml(id) {
    var q = E.qzWorkout(exportPlan(id), { incline: st.incline });
    return '<details class="tune export" data-exp="' + id + '"' + (ui.expOpen[id] ? ' open' : '') + '><summary>Export to QZ workout (.xml)</summary>' +
      '<p class="hint">For qdomyos-zwift treadmill workouts: ' + q.rows.length + ' intervals, ' + E.fmtT(q.total) + ' total' +
      (tm() ? '.' : '. Speeds snap to 0.1 km/h, and time is kept on target, so a few intervals may differ slightly from the outdoor paces shown.') + '</p>' +
      '<div class="actions"><button type="button" class="btn" data-dl="' + id + '">Download .xml</button>' +
      '<button type="button" class="btn" data-copyxml="' + id + '">Copy XML</button></div></details>';
  }
  function fileName(id) {
    var T = E.fmtT(targetSec()).replace(/:/g, '-');
    return (nameOf(id) + '_' + (Math.round(st.km * 100) / 100) + 'km_' + T).replace(/[^A-Za-z0-9_.-]+/g, '_') + '.xml';
  }
  function download(id) {
    var q = E.qzWorkout(exportPlan(id), { incline: st.incline });
    var blob = new Blob([q.xml], { type: 'application/xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fileName(id);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function bodyHtml(r) {
    var id = r.id;
    var d = Math.round(r.diff);
    var delta = d === 0 ? 'On target' : (d > 0 ? '+' : '−') + E.fmtT(Math.abs(d)) + (d > 0 ? ' slower' : ' faster');
    var hd = r.half2 - r.half1;
    var halfNote = Math.abs(hd) < 0.5 ? 'even halves' : (hd < 0 ? 'negative by ' : 'positive by ') + E.fmtT(Math.abs(hd));

    var runs = E.runs(r, tm()).map(function (x) {
      return '<li' + (x.walk ? ' class="walk"' : '') + '>' + kmTxt(x.startM) + '–' + kmTxt(x.endM) + ' km · ' + (x.walk ? 'walk ' : '') + '<b>' + x.label + '</b> ' + unit() + ' · until ' + E.fmtT(x.endT) + '</li>';
    }).join('');
    var cps = E.checkpoints(r);
    var cpHtml = cps.length ? '<div class="cp"><h4>Checkpoints</h4><ul class="plan">' + cps.map(function (c) {
      return '<li>' + c.label + ' <b>' + E.fmtT(c.t) + '</b></li>';
    }).join('') + '</ul></div>' : '';

    var view = st.view[id] === 'bank' ? 'bank' : 'pace';
    var tv = tableViews(r), cur = currentView(tv);
    var head = tm()
      ? '<th>To km</th><th>km/h</th><th>Pace</th><th>Time</th><th>Elapsed</th><th>Vs even</th>'
      : '<th>To km</th><th>Pace</th><th>km/h</th><th>Time</th><th>Elapsed</th><th>Vs even</th>';
    var prev = null, anyMixed = false;
    var tr = E.windows(r, cur.len);
    var rows = tr.map(function (g) {
      var key = tm() ? g.speed.toFixed(1) : E.fmtT(g.pace);
      var chg = prev !== null && key !== prev; prev = key;
      var avg = g.mixed ? ' <small>avg</small>' : '';
      if (g.mixed) anyMixed = true;
      var cells = tm()
        ? '<td class="pv">' + g.speed.toFixed(1) + avg + '</td><td>' + E.fmtT(g.pace) + '</td>'
        : '<td class="pv">' + E.fmtT(g.pace) + avg + '</td><td>' + g.speed.toFixed(1) + '</td>';
      return '<tr' + (chg ? ' class="chg"' : '') + '><td>' + kmTxt(g.endM) + (g.walk ? ' <small>walk</small>' : '') + '</td>' + cells + '<td>' + E.fmtT(g.time) + '</td><td>' + E.fmtT(g.cum) + '</td><td>' + E.fmtSigned(g.bank) + '</td></tr>';
    }).join('');
    var tvSeg = tv.length > 1 ? '<div class="seg sm" role="radiogroup" aria-label="Table rows">' + tv.map(function (v) {
      return '<button type="button" role="radio" data-tview="' + v.k + '" aria-checked="' + (v.k === cur.k) + '">' + v.label + '</button>';
    }).join('') + '</div>' : '';

    return '<dl class="stats">' +
      stat('Finish', E.fmtT(r.finish)) + stat('Vs goal', delta) + stat('Average', pv(r.avgPace)) +
      stat('Fastest', pv(r.fastest)) + stat('Slowest', pv(r.slowest)) +
      stat('Halves', E.fmtT(r.half1) + ' / ' + E.fmtT(r.half2) + '<small>' + halfNote + '</small>') + '</dl>' +
      '<h4 class="plan-h">Pace plan</h4><ul class="plan" aria-label="Pace plan">' + runs + '</ul>' + cpHtml +
      '<div class="seg sm" role="radiogroup" aria-label="Chart view">' +
      '<button type="button" role="radio" data-view="pace" data-card="' + id + '" aria-checked="' + (view === 'pace') + '">' + (tm() ? 'Speed' : 'Pace') + '</button>' +
      '<button type="button" role="radio" data-view="bank" data-card="' + id + '" aria-checked="' + (view === 'bank') + '">Time vs even</button></div>' +
      (view === 'bank' ? chartBank(r) : chartSingle(r)) +
      '<div class="readout" id="ro-' + id + '">Tap or hover the chart for split details.</div>' +
      '<details class="tbl" data-tbl="' + id + '"' + (ui.tableClosed[id] ? '' : ' open') + '><summary>Split table (' + tr.length + ' rows, ' + cur.label.toLowerCase() + ')</summary>' + tvSeg + '<div class="tablewrap"><table><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (anyMixed ? '<p class="note">avg: the pace changes inside this row, so the value shown is the average. The pace plan above lists every change.</p>' : '') +
      '<p class="note">Vs even: time behind (+) or ahead (−) of running the goal at a perfectly even pace.</p></details>' +
      exportHtml(id) +
      '<div class="actions"><button type="button" class="btn" data-copy="' + id + '">Copy plan</button></div>';
  }

  function compareInner(plans) {
    var rs = plans.map(function (p) { return p.r; });
    var sc = scale(rs, true);
    var drawn = plans.filter(function (p) { return st.slots[p.s.id]; });
    var lines = drawn.map(function (p) {
      return '<path class="ln" d="' + stepPath(sc, p.r) + '" style="stroke:' + colorOf(p.s.id) + '"/>';
    }).join('');
    var leg = drawn.map(function (p) { return '<li style="--c:' + colorOf(p.s.id) + '"><i></i>' + esc(p.s.name) + '</li>'; }).join('');
    var extra = plans.length - drawn.length;
    var rows = plans.map(function (p) {
      var r = p.r;
      return '<tr style="--c:' + colorOf(p.s.id) + '"><td><i></i>' + esc(p.s.name) + '</td><td>' + E.fmtT(r.finish) + '</td><td>' + E.fmtT(r.half1) + '</td><td>' + E.fmtT(r.half2) + '</td><td>' +
        (tm() ? (3600 / r.fastest).toFixed(1) : E.fmtT(r.fastest)) + '</td><td>' + (tm() ? (3600 / r.slowest).toFixed(1) : E.fmtT(r.slowest)) + '</td><td>' + (E.runs(r, tm()).length - 1) + '</td></tr>';
    }).join('');
    return '<h3>Compare</h3>' +
      '<p class="blurb">' + (tm() ? 'Treadmill speed (km/h)' : 'Pace per km') + ' for every selected strategy. Higher is faster.' + (rs.some(function (r) { return r.segs.some(function (g) { return g.walk; }); }) ? ' Walk breaks run off the bottom edge.' : '') + '</p>' +
      '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Comparison of selected strategies">' + axes(sc) + lines + '</svg>' +
      '<ul class="legend">' + leg + '</ul>' +
      (extra > 0 ? '<p class="note">The chart shows up to 8 strategies so each keeps a distinct colour. ' + extra + ' more ' + (extra > 1 ? 'are' : 'is') + ' in the table below.</p>' : '') +
      '<div class="tablewrap compare-table"><table class="cmp"><thead><tr><th>Strategy</th><th>Finish</th><th>1st half</th><th>2nd half</th><th>Fastest</th><th>Slowest</th><th>Changes</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="note">Changes: how many times you change ' + (tm() ? 'speed' : 'pace') + ' during the run.</p>';
  }

  /* ---------- charts ---------- */
  var W = 640, H = 250, ML = 66, MR = 14, MT = 14, MB = 36;
  function niceStep(range, opts, maxTicks) {
    for (var i = 0; i < opts.length; i++) if (range / opts[i] <= maxTicks) return opts[i];
    return opts[opts.length - 1];
  }
  function xAxis(totalM) {
    var pw = W - ML - MR;
    return function (m) { return ML + m / totalM * pw; };
  }
  function scale(rs, skipWalk) {
    var lo = Infinity, hi = -Infinity;
    rs.forEach(function (r) {
      r.segs.forEach(function (g) { if (skipWalk && g.walk) return; var v = tm() ? g.speed : g.pace; lo = Math.min(lo, v); hi = Math.max(hi, v); });
    });
    var minRange = tm() ? 1.2 : 24;
    var range = Math.max(hi - lo, minRange), mid = (hi + lo) / 2;
    lo = mid - range * 0.7; hi = mid + range * 0.7;
    var step = tm() ? niceStep(hi - lo, [0.1, 0.2, 0.5, 1, 2, 5], 5) : niceStep(hi - lo, [5, 10, 15, 30, 60, 120], 5);
    var ticks = [];
    for (var t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
    var totalM = rs[0].totalM, ph = H - MT - MB;
    return {
      X: xAxis(totalM),
      Y: function (v) { return tm() ? MT + (hi - v) / (hi - lo) * ph : MT + (v - lo) / (hi - lo) * ph; },
      val: function (g) { return tm() ? g.speed : g.pace; },
      tickLabel: function (t) { return tm() ? t.toFixed(1) : E.fmtT(t); },
      ticks: ticks, totalM: totalM, base: MT + ph
    };
  }
  function axes(sc) {
    var out = '';
    sc.ticks.forEach(function (t) {
      var y = sc.Y(t).toFixed(1);
      out += '<line class="gl" x1="' + ML + '" x2="' + (W - MR) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text x="' + (ML - 8) + '" y="' + (+y + 5) + '" text-anchor="end">' + sc.tickLabel(t) + '</text>';
    });
    var km = sc.totalM / 1000, xs = niceStep(km, [0.5, 1, 2, 5, 10, 20, 50], 8);
    for (var k = 0; k <= km + 1e-9; k += xs) {
      var x = sc.X(k * 1000).toFixed(1);
      out += '<line class="ax" x1="' + x + '" x2="' + x + '" y1="' + sc.base + '" y2="' + (sc.base + 4) + '"/>' +
        '<text x="' + x + '" y="' + (H - 10) + '" text-anchor="middle">' + (Math.round(k * 10) / 10) + '</text>';
    }
    out += '<line class="ax" x1="' + ML + '" x2="' + (W - MR) + '" y1="' + sc.base + '" y2="' + sc.base + '"/>';
    return out;
  }
  function stepPath(sc, r) {
    var d = '';
    r.segs.forEach(function (g, i) {
      var y = Math.min(sc.base, Math.max(MT, sc.Y(sc.val(g)))).toFixed(1), x0 = sc.X(g.startM).toFixed(1), x1 = sc.X(g.endM).toFixed(1);
      d += (i === 0 ? 'M' : 'L') + x0 + ',' + y + 'L' + x1 + ',' + y;
    });
    return d;
  }
  function hits(sc, r) {
    return '<rect class="hl" x="0" y="' + MT + '" width="0" height="' + (sc.base - MT) + '"/>' + r.segs.map(function (g, i) {
      return '<rect class="hit" data-i="' + i + '" x="' + sc.X(g.startM).toFixed(1) + '" y="' + MT + '" width="' + Math.max(1, sc.X(g.endM) - sc.X(g.startM)).toFixed(1) + '" height="' + (sc.base - MT) + '"/>';
    }).join('');
  }
  function chartSingle(r) {
    var sc = scale([r]);
    var path = stepPath(sc, r);
    var area = path + 'L' + sc.X(sc.totalM).toFixed(1) + ',' + sc.base + 'L' + sc.X(0).toFixed(1) + ',' + sc.base + 'Z';
    var avgV = tm() ? 3600 / r.avgPace : r.avgPace, ay = sc.Y(avgV).toFixed(1);
    var label = (tm() ? 'Speed in km/h' : 'Pace per km') + ' by distance, ' + nameOf(r.id);
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + label + '" data-id="' + r.id + '">' +
      axes(sc) +
      '<path d="' + area + '" style="fill:var(--c);opacity:.14"/>' +
      '<line class="avgl" x1="' + ML + '" x2="' + (W - MR) + '" y1="' + ay + '" y2="' + ay + '"/>' +
      '<path class="ln" d="' + path + '" style="stroke:var(--c)"/>' + hits(sc, r) + '</svg>';
  }
  /* Time vs even pace: above the zero line = ahead of an even-pace runner. */
  function chartBank(r) {
    var vals = [0].concat(r.segs.map(function (g) { return g.bank; }));
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var range = Math.max(hi - lo, 10), mid = (hi + lo) / 2;
    lo = mid - range * 0.65; hi = mid + range * 0.65;
    var step = niceStep(hi - lo, [1, 2, 5, 10, 15, 30, 60, 120, 300, 600], 5);
    var ph = H - MT - MB, base = MT + ph;
    var X = xAxis(r.totalM);
    var Y = function (v) { return MT + (v - lo) / (hi - lo) * ph; };   // negative (ahead) at top
    var sc = {
      X: X, base: base, totalM: r.totalM, ticks: [],
      Y: Y, tickLabel: function (t) { return E.fmtSigned(t); }
    };
    for (var t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) sc.ticks.push(t);
    var pts = 'M' + X(0).toFixed(1) + ',' + Y(0).toFixed(1);
    r.segs.forEach(function (g) { pts += 'L' + X(g.endM).toFixed(1) + ',' + Y(g.bank).toFixed(1); });
    var dots = r.segs.length <= 60 ? r.segs.map(function (g) {
      return '<circle class="dotm" cx="' + X(g.endM).toFixed(1) + '" cy="' + Y(g.bank).toFixed(1) + '" r="4.5" style="fill:var(--c)"/>';
    }).join('') : '';
    var zy = Y(0).toFixed(1);
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Time ahead or behind even pace, ' + nameOf(r.id) + '" data-id="' + r.id + '">' +
      axes(sc) + '<line class="zero" x1="' + ML + '" x2="' + (W - MR) + '" y1="' + zy + '" y2="' + zy + '"/>' +
      '<text x="' + (W - MR) + '" y="' + (MT + 14) + '" text-anchor="end">ahead</text>' +
      '<text x="' + (W - MR) + '" y="' + (base - 6) + '" text-anchor="end">behind</text>' +
      '<path class="ln" d="' + pts + '" style="stroke:var(--c)"/>' + dots + hits(sc, r) + '</svg>';
  }

  function updateCard(id) {
    var r = E.plan(id, cfg()); last[id] = r;
    var body = $('body-' + id); if (body) body.innerHTML = bodyHtml(r);
    var cmp = $('compare');
    if (cmp) {
      var plans = STRATS.filter(function (s) { return st.sel.indexOf(s.id) >= 0; }).map(function (s) { return { s: s, r: last[s.id] }; });
      cmp.innerHTML = compareInner(plans);
    }
  }

  /* ---------- interaction ---------- */
  function hover(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('hit')) return;
    var svg = t.ownerSVGElement, id = svg.dataset.id, r = last[id];
    if (!r) return;
    var g = r.segs[+t.dataset.i];
    var hl = svg.querySelector('.hl');
    hl.setAttribute('x', t.getAttribute('x')); hl.setAttribute('width', t.getAttribute('width'));
    var v = tm() ? g.speed.toFixed(1) + ' km/h (' + E.fmtT(g.pace) + ' /km)' : E.fmtT(g.pace) + ' /km (' + g.speed.toFixed(1) + ' km/h)';
    var bank = Math.round(g.bank);
    var bt = bank === 0 ? 'level with even pace' : E.fmtT(Math.abs(bank)) + (bank < 0 ? ' ahead of even' : ' behind even');
    $('ro-' + id).textContent = kmTxt(g.startM) + '–' + kmTxt(g.endM) + ' km: ' + (g.walk ? 'walk ' : '') + v + ', split ' + E.fmtT(g.time) + ', elapsed ' + E.fmtT(g.cum) + ', ' + bt;
  }
  function copyText(id) {
    var r = last[id] || E.plan(id, cfg());
    var lines = [nameOf(id) + ' · ' + st.km + ' km · ' + (tm() ? 'treadmill' : 'outdoor') + ' · finish ' + E.fmtT(r.finish)];
    E.runs(r, tm()).forEach(function (x) { lines.push(kmTxt(x.startM) + '–' + kmTxt(x.endM) + ' km: ' + (x.walk ? 'walk ' : '') + x.label + ' ' + unit() + ' (until ' + E.fmtT(x.endT) + ')'); });
    var cps = E.checkpoints(r);
    if (cps.length) lines.push('Checkpoints: ' + cps.map(function (c) { return c.label + ' ' + E.fmtT(c.t); }).join(', '));
    lines.push('');
    var cur = currentView(tableViews(r));
    lines.push(cur.label + ':');
    E.windows(r, cur.len).forEach(function (g) {
      lines.push(kmTxt(g.endM) + ' km  ' + (tm() ? g.speed.toFixed(1) + ' km/h  ' : '') + E.fmtT(g.pace) + '/km' + (g.mixed ? ' (avg)' : '') + '  time ' + E.fmtT(g.time) + '  total ' + E.fmtT(g.cum));
    });
    return lines.join('\n');
  }
  function copy(btn, text, label) {
    var done = function (ok) { btn.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(function () { btn.textContent = label; }, 1500); };
    try { navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); }); } catch (err) { done(false); }
  }

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.strat) {
      var id = t.dataset.strat, k = t.dataset.k;
      st.sp[id] = st.sp[id] || {};
      st.sp[id][k] = +t.value;
      var def = TUNE[id].filter(function (d) { return d.k === k; })[0];
      var out = t.closest('.tune').querySelector('[data-out="' + k + '"]');
      if (out) out.textContent = def.fmt(+t.value);
      save(); updateCard(id);
      return;
    }
    if (t.closest && t.closest('main')) {
      var oldKm = st.km;
      readInputs();
      if (/^(th|tm|ts|pm|ps|spd)$/.test(t.id)) st.T = goalFromFields();
      else if (t.id === 'km' && st.km > 0) kmChanged(oldKm);
      render();
    }
  });
  /* New distance: a time goal keeps its time, a pace or speed goal keeps its pace. */
  function kmChanged(oldKm) {
    if (st.goal !== 'time' && oldKm > 0) st.T = st.T / oldKm * st.km;
    var keep = document.activeElement;
    setGoalFields(st.T);
    if (keep && keep.focus) keep.focus();
  }
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d.dataset && d.dataset.tune) ui.tuneOpen[d.dataset.tune] = d.open;
    if (d.dataset && d.dataset.exp) ui.expOpen[d.dataset.exp] = d.open;
    if (d.dataset && d.dataset.tbl) ui.tableClosed[d.dataset.tbl] = !d.open;
  }, true);
  document.addEventListener('pointermove', hover);
  document.addEventListener('pointerdown', hover);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.km) {
      var oldKm = st.km;
      st.km = +b.dataset.km; $('km').value = st.km;
      kmChanged(oldKm); render();
    } else if (b.dataset.split) { st.splitM = +b.dataset.split; $('splitM').value = st.splitM; render(); }
    else if (b.dataset.goal) { st.goal = b.dataset.goal; setGoalFields(st.T); render(); }
    else if (b.dataset.mode) { st.mode = b.dataset.mode; render(); }
    else if (b.dataset.dl) { download(b.dataset.dl); }
    else if (b.dataset.copyxml) { copy(b, E.qzWorkout(exportPlan(b.dataset.copyxml), { incline: st.incline }).xml, 'Copy XML'); }
    else if (b.dataset.tview) { st.tview = b.dataset.tview; render(); }
    else if (b.dataset.view) { st.view[b.dataset.card] = b.dataset.view; save(); updateCard(b.dataset.card); }
    else if (b.dataset.resetstrat) { delete st.sp[b.dataset.resetstrat]; ui.tuneOpen[b.dataset.resetstrat] = true; render(); }
    else if (b.closest('#strats')) {
      var i = st.sel.indexOf(b.dataset.id);
      if (i >= 0) st.sel.splice(i, 1); else st.sel.push(b.dataset.id);
      st.sel.sort(function (a, c) { return STRATS.findIndex(function (s) { return s.id === a; }) - STRATS.findIndex(function (s) { return s.id === c; }); });
      render();
    } else if (b.dataset.copy) { copy(b, copyText(b.dataset.copy), 'Copy plan'); }
    else if (b.id === 'share') {
      var url = location.href.split('#')[0] + '#s=' + encodeURIComponent(btoa(JSON.stringify(st)));
      copy(b, url, 'Copy share link');
    } else if (b.id === 'reset') {
      st = clone(DEFAULTS); ui = { tuneOpen: {}, tableClosed: {}, expOpen: {} }; fill(); render();
    }
  });

  fill(); render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
