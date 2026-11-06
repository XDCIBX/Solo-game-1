/* Детализированные здания поселения: статичная часть рисуется один раз в спрайт */
(function () {
  const TD = globalThis.TD;
  const A = TD.Art;
  const { P, PI, shade, alpha, path, poly, line, circle, ellipse, OUT, seeded } = A;
  const lerp = (a, b, t) => a + (b - a) * t;
  const LW0 = 0.6;

  // Точка на грани: front — плоскость z=const (u = x), side — плоскость x=const (u = z)
  const F = (fc, u, h) => (fc.z != null ? P(u, fc.z, h) : P(fc.x, u, h));
  function quad(c, fc, u0, h0, u1, h1) { path(c, [F(fc, u0, h0), F(fc, u1, h0), F(fc, u1, h1), F(fc, u0, h1)]); }
  function quadFill(c, fc, u0, h0, u1, h1, fill, stroke, lw) { quad(c, fc, u0, h0, u1, h1); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 0.5; c.stroke(); } }
  function vg(c, fc, u, h0, h1, c0, c1) { const a = F(fc, u, h1), b = F(fc, u, h0); const g = c.createLinearGradient(0, a.y, 0, b.y); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }

  // ---------- Текстуры ----------
  function plaster(c, fc, u0, u1, h0, h1, col, rnd) {
    quadFill(c, fc, u0, h0, u1, h1, vg(c, fc, (u0 + u1) / 2, h0, h1, shade(col, 1.08), shade(col, 0.78)));
    for (let i = 0; i < (u1 - u0) * (h1 - h0) * 0.05; i++) {
      const p = F(fc, lerp(u0, u1, rnd()), lerp(h0, h1, rnd()));
      c.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
      c.fillRect(p.x, p.y, (1 + rnd() * 2.5) * p.s, (0.8 + rnd()) * p.s);
    }
    // Грязь снизу
    quadFill(c, fc, u0, h0, u1, h0 + 7, vg(c, fc, u0, h0, h0 + 7, 'rgba(40,30,20,0)', 'rgba(40,30,20,0.35)'));
  }
  function stones(c, fc, u0, u1, h0, h1, base, rnd, rowH, len, rough) {
    quadFill(c, fc, u0, h0, u1, h1, shade(base, 0.5));
    let row = 0;
    for (let h = h0; h < h1 - 0.5; h += rowH, row++) {
      const hh = Math.min(h1, h + rowH);
      let u = u0 - (row % 2 ? len * 0.5 : 0) - rnd() * 2;
      while (u < u1) {
        const L = len * (rough ? 0.6 + rnd() * 0.8 : 0.85 + rnd() * 0.3);
        const ua = Math.max(u0, u + 0.45), ub = Math.min(u1, u + L - 0.45);
        if (ub > ua + 0.6) {
          const col = shade(base, 0.8 + rnd() * 0.4);
          if (rough) {
            const a = F(fc, ua, h + 0.5), b = F(fc, ub, h + 0.4 + rnd() * 0.5), cc = F(fc, ub - rnd() * 0.8, hh - 0.5), d = F(fc, ua + rnd() * 0.8, hh - 0.4);
            poly(c, [a, b, cc, d], col);
          } else quadFill(c, fc, ua, h + 0.45, ub, hh - 0.45, col);
          const t0 = F(fc, ua, hh - 0.5), t1 = F(fc, ub, hh - 0.5);
          line(c, t0.x, t0.y, t1.x, t1.y, 'rgba(255,255,255,0.13)', 0.6 * t0.s);
        }
        u += L;
      }
    }
  }
  function planks(c, fc, u0, u1, h0, h1, base, rnd, w) {
    w = w || 5;
    for (let u = u0; u < u1 - 0.2; u += w) {
      const ub = Math.min(u1, u + w);
      quadFill(c, fc, u, h0, ub - 0.35, h1, vg(c, fc, u, h0, h1, shade(base, 0.95 + rnd() * 0.3), shade(base, 0.65 + rnd() * 0.15)));
      c.strokeStyle = 'rgba(30,18,8,0.35)'; c.lineWidth = 0.35;
      c.beginPath();
      for (let k = 0; k < 2; k++) {
        const uu = u + w * (0.3 + k * 0.4) + rnd() * 0.5;
        const a = F(fc, uu, h0 + 1), b = F(fc, uu + (rnd() - 0.5), h1 - 1);
        c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      }
      c.stroke();
      if (rnd() < 0.25) { const k = F(fc, u + w / 2, lerp(h0, h1, rnd())); ellipse(c, k.x, k.y, 0.7 * k.s, 1.1 * k.s, 0, 'rgba(30,18,8,0.5)'); }
    }
  }
  function beamF(c, fc, u0, h0, u1, h1, bw, col) {
    // Брус фахверка по грани (по осям или диагональ)
    let pts;
    if (Math.abs(h1 - h0) < 0.01) pts = [F(fc, u0, h0 - bw / 2), F(fc, u1, h0 - bw / 2), F(fc, u1, h0 + bw / 2), F(fc, u0, h0 + bw / 2)];
    else if (Math.abs(u1 - u0) < 0.01) pts = [F(fc, u0 - bw / 2, h0), F(fc, u0 + bw / 2, h0), F(fc, u0 + bw / 2, h1), F(fc, u0 - bw / 2, h1)];
    else pts = [F(fc, u0 - bw / 2, h0), F(fc, u0 + bw / 2, h0), F(fc, u1 + bw / 2, h1), F(fc, u1 - bw / 2, h1)];
    poly(c, pts, col, 'rgba(15,8,4,0.6)', 0.4);
  }
  function timber(c, fc, u0, u1, h0, h1, col, rnd, braces) {
    const bw = 2.3;
    beamF(c, fc, u0, h0 + 1, u1, h0 + 1, bw, col);
    beamF(c, fc, u0, h1 - 1, u1, h1 - 1, bw, col);
    const n = Math.max(2, Math.round((u1 - u0) / 22));
    const posts = [];
    for (let i = 0; i <= n; i++) posts.push(lerp(u0 + 1, u1 - 1, i / n));
    if (braces) for (let i = 0; i < n; i++) if (i % 2 === 0) { beamF(c, fc, posts[i], h0 + 2, posts[i + 1], h1 - 2, 1.8, shade(col, 0.95)); }
    for (const u of posts) beamF(c, fc, u, h0, u, h1, bw, col);
  }

  // Окно со ставнями, рамой и тёплым светом
  function windowW(c, fc, u, h, w, hh, o, lights) {
    o = o || {};
    const sh = o.shutter || '#4a5a3a';
    if (o.shutters !== false) {
      quadFill(c, fc, u - w / 2 - w * 0.5, h - 0.3, u - w / 2 - 0.6, h + hh + 0.3, shade(sh, 1.05), OUT, 0.4);
      quadFill(c, fc, u + w / 2 + 0.6, h - 0.3, u + w / 2 + w * 0.5, h + hh + 0.3, shade(sh, 0.8), OUT, 0.4);
      for (const s of [-1, 1]) {
        const ua = s < 0 ? u - w / 2 - w * 0.5 : u + w / 2 + 0.6, ub = s < 0 ? u - w / 2 - 0.6 : u + w / 2 + w * 0.5;
        const a = F(fc, ua + 0.4, h + hh * 0.3), b = F(fc, ub - 0.4, h + hh * 0.3), a2 = F(fc, ua + 0.4, h + hh * 0.7), b2 = F(fc, ub - 0.4, h + hh * 0.7);
        line(c, a.x, a.y, b.x, b.y, 'rgba(0,0,0,0.4)', 0.4); line(c, a2.x, a2.y, b2.x, b2.y, 'rgba(0,0,0,0.4)', 0.4);
      }
    }
    quadFill(c, fc, u - w / 2 - 1, h - 1, u + w / 2 + 1, h + hh + 1, o.frame || '#3a2618', OUT, 0.5);
    const lit = o.lit !== false;
    const top = F(fc, u, h + hh), bot = F(fc, u, h);
    const g = c.createLinearGradient(0, top.y, 0, bot.y);
    if (lit) { g.addColorStop(0, o.glass2 || '#ffd27a'); g.addColorStop(1, o.glass || '#ff9a3a'); }
    else { g.addColorStop(0, '#2a3040'); g.addColorStop(1, '#141820'); }
    if (o.arch) {
      const pts = [F(fc, u - w / 2, h), F(fc, u + w / 2, h)];
      for (let i = 0; i <= 8; i++) { const a = (i / 8) * PI; pts.push(F(fc, u + Math.cos(a) * w / 2, h + hh - w / 2 + Math.sin(a) * w / 2)); }
      poly(c, pts, g);
    } else quadFill(c, fc, u - w / 2, h, u + w / 2, h + hh, g);
    // Переплёт
    const m0 = F(fc, u, h), m1 = F(fc, u, h + hh), m2 = F(fc, u - w / 2, h + hh * 0.55), m3 = F(fc, u + w / 2, h + hh * 0.55);
    line(c, m0.x, m0.y, m1.x, m1.y, o.frame || '#3a2618', 0.8 * m0.s);
    line(c, m2.x, m2.y, m3.x, m3.y, o.frame || '#3a2618', 0.8 * m0.s);
    // Подоконник
    quadFill(c, fc, u - w / 2 - 1.8, h - 2, u + w / 2 + 1.8, h - 0.6, '#8a8278', OUT, 0.35);
    if (o.flowers) {
      quadFill(c, fc, u - w / 2 - 1, h - 4.6, u + w / 2 + 1, h - 2, '#5a3a20', OUT, 0.35);
      const r = seeded(Math.round(u * 13 + h));
      for (let i = 0; i < 7; i++) {
        const p = F(fc, u - w / 2 + (w * i) / 6, h - 1.4 + r() * 1.2);
        circle(c, p.x, p.y, 0.9 * p.s, '#2e5a2a');
        circle(c, p.x + 0.3, p.y - 0.4, 0.55 * p.s, ['#d84a6a', '#e8c040', '#c84a3a', '#e8e0f0'][i % 4]);
      }
    }
    if (lit && lights) { const cp = F(fc, u, h + hh / 2); lights.push({ x: cp.x, y: cp.y, r: 18 * cp.s, a: 0.4, flick: 1 }); }
  }

  function door(c, fc, u, w, hh, o, lights) {
    o = o || {};
    // Каменный портал
    const pts = [F(fc, u - w / 2 - 2, 0), F(fc, u + w / 2 + 2, 0)];
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * PI; pts.push(F(fc, u + Math.cos(a) * (w / 2 + 2), hh - w / 2 + Math.sin(a) * (w / 2 + 2))); }
    poly(c, pts, o.portal || '#8a8278', OUT, 0.5);
    const dp = [F(fc, u - w / 2, 0), F(fc, u + w / 2, 0)];
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * PI; dp.push(F(fc, u + Math.cos(a) * w / 2, hh - w / 2 + Math.sin(a) * w / 2)); }
    if (o.open) {
      const top = F(fc, u, hh), bot = F(fc, u, 0);
      const g = c.createLinearGradient(0, top.y, 0, bot.y); g.addColorStop(0, '#ff8a2a'); g.addColorStop(0.5, '#c84a10'); g.addColorStop(1, '#3a1406');
      poly(c, dp, g);
      if (lights) { const cp = F(fc, u, hh * 0.4); lights.push({ x: cp.x, y: cp.y, r: 55 * cp.s, a: 0.75, flick: 2 }); }
      return;
    }
    poly(c, dp, o.wood || '#5a3820');
    c.save(); path(c, dp); c.clip();
    const n = Math.max(3, Math.round(w / 3));
    for (let i = 1; i < n; i++) { const a = F(fc, u - w / 2 + (w * i) / n, 0), b = F(fc, u - w / 2 + (w * i) / n, hh); line(c, a.x, a.y, b.x, b.y, 'rgba(20,10,4,0.55)', 0.45); }
    for (const hb of [hh * 0.25, hh * 0.65]) { const a = F(fc, u - w / 2, hb), b = F(fc, u + w / 2, hb); line(c, a.x, a.y, b.x, b.y, '#2a2a2e', 1.2 * a.s); }
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 0.5; path(c, dp); c.stroke();
    const k = F(fc, u + w * 0.28, hh * 0.45);
    circle(c, k.x, k.y, 0.9 * k.s, '#c9a040', OUT, 0.3);
    // Ступень
    const s0 = F(fc, u - w / 2 - 3, 0), s1 = F(fc, u + w / 2 + 3, 0);
    const s2 = P(u + w / 2 + 3, fc.z + 5, 0), s3 = P(u - w / 2 - 3, fc.z + 5, 0);
    if (fc.z != null) { poly(c, [s0, s1, s2, s3], '#7a746a', OUT, 0.4); }
  }

  // Двускатная крыша с черепицей (конёк вдоль X)
  function roof(c, x0, x1, z0, z1, h, rh, col, rnd, o) {
    o = o || {};
    const ov = o.ov || 6, zm = (z0 + z1) / 2;
    const xa = x0 - ov, xb = x1 + ov;
    poly(c, [P(xa, z0 - ov, h), P(xb, z0 - ov, h), P(xb, zm, h + rh), P(xa, zm, h + rh)], shade(col, 0.5), OUT, 0.5);
    // Фронтон справа
    const gfc = { x: x1 };
    c.save();
    path(c, [P(x1, z1, h), P(x1, z0, h), P(x1, zm, h + rh)]);
    c.clip();
    if (o.gable === 'plaster') { plaster(c, gfc, z0, z1, h, h + rh, shade(o.wall || '#c8b89a', 0.72), rnd); timber(c, gfc, z0, z1, h, h + rh, '#3a2618', rnd, false); }
    else planks(c, gfc, z0, z1, h, h + rh, shade(o.wood || '#6a4a2a', 0.8), rnd, 4);
    c.restore();
    poly(c, [P(x1, z1, h), P(x1, z0, h), P(x1, zm, h + rh)], null, OUT, 0.5);
    // Передний скат: ряды черепицы снизу вверх
    const rows = o.rows || 7;
    const pt = (x, v) => P(x, lerp(z1 + ov, zm, v), lerp(h, h + rh, v));
    poly(c, [pt(xa, 0), pt(xb, 0), pt(xb, 1), pt(xa, 1)], shade(col, 0.7));
    for (let r = 0; r < rows; r++) {
      const v0 = r / rows, v1 = (r + 1) / rows + 0.02;
      let x = xa - (r % 2 ? 3.5 : 0);
      while (x < xb) {
        const w = (o.thatch ? 12 : 7) * (0.85 + rnd() * 0.3);
        const ta = Math.max(xa, x), tb = Math.min(xb, x + w - 0.4);
        if (tb > ta) {
          const tc = shade(col, 0.82 + rnd() * 0.36);
          if (o.thatch) {
            poly(c, [pt(ta, v0), pt(tb, v0), pt(tb, v1), pt(ta, v1)], tc);
            c.strokeStyle = alpha('#3a2a10', 0.35); c.lineWidth = 0.3; c.beginPath();
            for (let k = 0; k < 5; k++) { const xx = lerp(ta, tb, rnd()); const a = pt(xx, v0), b = pt(xx + 0.5, v1); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
            c.stroke();
          } else {
            const a = pt(ta, v0), b = pt(tb, v0), bb = pt(tb, v1), aa = pt(ta, v1);
            c.beginPath(); c.moveTo(aa.x, aa.y); c.lineTo(bb.x, bb.y); c.lineTo(b.x, b.y);
            c.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 1.2 * a.s, a.x, a.y); c.closePath();
            c.fillStyle = tc; c.fill();
          }
        }
        x += w;
      }
      const e0 = pt(xa, v0), e1 = pt(xb, v0);
      line(c, e0.x, e0.y, e1.x, e1.y, 'rgba(0,0,0,0.45)', 0.7);
    }
    // Конёк и карниз
    const r0 = pt(xa, 1), r1 = pt(xb, 1);
    line(c, r0.x, r0.y, r1.x, r1.y, OUT, 3);
    line(c, r0.x, r0.y, r1.x, r1.y, o.ridge || shade(col, 0.6), 2);
    const f0 = pt(xa, 0), f1 = pt(xb, 0);
    line(c, f0.x, f0.y + 0.5, f1.x, f1.y + 0.5, '#2a1a10', 1.6);
    // Скат справа (торец крыши)
    poly(c, [pt(xb, 0), P(xb, z0 - ov, h), P(xb, zm, h + rh)], null, OUT, 0.5);
    line(c, P(xb, z0 - ov, h).x, P(xb, z0 - ov, h).y, pt(xb, 1).x, pt(xb, 1).y, shade(col, 0.6), 1.6);
    line(c, pt(xb, 0).x, pt(xb, 0).y, pt(xb, 1).x, pt(xb, 1).y, shade(col, 0.75), 1.8);
    return { ridge0: r0, ridge1: r1 };
  }

  function chimney(c, x, z, w, d, h0, h1, rnd) {
    const fc = { z: z + d / 2 }, sc2 = { x: x + w / 2 };
    stones(c, sc2, z - d / 2, z + d / 2, h0, h1, '#5e5852', rnd, 4, 6);
    stones(c, fc, x - w / 2, x + w / 2, h0, h1, '#7a746c', rnd, 4, 6);
    const t = [P(x - w / 2 - 1, z + d / 2 + 1, h1), P(x + w / 2 + 1, z + d / 2 + 1, h1), P(x + w / 2 + 1, z - d / 2 - 1, h1), P(x - w / 2 - 1, z - d / 2 - 1, h1)];
    poly(c, t, '#4a4642', OUT, 0.5);
    const i = [P(x - w / 2 + 1, z + d / 2 - 1, h1), P(x + w / 2 - 1, z + d / 2 - 1, h1), P(x + w / 2 - 1, z - d / 2 + 1, h1), P(x - w / 2 + 1, z - d / 2 + 1, h1)];
    poly(c, i, '#111');
  }

  function sign(c, x, z, h, icon, col) {
    const p = P(x, z, h);
    const s = p.s;
    line(c, p.x, p.y, p.x + 9 * s, p.y, '#2a2a2e', 1.2 * s);
    line(c, p.x + 3 * s, p.y, p.x + 3 * s, p.y + 2 * s, '#2a2a2e', 0.5);
    line(c, p.x + 8 * s, p.y, p.x + 8 * s, p.y + 2 * s, '#2a2a2e', 0.5);
    c.fillStyle = A.lit(c, p.x + 5.5 * s, p.y + 6 * s, 6 * s, col || '#7a5432');
    c.fillRect(p.x + 1.5 * s, p.y + 2 * s, 8 * s, 8 * s);
    c.strokeStyle = OUT; c.lineWidth = 0.5; c.strokeRect(p.x + 1.5 * s, p.y + 2 * s, 8 * s, 8 * s);
    c.save(); c.translate(p.x + 5.5 * s, p.y + 6 * s); c.scale(s, s); icon(c); c.restore();
  }
  const ICON = {
    anvil: (c) => { c.fillStyle = '#d8d0c0'; c.beginPath(); c.moveTo(-3, -1.5); c.lineTo(3, -1.5); c.lineTo(2, 0); c.lineTo(1, 0); c.lineTo(1.5, 2); c.lineTo(-1.5, 2); c.lineTo(-1, 0); c.lineTo(-3, -0.5); c.closePath(); c.fill(); },
    target: (c) => { circle(c, 0, 0, 3, '#e8dcc0'); circle(c, 0, 0, 2, '#c33'); circle(c, 0, 0, 1, '#e8dcc0'); },
    flask: (c) => { c.fillStyle = '#9aff7a'; c.beginPath(); c.moveTo(-0.7, -3); c.lineTo(0.7, -3); c.lineTo(0.7, -1); c.lineTo(2.6, 2.6); c.lineTo(-2.6, 2.6); c.lineTo(-0.7, -1); c.closePath(); c.fill(); },
    gear: (c) => { c.strokeStyle = '#d8d0c0'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 2, 0, PI * 2); c.stroke(); for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; line(c, Math.cos(a) * 2, Math.sin(a) * 2, Math.cos(a) * 3.2, Math.sin(a) * 3.2, '#d8d0c0', 1); } },
    hammer: (c) => { line(c, -2, 2.5, 1.5, -1, '#d8d0c0', 0.9); c.fillStyle = '#d8d0c0'; c.fillRect(0, -3, 3, 2); },
  };

  // Коробка с текстурами: front (z1), side (x1)
  function texBox(c, x0, x1, z0, z1, h0, h1, kind, col, rnd, o) {
    o = o || {};
    const ff = { z: z1 }, sf = { x: x1 };
    const fill = (fc, u0, u1, cc) => {
      if (kind === 'stone') stones(c, fc, u0, u1, h0, h1, cc, rnd, o.rowH || 6, o.len || 11, o.rough);
      else if (kind === 'planks') planks(c, fc, u0, u1, h0, h1, cc, rnd, o.pw || 5);
      else plaster(c, fc, u0, u1, h0, h1, cc, rnd);
    };
    fill(sf, z0, z1, shade(col, o.sideF || 0.72));
    quadFill(c, sf, z0, h0, z1, h1, null, OUT, 0.5);
    fill(ff, x0, x1, o.frontF ? shade(col, o.frontF) : col);
    quadFill(c, ff, x0, h0, x1, h1, null, OUT, 0.5);
    if (o.timber) { timber(c, ff, x0, x1, h0, h1, o.timberC || '#3a2618', rnd, true); timber(c, sf, z0, z1, h0, h1, shade(o.timberC || '#3a2618', 0.8), rnd, false); }
    if (o.top) poly(c, [P(x0, z1, h1), P(x1, z1, h1), P(x1, z0, h1), P(x0, z0, h1)], o.top, OUT, 0.5);
  }
  function eaveShadow(c, x0, x1, z1, h) {
    const fc = { z: z1 };
    quadFill(c, fc, x0, h - 9, x1, h, vg(c, fc, x0, h - 9, h, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.45)'));
  }
  function foundation(c, x0, x1, z0, z1, rnd) {
    stones(c, { x: x1 + 0.5 }, z0, z1 + 0.5, 0, 5, '#5a5650', rnd, 5, 7, true);
    stones(c, { z: z1 + 0.5 }, x0 - 0.5, x1 + 0.5, 0, 5, '#77716a', rnd, 5, 7, true);
  }

  // Цилиндр (башня алхимика)
  function cylinder(c, x, z, R, h0, h1) {
    const N = 48, bot = [], top = [];
    for (let i = 0; i < N; i++) { const a = (i / N) * PI * 2; bot.push(P(x + Math.cos(a) * R, z + Math.sin(a) * R, h0)); top.push(P(x + Math.cos(a) * R, z + Math.sin(a) * R, h1)); }
    let iL = 0, iR = 0;
    bot.forEach((p, i) => { if (p.x < bot[iL].x) iL = i; if (p.x > bot[iR].x) iR = i; });
    const arc = (arr, from, to) => { const out = []; for (let i = from; ; i = (i + 1) % N) { out.push({ p: arr[i], i }); if (i === to) break; } return out; };
    const a1 = arc(bot, iL, iR), a2 = arc(bot, iR, iL);
    const avg = (a) => a.reduce((s, q) => s + q.p.y, 0) / a.length;
    const front = avg(a1) > avg(a2) ? a1 : a2;
    const frontIdx = front.map((q) => q.i);
    const backTop = (front === a1 ? arc(top, iR, iL) : arc(top, iL, iR));
    const body = front.map((q) => q.p).concat(front === a1 ? backTop.map((q) => q.p) : backTop.map((q) => q.p));
    return { body, frontIdx, N, top, bot, iL, iR };
  }

  // ---------- Здания ----------
  const PAINT = {
    townhall(c, b, tier, rnd, L) {
      const { x, z, w, d, h } = b.pos;
      const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
      const f1 = 30;
      foundation(c, x0, x1, z0, z1, rnd);
      texBox(c, x0, x1, z0, z1, 0, f1, 'stone', '#8e877c', rnd, { rowH: 6, len: 12 });
      texBox(c, x0, x1, z0, z1, f1, h, 'plaster', '#d6c8a8', rnd, { timber: true, timberC: '#3e2a1a' });
      const ff = { z: z1 }, sf = { x: x1 };
      beamF(c, ff, x0 - 1, f1, x1 + 1, f1, 3.2, '#4a3220');
      eaveShadow(c, x0, x1, z1, h);
      door(c, ff, x + 22, 16, 24, { wood: '#4a2c18' }, L);
      for (const u of [x0 + 14, x0 + 34]) windowW(c, ff, u, 9, 7, 11, { shutter: '#2c4a7a', arch: true }, L);
      for (const u of [x0 + 14, x0 + 40, x1 - 34, x1 - 12]) windowW(c, ff, u, f1 + 13, 7, 13, { shutter: '#2c4a7a', flowers: true }, L);
      for (const u of [z0 + 22, z1 - 22]) windowW(c, sf, u, f1 + 13, 7, 12, { shutter: '#22406a' }, L);
      windowW(c, sf, z, 10, 6, 10, { shutters: false, arch: true }, L);
      if (tier >= 1) {
        for (const u of [x0 + 26, x1 - 22]) {
          const pts = [F(ff, u - 4, h - 6), F(ff, u + 4, h - 6), F(ff, u + 4, h - 26), F(ff, u, h - 30), F(ff, u - 4, h - 26)];
          poly(c, pts, '#2c4a8a', OUT, 0.5);
          const m = F(ff, u, h - 16); c.fillStyle = '#e8c060'; c.font = `bold ${7 * m.s}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('♜', m.x, m.y);
        }
      }
      chimney(c, x0 + 16, z0 + 14, 8, 8, h, h + 52, rnd);
      roof(c, x0, x1, z0, z1, h, h * 0.55 + 10, '#41588e', rnd, { gable: 'plaster', wall: '#d6c8a8', ridge: tier >= 2 ? '#e8c060' : null });
      // Башня с часами
      const tw = 34, tx0 = x - 10 - tw / 2, tx1 = x - 10 + tw / 2, tz0 = z - tw / 2, tz1 = z + tw / 2, th = h + 70;
      texBox(c, tx0, tx1, tz0, tz1, h - 10, th, 'stone', '#9a9284', rnd, { rowH: 6, len: 10 });
      const tf = { z: tz1 };
      windowW(c, tf, x - 10, th - 34, 7, 14, { shutters: false, arch: true }, L);
      windowW(c, { x: tx1 }, z, th - 34, 6, 12, { shutters: false, arch: true }, L);
      // Карниз башни
      poly(c, [P(tx0 - 2, tz1 + 2, th), P(tx1 + 2, tz1 + 2, th), P(tx1 + 2, tz0 - 2, th), P(tx0 - 2, tz0 - 2, th)], '#6a6258', OUT, 0.5);
      const ap = P(x - 10, z, th + 40);
      const a = P(tx0 - 3, tz1 + 3, th), bb = P(tx1 + 3, tz1 + 3, th), e = P(tx1 + 3, tz0 - 3, th);
      poly(c, [bb, e, ap], shade('#41588e', 0.62), OUT, 0.5);
      poly(c, [a, bb, ap], '#41588e', OUT, 0.5);
      c.save(); path(c, [a, bb, ap]); c.clip();
      for (let i = 1; i < 8; i++) { const t = i / 8; const p0 = { x: lerp(a.x, ap.x, t), y: lerp(a.y, ap.y, t) }, p1 = { x: lerp(bb.x, ap.x, t), y: lerp(bb.y, ap.y, t) }; line(c, p0.x, p0.y, p1.x, p1.y, 'rgba(0,0,0,0.35)', 0.6); }
      c.restore();
      line(c, ap.x, ap.y, ap.x, ap.y - 12, tier >= 2 ? '#e8c060' : '#3a3a40', 1.2);
      circle(c, ap.x, ap.y - 12, 1.6, tier >= 2 ? '#ffe08a' : '#8a8a92', OUT, 0.4);
      // Циферблат
      const cp = F(tf, x - 10, th - 14);
      circle(c, cp.x, cp.y, 7.5 * cp.s, '#3a3a40');
      circle(c, cp.x, cp.y, 6.5 * cp.s, '#efe4c0', OUT, 0.5);
      for (let i = 0; i < 12; i++) { const an = (i / 12) * PI * 2; circle(c, cp.x + Math.cos(an) * 5.3 * cp.s, cp.y + Math.sin(an) * 5.3 * cp.s, 0.45 * cp.s, '#3a3a40'); }
      // Фонари у входа
      for (const u of [x + 11, x + 33]) { const p = F(ff, u, 20); c.fillStyle = '#2a2a2e'; c.fillRect(p.x - 1.6, p.y - 3, 3.2, 4); c.fillStyle = '#ffd27a'; c.fillRect(p.x - 1, p.y - 2.4, 2, 2.8); L.push({ x: p.x, y: p.y - 1, r: 16, a: 0.5, flick: 1 }); }
      return { clock: cp, flag: { x: ap.x, y: ap.y - 12 }, smoke: P(x0 + 16, z0 + 14, h + 54) };
    },

    forge(c, b, tier, rnd, L) {
      const { x, z, w, d, h } = b.pos;
      const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
      foundation(c, x0, x1, z0, z1, rnd);
      texBox(c, x0, x1, z0, z1, 0, h, 'stone', '#7a7268', rnd, { rowH: 5.5, len: 9, rough: true });
      const ff = { z: z1 }, sf = { x: x1 };
      eaveShadow(c, x0, x1, z1, h);
      // Открытый горн
      door(c, ff, x + 18, 26, 26, { open: true, portal: '#5a544c' }, L);
      // Наковальня и угли внутри
      const hp = F(ff, x + 18, 2);
      c.fillStyle = '#1a1416'; c.fillRect(hp.x - 7, hp.y - 7, 14, 4);
      windowW(c, ff, x0 + 18, 18, 7, 10, { shutter: '#3a2a1a' }, L);
      windowW(c, sf, z, 18, 7, 10, { shutter: '#3a2a1a' }, L);
      roof(c, x0, x1, z0, z1, h, h * 0.55 + 10, '#3e3a3c', rnd, { wood: '#4a3a2a' });
      chimney(c, x - 20, z, 14, 14, h - 6, h + 44, rnd);
      sign(c, x1 + 1, z1 - 4, h - 10, ICON.anvil, '#4a3a2a');
      // Наковальня снаружи, бочка, уголь
      const ap = P(x1 + 14, z1 + 10, 0);
      c.fillStyle = '#3a2a1a'; c.fillRect(ap.x - 3 * ap.s, ap.y - 7 * ap.s, 6 * ap.s, 7 * ap.s);
      c.beginPath(); const s = ap.s;
      c.moveTo(ap.x - 9 * s, ap.y - 12 * s); c.lineTo(ap.x + 8 * s, ap.y - 12 * s); c.lineTo(ap.x + 5 * s, ap.y - 9 * s); c.lineTo(ap.x + 2.5 * s, ap.y - 9 * s); c.lineTo(ap.x + 3 * s, ap.y - 7 * s); c.lineTo(ap.x - 3 * s, ap.y - 7 * s); c.lineTo(ap.x - 2.5 * s, ap.y - 9 * s); c.lineTo(ap.x - 6 * s, ap.y - 10 * s); c.closePath();
      c.fillStyle = A.lit(c, ap.x, ap.y - 10 * s, 8 * s, '#4a4a52'); c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.5; c.stroke();
      const br = P(x1 + 6, z1 - 6, 0);
      ellipse(c, br.x, br.y - 9 * br.s, 5 * br.s, 2 * br.s, 0, '#2a4a5a');
      c.fillStyle = A.lit(c, br.x, br.y - 5, 6, '#6a4a2a'); c.fillRect(br.x - 5 * br.s, br.y - 9 * br.s, 10 * br.s, 9 * br.s); c.strokeStyle = OUT; c.strokeRect(br.x - 5 * br.s, br.y - 9 * br.s, 10 * br.s, 9 * br.s);
      line(c, br.x - 5 * br.s, br.y - 6 * br.s, br.x + 5 * br.s, br.y - 6 * br.s, '#2a2a2e', 0.8);
      line(c, br.x - 5 * br.s, br.y - 2.5 * br.s, br.x + 5 * br.s, br.y - 2.5 * br.s, '#2a2a2e', 0.8);
      ellipse(c, br.x, br.y - 9 * br.s, 4.2 * br.s, 1.5 * br.s, 0, '#3a6a7a');
      for (let i = 0; i < 9; i++) { const p = P(x0 + 6 + rnd() * 10, z1 + 6 + rnd() * 6, 0); circle(c, p.x, p.y - 1.5, 1.5 + rnd(), '#1a1a1e'); }
      return { smith: P(x1 + 26, z1 + 10, 0), anvil: ap, smoke: P(x - 20, z, h + 46) };
    },

    range(c, b, tier, rnd, L) {
      const { x, z, w, d, h } = b.pos;
      const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
      foundation(c, x0, x1, z0, z1, rnd);
      texBox(c, x0, x1, z0, z1, 0, h, 'planks', '#7a5434', rnd, { pw: 4.5 });
      const ff = { z: z1 }, sf = { x: x1 };
      beamF(c, ff, x0, 2, x1, 2, 2.4, '#4a3220'); beamF(c, ff, x0, h - 1.5, x1, h - 1.5, 2.4, '#4a3220');
      eaveShadow(c, x0, x1, z1, h);
      door(c, ff, x - 26, 14, 24, { wood: '#4a2c18', portal: '#5a3e24' }, L);
      windowW(c, ff, x + 10, 15, 8, 10, { shutter: '#6a2a1a' }, L);
      windowW(c, sf, z, 15, 7, 10, { shutter: '#5a2418' }, L);
      // Стойка с луками на стене
      const r0 = F(ff, x + 26, 8), r1 = F(ff, x + 44, 8);
      line(c, r0.x, r0.y - 14, r1.x, r1.y - 14, '#4a3220', 1.4);
      for (let i = 0; i < 3; i++) {
        const p = F(ff, x + 29 + i * 6, 10);
        c.strokeStyle = '#8a5a2b'; c.lineWidth = 1.1; c.beginPath(); c.arc(p.x + 3, p.y - 7, 8 * p.s, PI * 0.62, PI * 1.38); c.stroke();
        line(c, p.x - 3.2, p.y - 13.5, p.x - 3.2, p.y - 0.5, '#e8e0c8', 0.35);
      }
      roof(c, x0, x1, z0, z1, h, h * 0.55 + 12, '#a8884a', rnd, { thatch: true, rows: 5, ridge: '#6a5228' });
      sign(c, x1 + 1, z1 - 6, h - 8, ICON.target, '#5a3a20');
      // Мишени и сено
      for (let i = 0; i < 2; i++) {
        const p = P(x1 + 22, z0 + 8 + i * 28, 0), s = p.s;
        line(c, p.x - 4 * s, p.y, p.x, p.y - 18 * s, '#4a3220', 1.4 * s); line(c, p.x + 4 * s, p.y, p.x, p.y - 18 * s, '#4a3220', 1.4 * s);
        for (const [r, col] of [[9, '#e8dcc0'], [7.2, '#c33'], [5.2, '#e8dcc0'], [3.4, '#c33'], [1.6, '#f0c040']]) circle(c, p.x, p.y - 22 * s, r * s, col);
        circle(c, p.x, p.y - 22 * s, 9 * s, null, OUT, 0.6);
        for (let k = 0; k < 3; k++) { const ax = p.x + (rnd() - 0.5) * 8 * s, ay = p.y - 22 * s + (rnd() - 0.5) * 8 * s; line(c, ax, ay, ax - 6 * s, ay - 3 * s, '#5a4028', 0.6); c.fillStyle = '#eee'; c.fillRect(ax - 7 * s, ay - 4 * s, 2 * s, 1.5 * s); }
      }
      for (let i = 0; i < 3; i++) {
        const q = P(x1 + 6 + i * 9, z1 + 10 + (i % 2) * 6, 0), s = q.s;
        c.fillStyle = A.lit(c, q.x, q.y - 6 * s, 8 * s, '#b49448'); c.fillRect(q.x - 6 * s, q.y - 9 * s, 12 * s, 9 * s);
        c.strokeStyle = '#7a6230'; c.lineWidth = 0.5; c.strokeRect(q.x - 6 * s, q.y - 9 * s, 12 * s, 9 * s);
        line(c, q.x - 6 * s, q.y - 4.5 * s, q.x + 6 * s, q.y - 4.5 * s, '#6a4a20', 0.6);
      }
      return { smoke: null };
    },

    workshop(c, b, tier, rnd, L) {
      const { x, z, w, d, h } = b.pos;
      const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
      foundation(c, x0, x1, z0, z1, rnd);
      texBox(c, x0, x1, z0, z1, 0, h, 'plaster', '#cbb894', rnd, { timber: true, timberC: '#4a2e18' });
      const ff = { z: z1 }, sf = { x: x1 };
      eaveShadow(c, x0, x1, z1, h);
      // Двустворчатые ворота
      const gw = 26, gh = 30;
      quadFill(c, ff, x - 18 - gw / 2 - 1.5, 0, x - 18 + gw / 2 + 1.5, gh + 1.5, '#3a2618', OUT, 0.5);
      planks(c, ff, x - 18 - gw / 2, x - 18 + gw / 2, 0, gh, '#6a4426', rnd, 3.2);
      for (const s of [-1, 1]) { const a = F(ff, x - 18 - gw / 2 * s, 0), bq = F(ff, x - 18, gh); line(c, a.x, a.y, bq.x, bq.y, '#3a2618', 1.6); }
      const m0 = F(ff, x - 18, 0), m1 = F(ff, x - 18, gh); line(c, m0.x, m0.y, m1.x, m1.y, '#2a1a10', 1);
      windowW(c, ff, x + 16, 16, 8, 11, { shutter: '#5a4a2a' }, L);
      windowW(c, ff, x + 36, 16, 8, 11, { shutter: '#5a4a2a' }, L);
      windowW(c, sf, z, 16, 7, 10, { shutter: '#4a3a20' }, L);
      roof(c, x0, x1, z0, z1, h, h * 0.55 + 10, '#7a4a2a', rnd, { gable: 'plaster', wall: '#cbb894' });
      sign(c, x1 + 1, z1 - 4, h - 10, ICON.gear, '#5a3a20');
      // Кран с грузом
      const cb = P(x1 + 4, z0 + 10, h + 4), ce = P(x1 + 30, z0 + 10, h + 4);
      line(c, cb.x, cb.y, ce.x, ce.y, OUT, 3.4); line(c, cb.x, cb.y, ce.x, ce.y, '#6a4a2a', 2.4);
      line(c, ce.x - 2, ce.y, ce.x - 2, ce.y + 22, '#c8b48a', 0.6);
      c.fillStyle = A.lit(c, ce.x - 2, ce.y + 26, 5, '#8a6a3a'); c.fillRect(ce.x - 6, ce.y + 22, 8, 7); c.strokeStyle = OUT; c.lineWidth = 0.5; c.strokeRect(ce.x - 6, ce.y + 22, 8, 7);
      line(c, ce.x - 6, ce.y + 22, ce.x + 2, ce.y + 29, '#4a3220', 0.5);
      // Брёвна
      for (let i = 0; i < 5; i++) {
        const q = P(x1 + 8 + (i % 3) * 0.5, z1 + 4 - i * 0 + Math.floor(i / 3) * 0, 3.5 + (i < 3 ? 0 : 6.5));
        const off = (i % 3) * 6.5 + (i >= 3 ? 3.2 : 0);
        const s = q.s;
        c.fillStyle = A.lit(c, q.x + 14 * s, q.y - off * s * 0.2, 6 * s, '#7a5432');
        const yy = q.y + (i % 3) * 0 - (i >= 3 ? 0 : 0);
        c.fillRect(q.x, yy - 3.2 * s - off * 0.0, 30 * s, 6.4 * s);
        circle(c, q.x + 30 * s, yy, 3.2 * s, '#c09868', OUT, 0.4);
        c.strokeStyle = '#8a6a40'; c.lineWidth = 0.3; c.beginPath(); c.arc(q.x + 30 * s, yy, 1.8 * s, 0, PI * 2); c.stroke();
        c.translate(0, 0);
        if (i === 2) break;
      }
      // Ящики
      for (const [dx, dz, hh] of [[-4, 12, 0], [8, 14, 0], [2, 13, 9]]) {
        const bx = x0 + 6 + dx, bz = z1 + dz;
        texBox(c, bx, bx + 10, bz - 8, bz, hh, hh + 9, 'planks', '#9a7448', rnd, { pw: 3.3, top: '#a8845a' });
      }
      return { gear: F(ff, x1 - 16, h * 0.62), smoke: null };
    },

    masonry(c, b, tier, rnd, L) {
      const { x, z, w, d, h } = b.pos;
      const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
      texBox(c, x0, x1, z0, z1, 0, h, 'stone', '#a39d92', rnd, { rowH: 7, len: 14 });
      const ff = { z: z1 }, sf = { x: x1 };
      eaveShadow(c, x0, x1, z1, h);
      door(c, ff, x - 18, 15, 25, { wood: '#5a3a22', portal: '#6a645a' }, L);
      windowW(c, ff, x + 16, 15, 8, 12, { shutter: '#3a4a5a', arch: true }, L);
      windowW(c, sf, z, 15, 7, 11, { shutter: '#2e3c4a' }, L);
      roof(c, x0, x1, z0, z1, h, h * 0.55 + 10, '#5c606c', rnd, { wood: '#5a4a3a' });
      sign(c, x1 + 1, z1 - 4, h - 10, ICON.hammer, '#5a5a62');
      // Каменные блоки
      const blocks = [[6, 4, 0], [18, 4, 0], [6, 14, 0], [12, 8, 9], [30, 6, 0]];
      for (const [dx, dz, hh] of blocks) {
        const bx = x1 + dx, bz = z1 - 20 + dz;
        texBox(c, bx, bx + 11, bz - 9, bz, hh, hh + 9, 'stone', '#b0aaa0', rnd, { rowH: 9, len: 11, top: '#c8c2b8' });
      }
      // Недоделанная статуя
      const sp = P(x1 + 30, z1 + 10, 0), s = sp.s;
      texBox(c, x1 + 25, x1 + 35, z1 + 5, z1 + 14, 0, 7, 'stone', '#9a948a', rnd, { rowH: 7, len: 10, top: '#b0aaa0' });
      const g = c.createLinearGradient(sp.x - 5 * s, 0, sp.x + 5 * s, 0); g.addColorStop(0, '#d8d2c6'); g.addColorStop(1, '#8a857c');
      c.fillStyle = g; c.beginPath(); c.moveTo(sp.x - 4 * s, sp.y - 7 * s); c.lineTo(sp.x - 3 * s, sp.y - 20 * s); c.arc(sp.x, sp.y - 23 * s, 3 * s, PI, 0); c.lineTo(sp.x + 4 * s, sp.y - 7 * s); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.5; c.stroke();
      return { smoke: null };
    },

    alchemy(c, b, tier, rnd, L) {
      const { x, z, w, h } = b.pos;
      const R = w / 2;
      const cy = cylinder(c, x, z, R, 0, h);
      // Тело башни с кладкой
      c.save();
      path(c, cy.body);
      const g = c.createLinearGradient(P(x - R, z, 0).x, 0, P(x + R, z, 0).x, 0);
      g.addColorStop(0, '#7a7488'); g.addColorStop(0.55, '#5e576e'); g.addColorStop(1, '#2e2a38');
      c.fillStyle = g; c.fill();
      c.clip();
      const rows = Math.floor(h / 6);
      for (let r = 0; r < rows; r++) {
        const h0 = r * 6, h1 = h0 + 6;
        const off = r % 2 ? 0.5 : 0;
        for (let k = 0; k < 24; k++) {
          const a0 = ((k + off) / 24) * PI * 2, a1 = ((k + off + 0.92) / 24) * PI * 2;
          const mA = (a0 + a1) / 2;
          if (Math.sin(mA) < -0.35) continue;
          const lightK = 0.55 + 0.45 * Math.max(0, Math.cos(mA - 0.6));
          const pts = [];
          for (let t = 0; t <= 3; t++) { const a = lerp(a0, a1, t / 3); pts.push(P(x + Math.cos(a) * R, z + Math.sin(a) * R, h0 + 0.4)); }
          for (let t = 3; t >= 0; t--) { const a = lerp(a0, a1, t / 3); pts.push(P(x + Math.cos(a) * R, z + Math.sin(a) * R, h1 - 0.4)); }
          poly(c, pts, shade('#6e6880', (0.75 + rnd() * 0.3) * (0.7 + lightK * 0.5)));
        }
      }
      c.restore();
      c.strokeStyle = OUT; c.lineWidth = 0.6; path(c, cy.body); c.stroke();
      // Окна и дверь на цилиндре
      const onCyl = (a, hh) => P(x + Math.cos(a) * R, z + Math.sin(a) * R, hh);
      const winC = (a, hh, ww, wh) => {
        const pts = [];
        const da = ww / R / 2;
        pts.push(onCyl(a - da, hh), onCyl(a + da, hh));
        for (let i = 0; i <= 6; i++) { const t = i / 6; const aa = lerp(a + da, a - da, t); pts.push(onCyl(aa, hh + wh - ww / 2 + Math.sin(t * PI) * ww / 2)); }
        poly(c, pts, '#2a2232', OUT, 0.6);
        const inner = pts.map((p) => ({ x: p.x, y: p.y }));
        const cx2 = inner.reduce((s, p) => s + p.x, 0) / inner.length, cy2 = inner.reduce((s, p) => s + p.y, 0) / inner.length;
        const scl = inner.map((p) => ({ x: cx2 + (p.x - cx2) * 0.75, y: cy2 + (p.y - cy2) * 0.8 }));
        const gg = c.createLinearGradient(0, cy2 - 8, 0, cy2 + 8); gg.addColorStop(0, '#d6ffb0'); gg.addColorStop(1, '#5adf5a');
        poly(c, scl, gg);
        line(c, cx2, scl[2].y, cx2, scl[0].y, '#2a2232', 0.6);
        L.push({ x: cx2, y: cy2, r: 22, a: 0.45, flick: 1, green: 1 });
      };
      winC(PI * 0.35, h * 0.5, 7, 12);
      winC(PI * 0.75, h * 0.62, 6, 11);
      winC(PI * 0.12, h * 0.25, 6, 10);
      // Дверь
      const da = 8 / R / 2, a = PI * 0.55;
      const dp = [onCyl(a - da, 0), onCyl(a + da, 0)];
      for (let i = 0; i <= 8; i++) { const t = i / 8; dp.push(onCyl(lerp(a + da, a - da, t), 16 + Math.sin(t * PI) * 4)); }
      poly(c, dp, '#3a2440', OUT, 0.6);
      // Карниз
      poly(c, cy.top, '#4a4458', OUT, 0.5);
      // Коническая крыша с черепицей
      const RR = R + 6;
      const apex = P(x, z, h + 50);
      const cone = cylinder(c, x, z, RR, h - 2, h - 2);
      const ring = [];
      for (const i of cone.frontIdx) ring.push(cone.bot[i]);
      poly(c, ring.concat([apex]), '#4a2a62');
      c.save(); path(c, ring.concat([apex])); c.clip();
      for (let r = 0; r < 8; r++) {
        const t0 = r / 8, t1 = (r + 1) / 8;
        for (let k = 0; k < ring.length - 1; k++) {
          const p0 = ring[k], p1 = ring[k + 1];
          const q = (p, t) => ({ x: lerp(p.x, apex.x, t), y: lerp(p.y, apex.y, t) });
          const lk = 0.6 + 0.5 * (k / ring.length);
          poly(c, [q(p0, t0), q(p1, t0), q(p1, t1 + 0.02), q(p0, t1 + 0.02)], shade('#5b3a7a', (0.7 + rnd() * 0.3) * lk));
        }
        const e0 = { x: lerp(ring[0].x, apex.x, t0), y: lerp(ring[0].y, apex.y, t0) };
        c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(e0.x, e0.y);
        for (const p of ring) c.lineTo(lerp(p.x, apex.x, t0), lerp(p.y, apex.y, t0));
        c.stroke();
      }
      c.restore();
      c.strokeStyle = OUT; c.lineWidth = 0.6; path(c, ring.concat([apex])); c.stroke();
      line(c, apex.x, apex.y, apex.x, apex.y - 10, tier >= 2 ? '#e8c060' : '#3a3a40', 1.2);
      // Полка с колбами
      const sh = P(x + R + 2, z + 26, 0);
      const s = sh.s;
      c.fillStyle = '#4a3220'; c.fillRect(sh.x - 6 * s, sh.y - 14 * s, 14 * s, 1.5 * s); c.fillRect(sh.x - 6 * s, sh.y - 7 * s, 14 * s, 1.5 * s);
      const cols = ['#7dff6a', '#ff5ad2', '#5ad2ff', '#ffd25a', '#b07aff', '#7dff6a'];
      for (let i = 0; i < 6; i++) {
        const bx = sh.x - 4.5 * s + (i % 3) * 4.5 * s, by = sh.y - (i < 3 ? 14 : 7) * s;
        c.fillStyle = cols[i]; c.beginPath(); c.arc(bx, by - 1.6 * s, 1.6 * s, 0, PI * 2); c.fill();
        c.fillRect(bx - 0.5 * s, by - 4.5 * s, 1 * s, 2 * s);
      }
      sign(c, x + R * 0.6, z + R * 0.7, h * 0.45, ICON.flask, '#3a2440');
      return { cauldron: P(x + R + 16, z + b.pos.d / 2 + 6, 0), apex: { x: apex.x, y: apex.y - 10 } };
    },
  };

  // ---------- Кеш спрайтов зданий ----------
  const Bld = {
    tier(l) { return l >= 8 ? 2 : l >= 4 ? 1 : 0; },
    bbox(b) {
      const { x, z, w, d, h } = b.pos;
      const pts = [];
      for (const xx of [x - w / 2 - 22, x + w / 2 + 60]) for (const zz of [z - d / 2 - 20, z + d / 2 + 34]) for (const hh of [0, h + 140]) pts.push(P(xx, zz, hh));
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
      return { x0: Math.floor(x0), y0: Math.floor(y0), x1: Math.ceil(x1), y1: Math.ceil(y1) };
    },
    // Рисует здание в контекст (логические координаты), возвращает метаданные
    paint(c, b, lvl) {
      const L = [];
      c.save(); c.lineJoin = 'round';
      const meta = PAINT[b.id](c, b, Bld.tier(lvl), seeded(b.id.length * 97 + b.pos.x), L);
      c.restore();
      meta.lights = L;
      return meta;
    },
    sprite(b, lvl, k) {
      const bb = Bld.bbox(b);
      const cv = document.createElement('canvas');
      cv.width = Math.ceil((bb.x1 - bb.x0) * k); cv.height = Math.ceil((bb.y1 - bb.y0) * k);
      const c = cv.getContext('2d');
      c.setTransform(k, 0, 0, k, -bb.x0 * k, -bb.y0 * k);
      const meta = Bld.paint(c, b, lvl);
      return { img: cv, bb, meta };
    },
  };
  Bld._tex = { F, quad, quadFill, vg, plaster, stones, planks, beamF, timber, windowW, door, texBox };
  TD.Bld = Bld;
})();
(function () {
  // Экспорт текстурных инструментов для стены
  const TD = globalThis.TD;
  TD.Bld.tex = TD.Bld._tex;
})();
