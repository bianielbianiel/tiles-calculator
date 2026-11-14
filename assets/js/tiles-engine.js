/*
 * Tile layout engine — a JavaScript port of the app's RoomShape + TileLayout.
 * Lays a pattern over an orthogonal room outline at real scale and classifies every tile
 * as full or cut (the cut piece keeps the polygon that stays inside the room).
 *
 * Patterns (same ids as the app): 1 basketweave, 2 brick, 3 diamond, 4 herringbone,
 * 5 stack, 6 square, 7 windmill.
 */
(function (global) {
  'use strict';

  var E = 0, S = 1, W = 2, N = 3;
  var DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

  // Room templates: walls walked clockwise from the top-left corner (y points down).
  var SHAPES = {
    rectangle: { dirs: [E, S, W, N], len: [5, 3.5, 5, 3.5] },
    l:         { dirs: [E, S, E, S, W, N], len: [2.5, 2, 2.5, 2.5, 5, 4.5] },
    t:         { dirs: [E, S, W, S, W, N, W, N], len: [6, 2, 2, 3, 2, 3, 2, 2] },
    u:         { dirs: [E, S, E, N, E, S, W, N], len: [1.5, 2.5, 2, 2.5, 1.5, 4, 5, 4] }
  };

  function vertices(shape) {
    var p = [], x = 0, y = 0, minX = 0, minY = 0;
    for (var k = 0; k < shape.len.length; k++) {
      p.push([x, y]);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      x += DX[shape.dirs[k]] * shape.len[k];
      y += DY[shape.dirs[k]] * shape.len[k];
    }
    return p.map(function (v) { return [v[0] - minX, v[1] - minY]; });
  }

  function signedArea(p) {
    var a = 0;
    for (var k = 0, n = p.length; k < n; k++) {
      var u = p[k], v = p[(k + 1) % n];
      a += u[0] * v[1] - v[0] * u[1];
    }
    return a / 2;
  }

  function scaleShape(shape, f) {
    return { dirs: shape.dirs.slice(), len: shape.len.map(function (l) { return l * f; }) };
  }

  // --- Sutherland–Hodgman: clip the (possibly concave) room by a convex tile ---------------
  function side(a, b, p) { return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); }
  function intersect(a, b, p, q) {
    var s1 = side(a, b, p), s2 = side(a, b, q), t = s1 / (s1 - s2);
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  }
  function clip(subject, convexClip) {
    var c = convexClip;
    if (signedArea(c) < 0) c = [c[3], c[2], c[1], c[0]];
    var output = subject.slice();
    for (var e = 0; e < c.length && output.length; e++) {
      var a = c[e], b = c[(e + 1) % c.length], input = output;
      output = [];
      var prev = input[input.length - 1], prevIn = side(a, b, prev) >= -1e-12;
      for (var i = 0; i < input.length; i++) {
        var cur = input[i], curIn = side(a, b, cur) >= -1e-12;
        if (curIn) {
          if (!prevIn) output.push(intersect(a, b, prev, cur));
          output.push(cur);
        } else if (prevIn) {
          output.push(intersect(a, b, prev, cur));
        }
        prev = cur; prevIn = curIn;
      }
    }
    return output.length < 3 ? null : output;
  }

  // --- Pattern generators (local coordinates) ------------------------------------------------
  function grid(L, Wd, cx, cy, x0, y0, x1, y1, out) {
    var i0 = Math.floor((x0 - cx) / L) - 1, i1 = Math.ceil((x1 - cx) / L) + 1;
    var j0 = Math.floor((y0 - cy) / Wd) - 1, j1 = Math.ceil((y1 - cy) / Wd) + 1;
    for (var j = j0; j <= j1; j++)
      for (var i = i0; i <= i1; i++)
        out.push([cx + i * L, cy + j * Wd, cx + (i + 1) * L, cy + (j + 1) * Wd, 0]);
  }
  function brick(L, Wd, cx, cy, x0, y0, x1, y1, out) {
    var j0 = Math.floor((y0 - cy) / Wd) - 1, j1 = Math.ceil((y1 - cy) / Wd) + 1;
    for (var j = j0; j <= j1; j++) {
      var shift = cx + ((j & 1) ? L / 2 : 0);
      var i0 = Math.floor((x0 - shift) / L) - 1, i1 = Math.ceil((x1 - shift) / L) + 1;
      for (var i = i0; i <= i1; i++)
        out.push([shift + i * L, cy + j * Wd, shift + (i + 1) * L, cy + (j + 1) * Wd, 0]);
    }
  }
  function basketweave(L, Wd, x0, y0, x1, y1, out) {
    var a = Math.max(L, Wd), b = Math.min(L, Wd);
    var n = Math.max(1, Math.round(a / b)), t = a / n;
    var i0 = Math.floor(x0 / a) - 1, i1 = Math.ceil(x1 / a) + 1;
    var j0 = Math.floor(y0 / a) - 1, j1 = Math.ceil(y1 / a) + 1;
    for (var j = j0; j <= j1; j++)
      for (var i = i0; i <= i1; i++) {
        var x = i * a, y = j * a, horizontal = ((i + j) & 1) === 0;
        for (var k = 0; k < n; k++) {
          if (horizontal) out.push([x, y + k * t, x + a, y + (k + 1) * t, 0]);
          else out.push([x + k * t, y, x + (k + 1) * t, y + a, 0]);
        }
      }
  }
  function herringbone(L, Wd, x0, y0, x1, y1, out) {
    var a = Math.max(L, Wd), b = Math.min(L, Wd);
    var k0 = Math.floor((x0 + y0) / (2 * b)) - 2, k1 = Math.ceil((x1 + y1) / (2 * b)) + 2;
    var m0 = Math.floor((x0 - y1) / (2 * a)) - 2, m1 = Math.ceil((x1 - y0) / (2 * a)) + 2;
    for (var m = m0; m <= m1; m++)
      for (var k = k0; k <= k1; k++) {
        var sx = k * b + m * a, sy = k * b - m * a;
        out.push([sx, sy, sx + a, sy + b, 0]);
        out.push([sx, sy + b, sx + b, sy + b + a, 0]);
      }
  }
  function windmill(L, Wd, x0, y0, x1, y1, out) {
    var a = Math.max(L, Wd), b = Math.min(L, Wd);
    if (a - b < 1e-9) { grid(a, a, 0, 0, x0, y0, x1, y1, out); return; }
    var p = a + b;
    var i0 = Math.floor(x0 / p) - 1, i1 = Math.ceil(x1 / p) + 1;
    var j0 = Math.floor(y0 / p) - 1, j1 = Math.ceil(y1 / p) + 1;
    for (var j = j0; j <= j1; j++)
      for (var i = i0; i <= i1; i++) {
        var x = i * p, y = j * p;
        out.push([x, y, x + a, y + b, 0]);
        out.push([x + a, y, x + p, y + a, 0]);
        out.push([x + b, y + a, x + p, y + p, 0]);
        out.push([x, y + b, x + b, y + p, 0]);
        out.push([x + b, y + b, x + a, y + a, 1]);
      }
  }

  /**
   * @param room     outline vertices
   * @param tileLen  tile length, same unit as the room
   * @param tileWid  tile width
   * @param pattern  1..7
   * @param opts     { centered, gap, rot (deg), offX, offY (pattern shift, room units) }
   */
  function compute(room, tileLen, tileWid, pattern, opts) {
    opts = opts || {};
    var gap = opts.gap > 0 ? opts.gap : 0, centered = opts.centered !== false;
    var out = { tiles: [], full: 0, cut: 0, small: 0, inserts: 0, tooMany: false, gap: gap };
    if (!room || room.length < 3 || !(tileLen > 0) || !(tileWid > 0)) return out;

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    room.forEach(function (v) {
      minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
      minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
    });
    var cell = (tileLen + gap) * (tileWid + gap);
    var diag = Math.hypot(maxX - minX, maxY - minY);
    if (diag * diag / cell > 20000) {
      out.tooMany = true;
      out.full = Math.ceil(Math.abs(signedArea(room)) / cell);
      return out;
    }

    var angle = pattern === 3 ? Math.PI / 4 : pattern === 4 ? -Math.PI / 4 : 0;
    angle += (opts.rot || 0) * Math.PI / 180;
    var ox = (centered ? (minX + maxX) / 2 : minX) + (opts.offX || 0);
    var oy = (centered ? (minY + maxY) / 2 : minY) + (opts.offY || 0);
    var cos = Math.cos(angle), sin = Math.sin(angle);

    var lx0 = Infinity, ly0 = Infinity, lx1 = -Infinity, ly1 = -Infinity;
    [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]].forEach(function (b) {
      var dx = b[0] - ox, dy = b[1] - oy;
      var lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
      lx0 = Math.min(lx0, lx); lx1 = Math.max(lx1, lx);
      ly0 = Math.min(ly0, ly); ly1 = Math.max(ly1, ly);
    });

    // Grout: lay out tile + joint, then shrink each tile back from its top-left corner.
    var L = tileLen + gap, Wd = tileWid + gap;
    var cx = centered ? -(L - gap) / 2 : 0, cy = centered ? -(Wd - gap) / 2 : 0;
    var rects = [];
    switch (pattern) {
      case 1: basketweave(L, Wd, lx0, ly0, lx1, ly1, rects); break;
      case 2: brick(L, Wd, cx, cy, lx0, ly0, lx1, ly1, rects); break;
      case 4: herringbone(L, Wd, lx0, ly0, lx1, ly1, rects); break;
      case 7: windmill(L, Wd, lx0, ly0, lx1, ly1, rects); break;
      default: grid(L, Wd, cx, cy, lx0, ly0, lx1, ly1, rects);
    }

    function toWorld(lx, ly) { return [lx * cos - ly * sin + ox, lx * sin + ly * cos + oy]; }

    rects.forEach(function (r) {
      if (gap > 0) { r[2] -= gap; r[3] -= gap; }
      var corners = [toWorld(r[0], r[1]), toWorld(r[2], r[1]), toWorld(r[2], r[3]), toWorld(r[0], r[3])];
      var tx0 = Infinity, ty0 = Infinity, tx1 = -Infinity, ty1 = -Infinity;
      corners.forEach(function (c) {
        tx0 = Math.min(tx0, c[0]); tx1 = Math.max(tx1, c[0]);
        ty0 = Math.min(ty0, c[1]); ty1 = Math.max(ty1, c[1]);
      });
      if (tx1 <= minX || tx0 >= maxX || ty1 <= minY || ty0 >= maxY) return;
      var area = (r[2] - r[0]) * (r[3] - r[1]);
      var piece = clip(room, corners);
      var share = piece ? Math.abs(signedArea(piece)) / area : 0;
      if (share < 1e-6) return;
      var insert = r[4] > 0, cut = share <= 1 - 1e-6;
      out.tiles.push({ corners: corners, piece: cut ? piece : null, cut: cut, insert: insert, share: share });
      if (insert) out.inserts++;
      else if (cut) { out.cut++; if (share < 0.2) out.small++; }
      else out.full++;
    });
    return out;
  }

  global.TileEngine = {
    SHAPES: SHAPES,
    vertices: vertices,
    area: function (shape) { return Math.abs(signedArea(vertices(shape))); },
    perimeter: function (shape) { return shape.len.reduce(function (s, l) { return s + l; }, 0); },
    scaleShape: scaleShape,
    compute: compute,
    signedArea: signedArea
  };
})(window);
