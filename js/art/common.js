/* Общие инструменты рисования: проекция, цвета, фигуры */
(function () {
  const TD = globalThis.TD;
  const W = TD.WORLD;
  const PI = Math.PI;
  const ZK = (W.GY1 - W.GY0) / W.Z_MAX;

  const sc = (z) => W.S0 + (W.S1 - W.S0) * (z / W.Z_MAX);
  function P(x, z, h) {
    const s = sc(z);
    return { x: W.VPX + (x + W.XOFF - W.VPX) * s + (W.Z_MAX / 2 - z) * W.SHEAR, y: W.GY0 + ZK * z - (h || 0) * s, s };
  }

  function seeded(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  const shadeCache = new Map();
  function rgb(c) {
    if (c[0] === '#') {
      const n = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = c.match(/[\d.]+/g) || [128, 128, 128];
    return [+m[0], +m[1], +m[2]];
  }
  // f < 1 — темнее, f > 1 — светлее
  function shade(c, f) {
    const key = c + '|' + f;
    let v = shadeCache.get(key);
    if (v) return v;
    let [r, g, b] = rgb(c);
    if (f < 1) { r *= f; g *= f; b *= f; } else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
    v = `rgb(${r | 0},${g | 0},${b | 0})`;
    shadeCache.set(key, v);
    return v;
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return `rgb(${(A[0] + (B[0] - A[0]) * t) | 0},${(A[1] + (B[1] - A[1]) * t) | 0},${(A[2] + (B[2] - A[2]) * t) | 0})`;
  }
  function alpha(c, a) { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; }
  function jitter(c, rnd, amt) { return shade(c, 1 + (rnd() - 0.5) * amt * 2 > 1 ? 1 + (rnd() - 0.3) * amt : 1 - rnd() * amt); }

  function path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }
  function poly(ctx, pts, fill, stroke, lw) {
    path(ctx, pts);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function line(ctx, x1, y1, x2, y2, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.05, r), 0, PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function ellipse(ctx, x, y, rx, ry, rot, fill, stroke, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.05, rx), Math.max(0.05, ry), rot || 0, 0, PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  // Капсула (сужающаяся конечность) от (x1,y1) радиуса r1 до (x2,y2) радиуса r2
  function capsule(ctx, x1, y1, x2, y2, r1, r2) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.arc(x1, y1, r1, a + PI / 2, a - PI / 2 + PI * 2);
    ctx.arc(x2, y2, r2, a - PI / 2, a + PI / 2);
    ctx.closePath();
  }
  // Линейный градиент «свет сверху-справа»
  function lit(ctx, cx, cy, r, base, hi, lo) {
    const g = ctx.createLinearGradient(cx + r * 0.75, cy - r * 0.75, cx - r * 0.75, cy + r * 0.75);
    g.addColorStop(0, shade(base, hi || 1.28));
    g.addColorStop(0.45, base);
    g.addColorStop(1, shade(base, lo || 0.62));
    return g;
  }
  function vgrad(ctx, y0, y1, c0, c1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    return g;
  }
  function hgrad(ctx, x0, x1, stops) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }

  function makeGlow(r, g, b, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size * 2;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(size, size, 0, size, size, size);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
    gr.addColorStop(0.35, `rgba(${r},${g},${b},0.45)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, size * 2, size * 2);
    return c;
  }

  const OUT = 'rgba(18,10,10,0.82)';

  TD.Art = { P, sc, ZK, PI, seeded, rgb, shade, mix, alpha, jitter, path, poly, line, circle, ellipse, capsule, lit, vgrad, hgrad, makeGlow, OUT };
})();
