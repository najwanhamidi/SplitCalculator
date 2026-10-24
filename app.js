(function () {
  'use strict';
  var E = window.SplitEngine;
  var KEY = 'splitcalc.v1';
  var $ = function (id) { return document.getElementById(id); };
  var DEFAULTS = {
    km: 10, h: 0, m: 51, s: 0, mode: 'outdoor', round: false, paceStep: 5, speedStep: 0.5,
    group: 0, comp: false, variation: 2, splitM: 1000, hard: 2, easy: 1,
    sel: ['even', 'negative', 'alternating']
  };
  var st = load();

  function load() {
    var o = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var p = JSON.parse(raw); for (var k in p) if (k in o) o[k] = p[k]; }
    } catch (e) {}
    return o;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  var STRATS = E.STRATEGIES;
  var colorOf = function (id) {
    for (var i = 0; i < STRATS.length; i++) if (STRATS[i].id === id) return 'var(--s' + (i + 1) + ')';
  };
  var tm = function () { return st.mode === 'treadmill'; };

  /* ---------- inputs <-> state ---------- */
  function fill() {
    $('km').value = st.km; $('th').value = st.h || ''; $('tm').value = st.m || ''; $('ts').value = st.s || '';
    $('round').checked = st.round; $('comp').checked = st.comp;
    $('paceStep').value = st.paceStep; $('speedStep').value = st.speedStep; $('group').value = st.group;
    $('splitM').value = st.splitM; $('variation').value = st.variation; $('hard').value = st.hard; $('easy').value = st.easy;
    var box = $('strats'); box.innerHTML = '';
    STRATS.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.dataset.id = s.id; b.style.setProperty('--c', 'var(--s' + (i + 1) + ')');
      b.innerHTML = '<span class="dot"></span>' + s.name;
      box.appendChild(b);
    });
    syncUi();
  }
  function syncUi() {
    document.querySelectorAll('.seg button').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.mode === st.mode)); });
    document.querySelectorAll('#strats button').forEach(function (b) { b.setAttribute('aria-pressed', String(st.sel.indexOf(b.dataset.id) >= 0)); });
    document.querySelectorAll('#presets button').forEach(function (b) { b.setAttribute('aria-pressed', String(Math.abs(+b.dataset.km - st.km) < 1e-6)); });
    $('roundOpts').hidden = !st.round;
    $('paceStep').hidden = tm(); $('speedStep').hidden = !tm();
    $('stepLbl').textContent = tm() ? 'Round speed to nearest' : 'Round pace to nearest';
    $('tmHint').hidden = !(tm() && !st.round);
    $('varOut').textContent = st.variation;
    // compensation is meaningful whenever anything is rounded (always true on a treadmill)
    $('comp').closest('.switch').hidden = !(st.round || tm());
  }
  function readInputs() {
    st.km = parseFloat($('km').value) || 0;
    st.h = parseInt($('th').value, 10) || 0; st.m = parseInt($('tm').value, 10) || 0; st.s = parseInt($('ts').value, 10) || 0;
    st.round = $('round').checked; st.comp = $('comp').checked;
    st.paceStep = +$('paceStep').value; st.speedStep = +$('speedStep').value; st.group = +$('group').value;
    st.splitM = +$('splitM').value; st.variation = +$('variation').value;
    st.hard = Math.max(1, parseInt($('hard').value, 10) || 1); st.easy = Math.max(1, parseInt($('easy').value, 10) || 1);
  }

  /* ---------- rendering ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fv(sec) { return tm() ? (3600 / sec).toFixed(1) : E.fmtT(sec); }  // primary value shown for a pace
  var unit = function () { return tm() ? 'km/h' : '/km'; };
  var kmTxt = function (m) { return E.fmtKm(m); };

  function render() {
    save(); syncUi();
    var T = st.h * 3600 + st.m * 60 + st.s;
    var msg = $('msg'), res = $('results');
    var err = '';
    if (!(st.km >= 0.1 && st.km <= 250)) err = 'Enter a distance between 0.1 and 250 km.';
    else if (T <= 0) err = 'Enter a target time greater than zero.';
    else if (st.km * 1000 / st.splitM > 400) err = 'That is more than 400 splits. Choose a longer split length.';
    if (err) { msg.textContent = err; msg.hidden = false; res.innerHTML = ''; $('avg').textContent = ''; return; }
    msg.hidden = true;

    var avgPace = T / st.km;
    $('avg').innerHTML = 'Average pace <b>' + E.fmtT(avgPace) + ' /km</b> · speed <b>' + (3600 / avgPace).toFixed(1) + ' km/h</b>';
    var warn = (3600 / avgPace > 30) ? 'That target needs over 30 km/h. Check the distance and time.' : '';
    if (warn) { msg.textContent = warn; msg.hidden = false; }

    var cfg = {
      km: st.km, T: T, treadmill: tm(), round: st.round, paceStep: st.paceStep, speedStep: st.speedStep,
      group: st.group, comp: st.comp, variation: st.variation, splitM: st.splitM, hard: st.hard, easy: st.easy
    };
    var plans = STRATS.filter(function (s) { return st.sel.indexOf(s.id) >= 0; }).map(function (s) {
      return { s: s, r: E.plan(s.id, cfg) };
    });
    if (!plans.length) { res.innerHTML = '<p class="hint">Pick at least one strategy above.</p>'; return; }
    var html = '';
    if (plans.length > 1) html += compareCard(plans, cfg);
    plans.forEach(function (p) { html += card(p, cfg); });
    res.innerHTML = html;
  }

  function stat(label, value) { return '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>'; }

  function card(p, cfg) {
    var s = p.s, r = p.r, id = s.id;
    var d = Math.round(r.diff);
    var delta = d === 0 ? 'On target' : (d > 0 ? '+' : '−') + E.fmtT(Math.abs(d)) + (d > 0 ? ' slower' : ' faster');
    var fast = tm() ? (3600 / r.fastest).toFixed(1) + ' km/h' : E.fmtT(r.fastest) + ' /km';
    var slow = tm() ? (3600 / r.slowest).toFixed(1) + ' km/h' : E.fmtT(r.slowest) + ' /km';
    var runs = E.runs(r, tm()).map(function (x) {
      return '<li>' + kmTxt(x.startM) + '–' + kmTxt(x.endM) + ' km · <b>' + x.label + '</b> ' + unit() + '</li>';
    }).join('');
    var head = tm()
      ? '<th>To km</th><th>km/h</th><th>Pace</th><th>Split</th><th>Elapsed</th>'
      : '<th>To km</th><th>Pace /km</th><th>Split</th><th>Elapsed</th>';
    var prev = null;
    var rows = r.segs.map(function (g) {
      var key = tm() ? g.speed.toFixed(1) : E.fmtT(g.pace);
      var chg = prev !== null && key !== prev; prev = key;
      var cells = tm()
        ? '<td>' + kmTxt(g.endM) + '</td><td class="pv">' + g.speed.toFixed(1) + '</td><td>' + E.fmtT(g.pace) + '</td>'
        : '<td>' + kmTxt(g.endM) + '</td><td class="pv">' + E.fmtT(g.pace) + '</td>';
      return '<tr' + (chg ? ' class="chg"' : '') + '>' + cells + '<td>' + E.fmtT(g.time) + '</td><td>' + E.fmtT(g.cum) + '</td></tr>';
    }).join('');
    return '<article class="card" style="--c:' + colorOf(id) + '" data-id="' + id + '">' +
      '<h3>' + esc(s.name) + '</h3><p class="blurb">' + esc(s.blurb) + '</p>' +
      '<dl class="stats">' + stat('Finish', E.fmtT(r.finish)) + stat('Vs target', delta) +
      stat('Average', tm() ? (3600 / r.avgPace).toFixed(1) + ' km/h' : E.fmtT(r.avgPace) + ' /km') +
      stat('Fastest', fast) + stat('Slowest', slow) + '</dl>' +
      '<ul class="plan" aria-label="Pace plan">' + runs + '</ul>' +
      chartSingle(r, id) +
      '<div class="readout" id="ro-' + id + '">Tap or hover the chart for split details.</div>' +
      '<details class="tbl" open><summary>Split table</summary><div class="tablewrap"><table><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div></details>' +
      '<div class="actions"><button type="button" class="btn" data-copy="' + id + '">Copy plan</button></div></article>';
  }

  /* ---------- charts ---------- */
  var W = 640, H = 250, ML = 62, MR = 14, MT = 14, MB = 36;
  function niceStep(range, opts, maxTicks) {
    for (var i = 0; i < opts.length; i++) if (range / opts[i] <= maxTicks) return opts[i];
    return opts[opts.length - 1];
  }
  function scale(plans, cfg) {
    var lo = Infinity, hi = -Infinity;
    plans.forEach(function (r) {
      r.segs.forEach(function (g) { var v = tm() ? g.speed : g.pace; lo = Math.min(lo, v); hi = Math.max(hi, v); });
    });
    var minRange = tm() ? 1.2 : 24;
    var range = Math.max(hi - lo, minRange), mid = (hi + lo) / 2;
    lo = mid - range * 0.7; hi = mid + range * 0.7;
    var step = tm() ? niceStep(hi - lo, [0.1, 0.2, 0.5, 1, 2, 5], 5) : niceStep(hi - lo, [5, 10, 15, 30, 60], 5);
    var ticks = [];
    for (var t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
    var totalM = Math.round(cfg.km * 1000);
    var pw = W - ML - MR, ph = H - MT - MB;
    return {
      X: function (m) { return ML + m / totalM * pw; },
      Y: function (v) { return tm() ? MT + (hi - v) / (hi - lo) * ph : MT + (v - lo) / (hi - lo) * ph; },
      val: function (g) { return tm() ? g.speed : g.pace; },
      ticks: ticks, totalM: totalM, base: MT + ph
    };
  }
  function axes(sc) {
    var out = '';
    sc.ticks.forEach(function (t) {
      var y = sc.Y(t).toFixed(1);
      out += '<line class="gl" x1="' + ML + '" x2="' + (W - MR) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text x="' + (ML - 6) + '" y="' + (+y + 4) + '" text-anchor="end">' + (tm() ? t.toFixed(1) : E.fmtT(t)) + '</text>';
    });
    var km = sc.totalM / 1000, xs = niceStep(km, [1, 2, 5, 10, 20], 8);
    for (var k = 0; k <= km + 1e-9; k += xs) {
      var x = sc.X(k * 1000).toFixed(1);
      out += '<line class="ax" x1="' + x + '" x2="' + x + '" y1="' + sc.base + '" y2="' + (sc.base + 4) + '"/>' +
        '<text x="' + x + '" y="' + (H - 10) + '" text-anchor="middle">' + k + '</text>';
    }
    out += '<line class="ax" x1="' + ML + '" x2="' + (W - MR) + '" y1="' + sc.base + '" y2="' + sc.base + '"/>' +
      '<text x="' + (W - MR) + '" y="' + (H - 10) + '" text-anchor="end" style="opacity:0">km</text>';
    return out;
  }
  function stepPath(sc, r) {
    var d = '';
    r.segs.forEach(function (g, i) {
      var y = sc.Y(sc.val(g)).toFixed(1), x0 = sc.X(g.startM).toFixed(1), x1 = sc.X(g.endM).toFixed(1);
      d += (i === 0 ? 'M' + x0 + ',' + y : 'L' + x0 + ',' + y) + 'L' + x1 + ',' + y;
    });
    return d;
  }
  function chartSingle(r, id) {
    var cfg = { km: r.segs[r.segs.length - 1].endM / 1000 };
    var sc = scale([r], cfg);
    var path = stepPath(sc, r);
    var area = path + 'L' + sc.X(sc.totalM).toFixed(1) + ',' + sc.base + 'L' + sc.X(0).toFixed(1) + ',' + sc.base + 'Z';
    var avgV = tm() ? 3600 / r.avgPace : r.avgPace, ay = sc.Y(avgV).toFixed(1);
    var hits = r.segs.map(function (g, i) {
      return '<rect class="hit" data-i="' + i + '" x="' + sc.X(g.startM).toFixed(1) + '" y="' + MT + '" width="' + (sc.X(g.endM) - sc.X(g.startM)).toFixed(1) + '" height="' + (sc.base - MT) + '"/>';
    }).join('');
    var label = (tm() ? 'Speed in km/h' : 'Pace per km') + ' by distance for ' + id;
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + label + '" data-id="' + id + '">' +
      axes(sc) +
      '<path d="' + area + '" style="fill:var(--c);opacity:.14"/>' +
      '<line class="avgl" x1="' + ML + '" x2="' + (W - MR) + '" y1="' + ay + '" y2="' + ay + '"/>' +
      '<path class="ln" d="' + path + '" style="stroke:var(--c)"/>' +
      '<rect class="hl" x="0" y="' + MT + '" width="0" height="' + (sc.base - MT) + '"/>' + hits + '</svg>';
  }
  function compareCard(plans, cfg) {
    var rs = plans.map(function (p) { return p.r; });
    var sc = scale(rs, cfg);
    var lines = plans.map(function (p) {
      return '<path class="ln" d="' + stepPath(sc, p.r) + '" style="stroke:' + colorOf(p.s.id) + '"/>';
    }).join('');
    var leg = plans.map(function (p) { return '<li style="--c:' + colorOf(p.s.id) + '"><i></i>' + esc(p.s.name) + '</li>'; }).join('');
    return '<article class="card" style="--c:var(--ink3)"><h3>Compare</h3>' +
      '<p class="blurb">' + (tm() ? 'Treadmill speed (km/h)' : 'Pace per km') + ' for every selected strategy. Higher is faster.</p>' +
      '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Comparison of selected strategies">' + axes(sc) + lines + '</svg>' +
      '<ul class="legend">' + leg + '</ul></article>';
  }

  /* ---------- interaction ---------- */
  var cache = {};
  function currentPlan(id) {
    var T = st.h * 3600 + st.m * 60 + st.s;
    return E.plan(id, {
      km: st.km, T: T, treadmill: tm(), round: st.round, paceStep: st.paceStep, speedStep: st.speedStep,
      group: st.group, comp: st.comp, variation: st.variation, splitM: st.splitM, hard: st.hard, easy: st.easy
    });
  }
  function hover(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('hit')) return;
    var svg = t.ownerSVGElement, id = svg.dataset.id, g = currentPlan(id).segs[+t.dataset.i];
    var hl = svg.querySelector('.hl');
    hl.setAttribute('x', t.getAttribute('x')); hl.setAttribute('width', t.getAttribute('width'));
    var v = tm() ? g.speed.toFixed(1) + ' km/h (' + E.fmtT(g.pace) + ' /km)' : E.fmtT(g.pace) + ' /km (' + (3600 / g.pace).toFixed(1) + ' km/h)';
    $('ro-' + id).textContent = kmTxt(g.startM) + '–' + kmTxt(g.endM) + ' km: ' + v + ', split ' + E.fmtT(g.time) + ', elapsed ' + E.fmtT(g.cum);
  }
  function copyText(id) {
    var r = currentPlan(id), name = STRATS.filter(function (s) { return s.id === id; })[0].name;
    var lines = [name + ' · ' + st.km + ' km · ' + (tm() ? 'treadmill' : 'outdoor') + ' · finish ' + E.fmtT(r.finish)];
    E.runs(r, tm()).forEach(function (x) { lines.push(kmTxt(x.startM) + '–' + kmTxt(x.endM) + ' km: ' + x.label + ' ' + unit()); });
    lines.push('');
    r.segs.forEach(function (g) {
      lines.push(kmTxt(g.endM) + ' km  ' + (tm() ? g.speed.toFixed(1) + ' km/h  ' : '') + E.fmtT(g.pace) + '/km  split ' + E.fmtT(g.time) + '  total ' + E.fmtT(g.cum));
    });
    return lines.join('\n');
  }

  document.addEventListener('input', function (e) {
    if (e.target.closest && e.target.closest("main")) { readInputs(); render(); }
  });
  document.addEventListener('change', function () { readInputs(); render(); });
  document.addEventListener('pointermove', hover);
  document.addEventListener('pointerdown', hover);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.km) { st.km = +b.dataset.km; $('km').value = st.km; render(); }
    else if (b.dataset.mode) { st.mode = b.dataset.mode; render(); }
    else if (b.closest('#strats')) {
      var i = st.sel.indexOf(b.dataset.id);
      if (i >= 0) st.sel.splice(i, 1); else st.sel.push(b.dataset.id);
      render();
    } else if (b.dataset.copy) {
      var txt = copyText(b.dataset.copy);
      var done = function (ok) { b.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(function () { b.textContent = 'Copy plan'; }, 1500); };
      try { navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { done(false); }); } catch (err) { done(false); }
    }
  });

  fill(); render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
