/* Tiles Calculator website — interactions, animations and the live tile demo. */
(function () {
  'use strict';

  // ---- Settings you may want to change -------------------------------------------------
  var CONFIG = {
    // Google Play listing for the app (package tiles_calculator.tilecalc)
    playUrl: 'https://play.google.com/store/apps/details?id=tiles_calculator.tilecalc'
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Translations for text written by this script; filled in on each language page.
  var I18N = window.I18N || {};
  function t(s) { return (I18N[s] !== undefined && I18N[s] !== '') ? I18N[s] : s; }
  var TE = window.TileEngine;

  // Same defaults as the app
  var PATTERNS = {
    1: { name: t('Basketweave'), spin: t('basketweave'), waste: 10, tile: [30, 15] },
    2: { name: t('Brick'), spin: t('brick'), waste: 10, tile: [30, 15] },
    3: { name: t('Diamond'), spin: t('diamond'), waste: 15, tile: [20, 20] },
    4: { name: t('Herringbone'), spin: t('herringbone'), waste: 15, tile: [30, 10] },
    5: { name: t('Stack'), spin: t('stack'), waste: 5, tile: [30, 15] },
    6: { name: t('Square'), spin: t('square'), waste: 5, tile: [20, 20] },
    7: { name: t('Windmill'), spin: t('windmill'), waste: 10, tile: [30, 15] }
  };
  var COLORS = {
    room: '#1B2838', full: '#2F6F7C', cut: '#B8862E', small: '#C25050', insert: '#B89A3E',
    joint: '#0D1B2A', groutFill: '#8A939C', outline: '#FFFFFF', label: '#9DB0C1', letter: '#4A9EAD'
  };

  // ---- Basic page behaviour ---------------------------------------------------------------
  document.querySelectorAll('.play-link').forEach(function (a) { a.href = CONFIG.playUrl; });
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var nav = document.querySelector('.nav');
  var progress = document.querySelector('.scroll-progress');
  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle('scrolled', y > 10);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var burger = document.getElementById('burger');
  var links = document.getElementById('nav-links');
  burger.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  links.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      links.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });

  // ---- Language picker: open/close, and remember the visitor's choice ----------------------
  var lang = document.getElementById('lang');
  if (lang) {
    var lbtn = lang.querySelector('.lang-btn');
    lbtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = lang.classList.toggle('open');
      lbtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function () { lang.classList.remove('open'); lbtn.setAttribute('aria-expanded', 'false'); });
    lang.querySelectorAll('a[data-lang]').forEach(function (a) {
      a.addEventListener('click', function () {
        try { localStorage.setItem('tc-lang', a.dataset.lang); } catch (e) { /* private mode */ }
      });
    });
  }

  // ---- Scroll reveal with a small stagger between siblings ---------------------------------
  var reveals = document.querySelectorAll('.reveal');
  reveals.forEach(function (el) {
    var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) { return c.classList.contains('reveal'); });
    var i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty('--d', Math.min(i * 0.08, 0.5) + 's');
  });
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
    var steps = document.querySelector('.steps');
    if (steps) io.observe(steps);
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
    var st = document.querySelector('.steps'); if (st) st.classList.add('in');
  }

  // ---- Counters ---------------------------------------------------------------------------
  function countUp(el, to, ms) {
    if (reduceMotion) { el.textContent = to; return; }
    var start = performance.now(), from = parseFloat(el.textContent) || 0;
    function step(t) {
      var k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var statsBox = document.querySelector('.stats');
  if (statsBox && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries, obs) {
      if (!entries[0].isIntersecting) return;
      statsBox.querySelectorAll('.count').forEach(function (c) { countUp(c, +c.dataset.to, 1400); });
      obs.disconnect();
    }).observe(statsBox);
  }

  // ---- Card tilt + spotlight (pointer devices only) ----------------------------------------
  if (window.matchMedia('(hover: hover)').matches && !reduceMotion) {
    document.querySelectorAll('.tilt').forEach(function (card) {
      card.addEventListener('pointermove', function (ev) {
        var r = card.getBoundingClientRect();
        var px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
        card.style.setProperty('--mx', (px * 100) + '%');
        card.style.setProperty('--my', (py * 100) + '%');
        card.style.transform = 'perspective(800px) rotateX(' + ((0.5 - py) * 7) + 'deg) rotateY(' + ((px - 0.5) * 7) + 'deg) translateY(-4px)';
      });
      card.addEventListener('pointerleave', function () { card.style.transform = ''; });
    });
  }

  // =========================================================================================
  //  Canvas rendering of a room + tile layout
  // =========================================================================================
  function setupCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function fmt(v, d) {
    var s = v.toFixed(d === undefined ? 2 : d);
    return s.replace(/\.?0+$/, '');
  }

  /**
   * Draws the room and the first `shown` (0..1) share of its tiles, revealed diagonally.
   * Returns the transform so pointer events can be mapped back into room units.
   */
  function drawRoom(canvas, shape, layout, shown, opts) {
    opts = opts || {};
    var c = setupCanvas(canvas), ctx = c.ctx;
    var v = TE.vertices(shape);
    var wR = 0, hR = 0;
    v.forEach(function (p) { wR = Math.max(wR, p[0]); hR = Math.max(hR, p[1]); });
    var pad = opts.pad !== undefined ? opts.pad : 44;
    var scale = Math.min((c.w - 2 * pad) / wR, (c.h - 2 * pad) / hR);
    var ox = (c.w - wR * scale) / 2, oy = (c.h - hR * scale) / 2;
    function sx(x) { return ox + x * scale; }
    function sy(y) { return oy + y * scale; }
    function path(pts) {
      ctx.beginPath();
      ctx.moveTo(sx(pts[0][0]), sy(pts[0][1]));
      for (var i = 1; i < pts.length; i++) ctx.lineTo(sx(pts[i][0]), sy(pts[i][1]));
      ctx.closePath();
    }

    ctx.clearRect(0, 0, c.w, c.h);
    path(v); ctx.fillStyle = COLORS.room; ctx.fill();

    if (layout && !layout.tooMany && layout.tiles.length) {
      var jointsVisible = layout.gap * scale >= 1.5;
      var tiles = layout.tiles;
      var count = Math.round(tiles.length * Math.max(0, Math.min(1, shown)));
      ctx.save();
      path(v); ctx.clip();
      if (jointsVisible && count > 0) { path(v); ctx.fillStyle = COLORS.groutFill; ctx.globalAlpha = Math.min(1, shown * 2); ctx.fill(); ctx.globalAlpha = 1; }
      for (var i = 0; i < count; i++) {
        var t = tiles[i];
        path(t.corners);
        ctx.fillStyle = opts.single ? COLORS.full
          : t.insert ? COLORS.insert : !t.cut ? COLORS.full : t.share < 0.2 ? COLORS.small : COLORS.cut;
        ctx.fill();
        if (!jointsVisible) { ctx.strokeStyle = COLORS.joint; ctx.lineWidth = 1; ctx.stroke(); }
      }
      ctx.restore();
    }

    path(v);
    ctx.strokeStyle = COLORS.outline; ctx.lineWidth = opts.thin ? 1.2 : 1.6; ctx.lineJoin = 'miter'; ctx.stroke();

    if (opts.labels) {
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      for (var k = 0; k < v.length; k++) {
        var a = v[k], b = v[(k + 1) % v.length], d = shape.dirs[k];
        var nx = d === 1 ? 1 : d === 3 ? -1 : 0, ny = d === 0 ? -1 : d === 2 ? 1 : 0;
        var text = fmt(shape.len[k]) + ' m';
        var tw = ctx.measureText(text).width;
        var mx = (sx(a[0]) + sx(b[0])) / 2 + nx * (tw / 2 + 8), my = (sy(a[1]) + sy(b[1])) / 2 + ny * 12;
        ctx.fillStyle = 'rgba(13,27,42,.9)';
        roundRect(ctx, mx - tw / 2 - 6, my - 10, tw + 12, 20, 6); ctx.fill();
        ctx.strokeStyle = 'rgba(74,158,173,.6)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(text, mx, my + 0.5);
      }
    }
    return { scale: scale, ox: ox, oy: oy };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // Tiles appear in a diagonal sweep, like tiling from one corner
  function sortForReveal(layout) {
    layout.tiles.sort(function (a, b) {
      var ca = a.corners[0][0] + a.corners[0][1], cb = b.corners[0][0] + b.corners[0][1];
      return ca - cb;
    });
    return layout;
  }

  function animateValue(duration, onFrame, onDone) {
    if (reduceMotion) { onFrame(1); if (onDone) onDone(); return function () {}; }
    var start = performance.now(), raf, stopped = false;
    function step(t) {
      if (stopped) return;
      var k = Math.min(1, (t - start) / duration);
      onFrame(1 - Math.pow(1 - k, 2));
      if (k < 1) raf = requestAnimationFrame(step); else if (onDone) onDone();
    }
    raf = requestAnimationFrame(step);
    return function () { stopped = true; cancelAnimationFrame(raf); };
  }

  function whenVisible(el, cb) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(function (entries) { cb(entries[0].isIntersecting); }, { threshold: 0.15 }).observe(el);
  }

  // =========================================================================================
  //  Page background: a real tile layout that changes pattern every 5 seconds
  // =========================================================================================
  (function background() {
    var layers = document.querySelectorAll('.bg-pattern');
    if (layers.length < 2 || !TE) return;
    document.body.classList.add('has-bg-pattern');
    var nameEl = document.getElementById('bg-name');
    var keyEl = document.querySelector('.bg-label-k');
    if (keyEl) keyEl.textContent = t('Pattern') + ':';
    var order = [4, 2, 3, 1, 7, 5, 6];       // herringbone first, then brick, diamond, ...
    var sizes = { 1: [80, 40], 2: [96, 44], 3: [64, 64], 4: [96, 32], 5: [96, 48], 6: [64, 64], 7: [80, 40] };
    var idx = 0, front = 0, timer = null;

    function draw(canvas, pattern) {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.round(window.innerWidth * 1.16), h = Math.round(window.innerHeight * 1.16);
      canvas.width = w * dpr; canvas.height = h * dpr;
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var room = [[0, 0], [w, 0], [w, h], [0, h]];
      var sz = sizes[pattern];
      var lay = TE.compute(room, sz[0], sz[1], pattern, { centered: true, gap: 3 });
      ctx.lineWidth = 1;
      lay.tiles.forEach(function (t, i) {
        var c = t.corners;
        ctx.beginPath();
        ctx.moveTo(c[0][0], c[0][1]);
        for (var k = 1; k < 4; k++) ctx.lineTo(c[k][0], c[k][1]);
        ctx.closePath();
        // a few tiles lightly filled, like tiles catching the light
        if ((i * 7919) % 11 === 0) { ctx.fillStyle = 'rgba(100,181,246,.07)'; ctx.fill(); }
        ctx.strokeStyle = 'rgba(100,181,246,.16)';
        ctx.stroke();
      });
    }

    function show() {
      var pattern = order[idx % order.length];
      var next = layers[1 - front];
      draw(next, pattern);
      next.classList.add('show');
      layers[front].classList.remove('show');
      front = 1 - front;
      if (nameEl) {
        nameEl.classList.add('fade');
        setTimeout(function () { nameEl.textContent = PATTERNS[pattern].name; nameEl.classList.remove('fade'); }, 400);
      }
      idx++;
    }

    show();
    if (!reduceMotion) {
      timer = setInterval(function () { if (!document.hidden) show(); }, 5000);
    }
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { draw(layers[front], order[(idx - 1 + order.length) % order.length]); }, 200);
    });
  })();

  // =========================================================================================
  //  Hero phone: the free Calculator screen typing in jobs and showing the tile count
  // =========================================================================================

  /** Tile count exactly as the free app works it out (plain length x width). */
  function freeTileCount(L, Wd, tl, tw, pattern, wastePct) {
    var eps = 1e-9;
    var across = Math.floor(L / tl + eps), down = Math.floor(Wd / tw + eps);
    var remL = L - across * tl, remW = Wd - down * tw;
    if (remL < 1e-6) remL = 0;
    if (remW < 1e-6) remW = 0;
    var base = across * down;
    var reuse = pattern === 2 || pattern === 4 || pattern === 5 || pattern === 6;
    if (remL > 0) base += (reuse && remL <= tl / 2 && down > 1) ? Math.ceil(down / 2) : down;
    if (remW > 0) base += (reuse && remW <= tw / 2 && across > 1) ? Math.ceil(across / 2) : across;
    if (remL > 0 && remW > 0) base += 1;
    var withWaste = base * (1 + wastePct / 100);
    return { total: Math.ceil(withWaste), waste: Math.ceil(withWaste - base) };
  }

  (function hero() {
    var screen = document.querySelector('.calc-screen');
    if (!screen) return;
    var $ = function (id) { return document.getElementById(id); };
    var jobs = [
      { job: t('Kitchen floor'), al: 4.5, aw: 3.2, tl: 60, tw: 30, p: 4 },
      { job: t('Bathroom wall'), al: 2.4, aw: 2.1, tl: 30, tw: 15, p: 2 },
      { job: t('Hallway'), al: 6, aw: 1.2, tl: 45, tw: 45, p: 3 },
      { job: t('Shower floor'), al: 1.8, aw: 1.2, tl: 20, tw: 20, p: 6 }
    ];
    var idx = 0, visible = false, timers = [], running = false;
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearAll() { timers.forEach(clearTimeout); timers = []; }

    function swatch(pattern) {
      var c = $('pat-swatch'); if (!c) return;
      var sq = { dirs: [0, 1, 2, 3], len: [0.6, 0.6, 0.6, 0.6] };
      var t = PATTERNS[pattern].tile;
      drawRoom(c, sq, TE.compute(TE.vertices(sq), t[0] / 100, t[1] / 100, pattern, { centered: false, gap: 0.006 }), 1,
        { pad: 0, single: true, thin: true });
    }

    function type(el, text, done) {
      el.textContent = '';
      el.classList.add('typing');
      var i = 0;
      (function next() {
        if (i <= text.length) { el.textContent = text.slice(0, i++); later(next, reduceMotion ? 0 : 70); }
        else { el.classList.remove('typing'); if (done) done(); }
      })();
    }

    function reset() {
      ['calc-job', 'calc-al', 'calc-aw', 'calc-tl', 'calc-tw'].forEach(function (id) { $(id).textContent = ''; });
      $('calc-at').textContent = '--'; $('calc-tt').textContent = '--';
      $('calc-at').classList.remove('on'); $('calc-tt').classList.remove('on');
      $('calc-result').classList.remove('show');
    }

    function run() {
      if (!visible) { running = false; return; }
      running = true;
      var j = jobs[idx % jobs.length], p = PATTERNS[j.p];
      reset();
      $('calc-pattern').textContent = p.spin;
      swatch(j.p);
      type($('calc-job'), j.job, function () {
        type($('calc-al'), fmt(j.al), function () {
          type($('calc-aw'), fmt(j.aw), function () {
            $('calc-at').textContent = fmt(j.al * j.aw) + ' m²'; $('calc-at').classList.add('on');
            type($('calc-tl'), String(j.tl), function () {
              type($('calc-tw'), String(j.tw), function () {
                $('calc-tt').textContent = fmt(j.tl * j.tw / 10000, 3) + ' m²'; $('calc-tt').classList.add('on');
                later(function () {
                  var btn = $('calc-btn');
                  btn.classList.add('press');
                  later(function () { btn.classList.remove('press'); }, 180);
                  var r = freeTileCount(j.al, j.aw, j.tl / 100, j.tw / 100, j.p, p.waste);
                  $('calc-wpct').textContent = p.waste;
                  $('calc-tiles').textContent = '0'; $('calc-waste').textContent = '0';
                  $('calc-result').classList.add('show');
                  countUp($('calc-tiles'), r.total, 900);
                  countUp($('calc-waste'), r.waste, 900);
                  later(function () { idx++; run(); }, 3400);
                }, 450);
              });
            });
          });
        });
      });
    }
    whenVisible(screen, function (vis) {
      visible = vis;
      if (vis && !running) run();
      if (!vis) { clearAll(); running = false; }
    });
  })();

  // =========================================================================================
  //  PRO preview: a scripted, self-playing walkthrough (no user input)
  // =========================================================================================
  (function demo() {
    var canvas = document.getElementById('demo-canvas');
    if (!canvas) return;
    var $ = function (id) { return document.getElementById(id); };
    var steps = document.querySelectorAll('#demo-steps li');

    var NAMES = { rectangle: t('Rectangle'), l: t('L-shape'), t: t('T-shape'), u: t('U-shape') };
    // Each scene changes one thing; tweens animate rotation, tile position or grout over time.
    var SCENES = [
      { step: 0, set: { shape: 'rectangle', w: 5, h: 3.5, p: 5, tl: 60, tw: 30, gap: 3, rot: 0, ox: 0, oy: 0 },
        text: t('Start with the room: a 5 x 3.5 m rectangle, laid in a simple stack.'), reveal: true },
      { step: 1, set: { p: 2 }, text: t('Switch to brick. Every row shifts by half a tile and the cuts move with it.'), reveal: true },
      { step: 1, set: { p: 4 }, text: t('Herringbone: the app lays the real pattern and counts every cut piece.'), reveal: true },
      { step: 2, set: { tl: 30, tw: 10 }, text: t('Smaller 30 x 10 cm tiles: more tiles, more cuts along the walls.'), reveal: true },
      { step: 3, set: { tl: 60, tw: 30, p: 5 }, tween: { gap: [2, 10] },
        text: t('Wider grout joints change the count, the grout to buy and the drawing.') },
      { step: 4, set: { gap: 3, p: 4 }, tween: { rot: [0, 45] }, text: t('Rotate the whole layout with two fingers. It snaps to 45 degrees.') },
      { step: 4, set: { rot: 0 }, tween: { ox: [0, 0.3], oy: [0, 0.15] },
        text: t('Drag the tiles to balance the cuts, so no thin slivers end up at the walls.') },
      { step: 0, set: { shape: 'l', w: 5, h: 4.5, ox: 0, oy: 0, p: 4 }, text: t('Real rooms are rarely rectangles. Pick an L-shape and set each wall.'), reveal: true },
      { step: 0, set: { shape: 'u', w: 5, h: 4, p: 1, tl: 30, tw: 15 }, text: t('Or a U-shape with basketweave. Tiles, grout and adhesive are worked out for you.'), reveal: true },
      { step: 0, set: { shape: 't', w: 6, h: 5, p: 3, tl: 40, tw: 40 }, text: t('A T-shaped room in diamond. Every room is ready for a PDF quote.'), reveal: true }
    ];
    var SCENE_MS = 4200;
    var state = {};

    function shapeFor(st) {
      var base = TE.SHAPES[st.shape];
      var bv = TE.vertices(base), bw = 0, bh = 0;
      bv.forEach(function (p) { bw = Math.max(bw, p[0]); bh = Math.max(bh, p[1]); });
      return { dirs: base.dirs.slice(), len: base.len.map(function (l, i) { return base.dirs[i] % 2 === 0 ? l * st.w / bw : l * st.h / bh; }) };
    }

    function setText(id, text) {
      var el = $(id);
      if (el.textContent === text) return;
      el.textContent = text;
      var li = el.closest('li');
      if (li) { li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash'); }
    }
    function setResult(id, text) {
      var el = $(id);
      if (el.textContent === text) return;
      el.textContent = text;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }

    function render(shown, bumpResults) {
      var shape = shapeFor(state), room = TE.vertices(shape);
      var lay = TE.compute(room, state.tl / 100, state.tw / 100, state.p,
        { centered: true, gap: state.gap / 1000, rot: state.rot, offX: state.ox, offY: state.oy });
      sortForReveal(lay);
      drawRoom(canvas, shape, lay, shown, { labels: true });

      setText('ds-shape', NAMES[state.shape] + ' · ' + fmt(TE.area(shape)) + ' m²');
      setText('ds-pattern', PATTERNS[state.p].name);
      setText('ds-tile', state.tl + ' x ' + state.tw + ' cm');
      setText('ds-gap', Math.round(state.gap) + ' mm');
      var moved = Math.abs(state.ox) > 0.001 || Math.abs(state.oy) > 0.001;
      setText('ds-layout', (moved ? t('Moved') : t('Centred')) + ', ' + Math.round(state.rot) + '°');

      if (!bumpResults) return;
      var area = TE.area(shape);
      setResult('r-area', fmt(area) + ' m²');
      setResult('r-full', String(lay.full));
      setResult('r-cut', lay.cut + (lay.small ? ' (' + lay.small + ' ' + t('small') + ')' : ''));
      setResult('r-buy', Math.ceil((lay.full + lay.cut) * (1 + PATTERNS[state.p].waste / 100)) + ' ' + t('tiles'));
      var L = state.tl * 10, W = state.tw * 10, longest = Math.max(L, W);
      var grout = (L + W) / (L * W) * 8 * state.gap * 1.6 * area * 1.1;
      var notch = longest <= 200 ? 6 : longest <= 400 ? 8 : longest <= 600 ? 10 : 12;
      setResult('r-grout', fmt(grout, 1) + ' kg');
      setResult('r-glue', fmt({ 6: 2.5, 8: 3.5, 10: 4.5, 12: 5.5 }[notch] * area * 1.1, 1) + ' kg');
    }

    var idx = 0, visible = false, raf = null, sceneStart = 0, captionTimer = null;

    function startScene() {
      var sc = SCENES[idx % SCENES.length];
      Object.keys(sc.set).forEach(function (k) { state[k] = sc.set[k]; });
      if (sc.tween) Object.keys(sc.tween).forEach(function (k) { state[k] = sc.tween[k][0]; });
      steps.forEach(function (li, i) { li.classList.toggle('active', i === sc.step); });
      var cap = $('demo-caption');
      cap.classList.add('fade');
      clearTimeout(captionTimer);
      captionTimer = setTimeout(function () { cap.textContent = sc.text; cap.classList.remove('fade'); }, 250);
      sceneStart = performance.now();
      render(sc.reveal ? 0 : 1, true);
    }

    function frame(t) {
      var sc = SCENES[idx % SCENES.length];
      var k = Math.min(1, (t - sceneStart) / SCENE_MS);
      $('demo-bar').style.width = (k * 100) + '%';
      if (sc.tween) {
        var e = k < 0.75 ? 0.5 - 0.5 * Math.cos(Math.PI * k / 0.75) : 1;   // ease, then hold
        Object.keys(sc.tween).forEach(function (key) {
          var r = sc.tween[key]; state[key] = r[0] + (r[1] - r[0]) * e;
        });
        render(1, Math.floor(k * 12) !== Math.floor((k - 0.016) * 12));    // results ~12x per scene
      } else if (sc.reveal) {
        render(Math.min(1, k / 0.35), false);
      }
      if (k >= 1) { idx++; startScene(); }
      if (visible) raf = requestAnimationFrame(frame);
    }

    function startLoop() {
      if (raf) return;
      if (!state.shape) startScene();
      else sceneStart = performance.now(); // resume the current scene from its start
      if (reduceMotion) { render(1, true); return; }
      raf = requestAnimationFrame(frame);
    }
    function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = null; }

    whenVisible(canvas, function (vis) { visible = vis; if (vis) startLoop(); else stopLoop(); });
    window.addEventListener('resize', function () { if (state.shape) render(1, false); });
  })();

  // =========================================================================================
  //  Pattern gallery: each card shows its pattern slowly drifting
  // =========================================================================================
  (function gallery() {
    var grid = document.getElementById('pattern-grid');
    if (!grid) return;
    var order = [5, 6, 2, 3, 4, 1, 7];
    var square = { dirs: [0, 1, 2, 3], len: [1.2, 1.2, 1.2, 1.2] };
    var room = TE.vertices(square);
    var cards = order.map(function (id, i) {
      var p = PATTERNS[id];
      var card = document.createElement('div');
      card.className = 'card pattern-card reveal';
      card.style.setProperty('--d', (i * 0.06) + 's');
      card.innerHTML = '<canvas aria-hidden="true"></canvas><h4>' + p.name + '</h4><p>' + t('Waste') + ' ' + p.waste + '%</p>';
      grid.appendChild(card);
      return { id: id, canvas: card.querySelector('canvas'), el: card };
    });

    // Reveal the generated cards too
    if ('IntersectionObserver' in window && !reduceMotion) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.1 });
      cards.forEach(function (c) { io.observe(c.el); });
    } else cards.forEach(function (c) { c.el.classList.add('in'); });

    var visible = false, raf = null, t0 = performance.now();
    function frame(t) {
      var s = (t - t0) / 1000;
      cards.forEach(function (c) {
        var tile = PATTERNS[c.id].tile;
        var lay = TE.compute(room, tile[0] / 100, tile[1] / 100, c.id,
          { centered: false, gap: 0.004, offX: (s * 0.05) % 1.2, offY: (s * 0.03) % 1.2 });
        drawRoom(c.canvas, square, lay, 1, { pad: 0, single: true, thin: true });
      });
      if (visible && !reduceMotion) raf = requestAnimationFrame(frame);
    }
    whenVisible(grid, function (vis) {
      visible = vis;
      if (vis && !raf) raf = requestAnimationFrame(frame);
      if (!vis && raf) { cancelAnimationFrame(raf); raf = null; }
    });
  })();
})();
