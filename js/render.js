/* Последний Бастион — 2.5D-отрисовка на Canvas */
(function () {
  const TD = globalThis.TD;
  const W = TD.WORLD;
  const LW = 1280, LH = 720;
  const ZK = (W.GY1 - W.GY0) / W.Z_MAX;
  const PI = Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);

  const sc = (z) => W.S0 + (W.S1 - W.S0) * (z / W.Z_MAX);
  function P(x, z, h) {
    const s = sc(z);
    return { x: W.VPX + (x + W.XOFF - W.VPX) * s + (W.Z_MAX / 2 - z) * W.SHEAR, y: W.GY0 + ZK * z - (h || 0) * s, s };
  }
  TD.P = P;

  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  const shadeCache = {};
  function shade(hex, f) {
    const key = hex + f;
    if (shadeCache[key]) return shadeCache[key];
    let r, g, b;
    if (hex[0] === '#') {
      const n = parseInt(hex.slice(1), 16);
      r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
    } else {
      const m = hex.match(/\d+(\.\d+)?/g) || [128, 128, 128];
      r = +m[0]; g = +m[1]; b = +m[2];
    }
    if (f < 1) { r *= f; g *= f; b *= f; } else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
    return (shadeCache[key] = `rgb(${r | 0},${g | 0},${b | 0})`);
  }

  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }

  function line(ctx, x1, y1, x2, y2, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function circle(ctx, x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, PI * 2); ctx.fillStyle = fill; ctx.fill();
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

  // Палитры зомби
  const PAL = {
    walker: { skin: '#7d9a6a', shirt: '#5b4a3a', pants: '#36374a', eye: '#ff5a3c' },
    runner: { skin: '#a6b38c', shirt: '#6e2f2f', pants: '#2f3b4a', eye: '#ffdf5a' },
    brute: { skin: '#6b7d55', shirt: '#6b7d55', pants: '#4a3a2a', eye: '#ff3a2a' },
    exploder: { skin: '#94b04e', shirt: '#4f5a2a', pants: '#3c3a30', eye: '#d6ff5a' },
    spitter: { skin: '#8d7da6', shirt: '#3b2f4c', pants: '#2a2a35', eye: '#b6ff4a' },
    elite: { skin: '#5d6b48', shirt: '#4b4f57', pants: '#2e2a26', eye: '#ff2020' },
    butcher: { skin: '#b9938a', shirt: '#d8d2c4', pants: '#3d3029', eye: '#ff2a2a' },
    necro: { skin: '#cfd6c2', shirt: '#2a1f3a', pants: '#1c1428', eye: '#7dff6a' },
    colossus: { skin: '#77767e', shirt: '#5c5b63', pants: '#4a4950', eye: '#ff9a2a' },
    titan: { skin: '#7c8f3e', shirt: '#5e6d2c', pants: '#3f4a22', eye: '#e0ff40' },
    lich: { skin: '#c5d0e0', shirt: '#1c2340', pants: '#121830', eye: '#5ad2ff' },
  };

  class Renderer {
    constructor(canvas, game) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.game = game;
      this.time = 0;
      this.hits = [];
      this.hover = null;
      this.selected = null;
      this.banner = null;
      this.flashUp = {};
      this.ambT = 0;
      this.glowFire = makeGlow(255, 150, 50, 64);
      this.glowGreen = makeGlow(150, 255, 90, 48);
      this.glowBlue = makeGlow(90, 180, 255, 64);
      this.glowWhite = makeGlow(255, 240, 210, 48);
      this.glowPurple = makeGlow(190, 90, 255, 48);
      this.clouds = [];
      const r = seeded(7);
      for (let i = 0; i < 7; i++) this.clouds.push({ x: r() * 1500 - 100, y: 40 + r() * 170, w: 160 + r() * 260, sp: 4 + r() * 8, a: 0.12 + r() * 0.15 });
      this.resize();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = Math.max(1, Math.round(rect.width * dpr)), ch = Math.max(1, Math.round(rect.height * dpr));
      if (this.canvas.width !== cw) this.canvas.width = cw;
      if (this.canvas.height !== ch) this.canvas.height = ch;
      this.dpr = dpr;
      this.scale = Math.min(rect.width / LW, rect.height / LH);
      this.ox = (rect.width - LW * this.scale) / 2;
      this.oy = (rect.height - LH * this.scale) / 2;
      this.k = this.scale * dpr;
      this.bg = this.layer((c) => this.drawBackground(c));
      this.fog = this.layer((c) => this.drawFogOverlay(c));
      this.wallKey = null;
    }

    layer(fn) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(LW * this.k));
      c.height = Math.max(1, Math.round(LH * this.k));
      const x = c.getContext('2d');
      x.setTransform(this.k, 0, 0, this.k, 0, 0);
      fn(x);
      return c;
    }

    toLogical(clientX, clientY) {
      const r = this.canvas.getBoundingClientRect();
      return { x: (clientX - r.left - this.ox) / this.scale, y: (clientY - r.top - this.oy) / this.scale };
    }

    hitTest(x, y) {
      for (let i = this.hits.length - 1; i >= 0; i--) {
        const h = this.hits[i];
        if (h.poly) { if (pointInPoly(x, y, h.poly)) return h.id; }
        else if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h.id;
      }
      return null;
    }

    showBanner(title, sub, color) { this.banner = { title, sub, color: color || '#ffe9b0', t: 0 }; }

    // ================= Статичный фон =================
    drawBackground(c) {
      const r = seeded(42);
      // Небо
      const sky = c.createLinearGradient(0, 0, 0, W.GY0 + 20);
      sky.addColorStop(0, '#070a1c');
      sky.addColorStop(0.45, '#1c1840');
      sky.addColorStop(0.78, '#5b2a4e');
      sky.addColorStop(1, '#b4524a');
      c.fillStyle = sky;
      c.fillRect(0, 0, LW, W.GY0 + 30);
      // Звёзды
      for (let i = 0; i < 160; i++) {
        const y = r() * 230;
        c.globalAlpha = (0.3 + r() * 0.7) * (1 - y / 260);
        c.fillStyle = '#fff';
        c.fillRect(r() * LW, y, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1);
      }
      c.globalAlpha = 1;
      // Луна
      const mx = 1010, my = 95;
      const mg = c.createRadialGradient(mx, my, 10, mx, my, 140);
      mg.addColorStop(0, 'rgba(255,230,200,0.35)');
      mg.addColorStop(1, 'rgba(255,230,200,0)');
      c.fillStyle = mg; c.fillRect(mx - 150, my - 150, 300, 300);
      circle(c, mx, my, 34, '#f4e6c8');
      circle(c, mx - 10, my - 6, 7, 'rgba(180,160,130,0.35)');
      circle(c, mx + 12, my + 10, 5, 'rgba(180,160,130,0.3)');
      circle(c, mx + 6, my - 14, 4, 'rgba(180,160,130,0.25)');
      // Горы
      const ridge = (base, amp, color, seed, step) => {
        const rr = seeded(seed);
        c.beginPath(); c.moveTo(0, W.GY0 + 5);
        let y = base;
        for (let x = 0; x <= LW + step; x += step) {
          y = clamp(y + (rr() - 0.5) * amp, base - amp * 1.6, base + amp * 0.8);
          c.lineTo(x, y);
        }
        c.lineTo(LW, W.GY0 + 5); c.closePath();
        c.fillStyle = color; c.fill();
      };
      ridge(230, 38, '#2b2142', 3, 40);
      ridge(262, 26, '#21193a', 9, 28);
      // Туман на горизонте
      const hz = c.createLinearGradient(0, 250, 0, W.GY0 + 10);
      hz.addColorStop(0, 'rgba(170,80,90,0)');
      hz.addColorStop(1, 'rgba(120,60,80,0.55)');
      c.fillStyle = hz; c.fillRect(0, 250, LW, W.GY0 - 240);
      // Лес на горизонте
      const tr = seeded(11);
      for (let x = -10; x < LW + 10; x += 6 + tr() * 8) {
        const h = 14 + tr() * 22;
        const y = W.GY0 + 4;
        c.fillStyle = tr() < 0.5 ? '#150f22' : '#1a1428';
        c.beginPath(); c.moveTo(x - h * 0.3, y); c.lineTo(x, y - h); c.lineTo(x + h * 0.3, y); c.fill();
      }
      // Земля
      const g = c.createLinearGradient(0, W.GY0, 0, LH);
      g.addColorStop(0, '#2b2a2c');
      g.addColorStop(0.3, '#33362b');
      g.addColorStop(1, '#2c3424');
      c.fillStyle = g;
      c.fillRect(0, W.GY0, LW, LH - W.GY0);
      // Поле: грязь, трава, камни
      for (let i = 0; i < 90; i++) {
        const x = W.WALL_FRONT + 20 + r() * 900, z = r() * 400;
        const p = P(x, z, 0);
        c.fillStyle = r() < 0.5 ? 'rgba(70,58,44,0.35)' : 'rgba(40,52,32,0.35)';
        c.beginPath(); c.ellipse(p.x, p.y, (20 + r() * 50) * p.s, (8 + r() * 18) * p.s, 0, 0, PI * 2); c.fill();
      }
      // Протоптанная дорога к воротам
      c.fillStyle = 'rgba(80,66,50,0.45)';
      c.beginPath();
      const road = [P(W.WALL_FRONT, 170, 0), P(1400, 140, 0), P(1400, 260, 0), P(W.WALL_FRONT, 230, 0)];
      c.moveTo(road[0].x, road[0].y); for (const q of road) c.lineTo(q.x, q.y); c.fill();
      for (let i = 0; i < 520; i++) {
        const x = -200 + r() * 1700, z = r() * 400;
        const p = P(x, z, 0);
        if (x > W.WALL_BACK - 10 && x < W.WALL_FRONT + 10) continue;
        const t = r();
        if (t < 0.6) {
          c.strokeStyle = r() < 0.5 ? 'rgba(90,110,60,0.6)' : 'rgba(60,80,45,0.6)';
          c.lineWidth = 1;
          c.beginPath();
          for (let k = -1; k <= 1; k++) { c.moveTo(p.x + k * 2 * p.s, p.y); c.lineTo(p.x + k * 3.5 * p.s, p.y - (4 + r() * 4) * p.s); }
          c.stroke();
        } else if (t < 0.8) {
          c.fillStyle = r() < 0.5 ? '#4a4741' : '#3d3a35';
          c.beginPath(); c.ellipse(p.x, p.y, (2 + r() * 3) * p.s, (1.3 + r() * 2) * p.s, 0, 0, PI * 2); c.fill();
        } else if (x > W.WALL_FRONT + 80 && r() < 0.15) {
          // Кости и черепа на поле
          c.fillStyle = '#b9b0a0';
          c.beginPath(); c.ellipse(p.x, p.y - 2 * p.s, 3 * p.s, 2.6 * p.s, 0, 0, PI * 2); c.fill();
          c.fillStyle = '#222'; c.fillRect(p.x - 1.6 * p.s, p.y - 2.6 * p.s, 1 * p.s, 1 * p.s); c.fillRect(p.x + 0.6 * p.s, p.y - 2.6 * p.s, 1 * p.s, 1 * p.s);
        }
      }
      // Площадь поселения — утоптанная земля и брусчатка
      const sq = [P(-300, 0, 0), P(W.WALL_BACK, 0, 0), P(W.WALL_BACK, 400, 0), P(-300, 400, 0)];
      poly(c, sq, 'rgba(70,60,48,0.35)');
      c.strokeStyle = 'rgba(30,25,20,0.25)';
      c.lineWidth = 1;
      for (let i = 0; i < 260; i++) {
        const x = 20 + r() * 440, z = 140 + r() * 120;
        const p = P(x, z, 0);
        c.strokeRect(p.x, p.y, 6 * p.s, 3 * p.s);
      }
      // Дорожки
      c.fillStyle = 'rgba(95,82,64,0.5)';
      const path1 = [P(-100, 175, 0), P(W.WALL_BACK, 175, 0), P(W.WALL_BACK, 225, 0), P(-100, 225, 0)];
      poly(c, path1, 'rgba(95,82,64,0.45)');
      const path2 = [P(160, 0, 0), P(200, 0, 0), P(200, 400, 0), P(160, 400, 0)];
      poly(c, path2, 'rgba(95,82,64,0.35)');
    }

    drawFogOverlay(c) {
      // Туман справа — оттуда приходят мертвецы
      const f = c.createLinearGradient(1090, 0, LW, 0);
      f.addColorStop(0, 'rgba(25,22,40,0)');
      f.addColorStop(0.6, 'rgba(25,22,40,0.4)');
      f.addColorStop(1, 'rgba(18,15,30,0.85)');
      c.fillStyle = f; c.fillRect(1090, W.GY0 - 60, LW - 1090, LH - W.GY0 + 60);
    }

    // ================= Главный кадр =================
    render(dt) {
      const g = this.game;
      this.time += dt;
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const hy = (this.oy + W.GY0 * this.scale) * this.dpr;
      ctx.fillStyle = '#070a1c';
      ctx.fillRect(0, 0, this.canvas.width, hy);
      ctx.fillStyle = '#2c3424';
      ctx.fillRect(0, hy, this.canvas.width, this.canvas.height - hy);
      const sh = g.shake;
      const sx = sh ? (Math.random() - 0.5) * sh : 0, sy = sh ? (Math.random() - 0.5) * sh : 0;
      ctx.setTransform(this.k, 0, 0, this.k, this.dpr * this.ox + sx * this.k, this.dpr * this.oy + sy * this.k);
      ctx.save();
      ctx.beginPath(); ctx.rect(-20, -20, LW + 40, LH + 40); ctx.clip();
      ctx.drawImage(this.bg, 0, 0, LW, LH);
      this.hits = [];
      this.drawClouds(ctx, dt);
      this.drawDecals(ctx);
      this.ambient(dt);
      this.drawSettlement(ctx);
      this.drawWall(ctx);
      this.drawWallTop(ctx);
      this.drawPools(ctx);
      this.drawZombies(ctx);
      this.drawParticles(ctx);
      this.drawProjectiles(ctx);
      this.drawTexts(ctx);
      ctx.drawImage(this.fog, 0, 0, LW, LH);
      this.drawLights(ctx);
      ctx.restore();
      // Виньетка на весь холст
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const cw = this.canvas.width, ch = this.canvas.height;
      if (!this.vig || this.vig.w !== cw || this.vig.h !== ch) {
        const v = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.45, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.55)');
        this.vig = { w: cw, h: ch, g: v };
      }
      ctx.fillStyle = this.vig.g;
      ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(this.k, 0, 0, this.k, this.dpr * this.ox, this.dpr * this.oy);
      this.drawBossBar(ctx);
      this.drawBanner(ctx, dt);
    }

    drawClouds(ctx, dt) {
      for (const c of this.clouds) {
        c.x += c.sp * dt;
        if (c.x > LW + 200) c.x = -c.w - 50;
        ctx.globalAlpha = c.a;
        ctx.fillStyle = '#6a5a86';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.w * 0.5, 14, 0, 0, PI * 2);
        ctx.ellipse(c.x + c.w * 0.18, c.y - 9, c.w * 0.28, 12, 0, 0, PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Фоновые частицы: дым кузницы, искры, пузыри алхимика, факелы
    ambient(dt) {
      const g = this.game;
      if (g.particles.length > 1200) return;
      this.ambT += dt;
      const r = Math.random;
      const B = (id) => TD.ITEMS[id].pos;
      if (r() < dt * 6) {
        const f = B('forge');
        g.particle('smoke', f.x - 20, f.z, f.h + 46, { vh: 18, vx: 6, life: 2.4, size: 6 + r() * 4, color: '#3a3640' });
      }
      if (g.levels.forge > 0 && r() < dt * 3) {
        const f = B('forge');
        for (let i = 0; i < 3; i++) g.particle('spark', f.x + f.w / 2 + 14, f.z + f.d / 2 + 10, 10, { vh: 60 + r() * 80, vx: (r() - 0.5) * 60, vz: (r() - 0.5) * 30, life: 0.5, size: 1.6 });
      }
      if (r() < dt * 5) {
        const a = B('alchemy');
        g.particle('magic', a.x + a.w / 2 + 16 + (r() - 0.5) * 8, a.z + a.d / 2 + 6, 14, { vh: 20 + r() * 20, life: 1.0, size: 2 + r() * 2, color: 'green' });
      }
      if (r() < dt * 2) {
        const t = B('townhall');
        g.particle('smoke', t.x - 30, t.z - 10, t.h + 30, { vh: 14, vx: 5, life: 2.5, size: 5, color: '#3a3640' });
      }
      // Пожар на стене при сильных повреждениях
      if (g.phase === 'battle' || g.phase === 'defeat') {
        const f = g.wallHp / g.wallMax;
        if (f < 0.35 && r() < dt * (8 * (1 - f))) {
          const z = r() * 400;
          g.particle(r() < 0.5 ? 'fire' : 'smoke', W.WALL_FRONT - 5, z, g.wallH * (0.6 + r() * 0.4), { vh: 30 + r() * 30, life: 1 + r(), size: 6 + r() * 6, color: '#2a2630' });
        }
      }
    }

    // ================= Поселение =================
    drawSettlement(ctx) {
      const g = this.game;
      const list = [];
      for (const b of TD.BUILDINGS) list.push({ z: b.pos.z + b.pos.d / 2, f: () => this.drawBuilding(ctx, b) });
      for (const c of g.catapults) list.push({ z: c.z + 14, f: () => this.drawCatapult(ctx, c) });
      for (const t of g.trebs) list.push({ z: t.z + 18, f: () => this.drawTrebuchet(ctx, t) });
      // Деревья и декор
      if (!this.decor) {
        const r = seeded(5);
        this.decor = [];
        const trees = [[-70, 20], [-40, 120], [-90, 260], [-30, 390], [20, 130], [300, 10], [150, 20], [-120, 70], [-60, 330], [380, 395]];
        for (const [x, z] of trees) this.decor.push({ k: 'tree', x, z, s: 0.8 + r() * 0.5, seed: r() });
        this.decor.push({ k: 'well', x: 175, z: 280 });
        this.decor.push({ k: 'hay', x: 300, z: 90 });
        this.decor.push({ k: 'barrels', x: 350, z: 375 });
        this.decor.push({ k: 'lamp', x: 150, z: 160 });
        this.decor.push({ k: 'lamp', x: 290, z: 245 });
        this.decor.push({ k: 'stones', x: 140, z: 375 });
      }
      for (const d of this.decor) list.push({ z: d.z, f: () => this.drawDecor(ctx, d) });
      list.sort((a, b) => a.z - b.z);
      for (const it of list) it.f();
    }

    drawDecor(ctx, d) {
      const p = P(d.x, d.z, 0);
      const s = p.s;
      if (d.k === 'tree') {
        const k = s * d.s;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 16 * k, 6 * k, 0, 0, PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1d14'; ctx.fillRect(p.x - 2.5 * k, p.y - 14 * k, 5 * k, 14 * k);
        const sway = Math.sin(this.time * 0.8 + d.seed * 10) * 1.5 * k;
        for (let i = 0; i < 3; i++) {
          const y = p.y - (12 + i * 14) * k, w = (20 - i * 5) * k;
          ctx.fillStyle = i % 2 ? '#1d3226' : '#213a2b';
          ctx.beginPath(); ctx.moveTo(p.x - w, y); ctx.lineTo(p.x + sway * (i + 1) * 0.4, y - 22 * k); ctx.lineTo(p.x + w, y); ctx.closePath(); ctx.fill();
        }
      } else if (d.k === 'well') {
        ctx.fillStyle = '#4b4842';
        ctx.beginPath(); ctx.ellipse(p.x, p.y - 6 * s, 13 * s, 7 * s, 0, 0, PI * 2); ctx.fill();
        ctx.fillRect(p.x - 13 * s, p.y - 6 * s, 26 * s, 8 * s);
        ctx.fillStyle = '#121822';
        ctx.beginPath(); ctx.ellipse(p.x, p.y - 7 * s, 9 * s, 4.5 * s, 0, 0, PI * 2); ctx.fill();
        line(ctx, p.x - 11 * s, p.y - 6 * s, p.x - 11 * s, p.y - 30 * s, '#3a2a1c', 2.5 * s);
        line(ctx, p.x + 11 * s, p.y - 6 * s, p.x + 11 * s, p.y - 30 * s, '#3a2a1c', 2.5 * s);
        poly(ctx, [{ x: p.x - 16 * s, y: p.y - 28 * s }, { x: p.x, y: p.y - 38 * s }, { x: p.x + 16 * s, y: p.y - 28 * s }], '#5a2e22');
      } else if (d.k === 'hay') {
        for (let i = 0; i < 3; i++) {
          const q = P(d.x + i * 16 - 16, d.z + (i % 2) * 8, 0);
          ctx.fillStyle = '#a4873e';
          ctx.beginPath(); ctx.ellipse(q.x, q.y - 7 * s, 9 * s, 8 * s, 0, 0, PI * 2); ctx.fill();
          ctx.strokeStyle = '#7a6230'; ctx.lineWidth = 1; ctx.stroke();
        }
      } else if (d.k === 'barrels') {
        for (let i = 0; i < 3; i++) {
          const q = P(d.x + (i % 2) * 14, d.z + (i >> 1) * 12 - 6, 0);
          ctx.fillStyle = '#5a3a20'; ctx.fillRect(q.x - 6 * s, q.y - 15 * s, 12 * s, 15 * s);
          ctx.fillStyle = '#6e4a2a';
          ctx.beginPath(); ctx.ellipse(q.x, q.y - 15 * s, 6 * s, 2.5 * s, 0, 0, PI * 2); ctx.fill();
          line(ctx, q.x - 6 * s, q.y - 4 * s, q.x + 6 * s, q.y - 4 * s, '#2b2b2b', 1.2 * s);
          line(ctx, q.x - 6 * s, q.y - 11 * s, q.x + 6 * s, q.y - 11 * s, '#2b2b2b', 1.2 * s);
        }
      } else if (d.k === 'lamp') {
        line(ctx, p.x, p.y, p.x, p.y - 34 * s, '#25211d', 2.5 * s);
        ctx.fillStyle = '#ffcf6a'; ctx.fillRect(p.x - 3 * s, p.y - 40 * s, 6 * s, 6 * s);
        this.lightAt(p.x, p.y - 37 * s, 46 * s, 0.5);
      } else if (d.k === 'stones') {
        for (let i = 0; i < 5; i++) {
          const q = P(d.x + (i % 3) * 13, d.z + Math.floor(i / 3) * 10, (i > 2 ? 0 : 0));
          this.box(ctx, d.x + (i % 3) * 13 - 6, d.x + (i % 3) * 13 + 6, d.z + Math.floor(i / 3) * 12 - 5, d.z + Math.floor(i / 3) * 12 + 5, 0, 9, '#8d8780');
          void q;
        }
        this.box(ctx, d.x + 2, d.x + 14, d.z - 2, d.z + 8, 9, 18, '#9a948c');
      }
    }

    // Призма (коробка): x0..x1, z0..z1, высота h0..h1
    box(ctx, x0, x1, z0, z1, h0, h1, color, edge) {
      const a = P(x0, z1, h0), b = P(x1, z1, h0), c = P(x1, z1, h1), d = P(x0, z1, h1);
      const e = P(x1, z0, h0), f = P(x1, z0, h1), gg = P(x0, z0, h1);
      if (e.x > b.x) poly(ctx, [b, e, f, c], shade(color, 0.72), edge, 0.6);
      else poly(ctx, [P(x0, z1, h0), P(x0, z0, h0), gg, d], shade(color, 0.72), edge, 0.6);
      poly(ctx, [a, b, c, d], color, edge, 0.6);
      poly(ctx, [d, c, f, gg], shade(color, 1.15), edge, 0.6);
    }

    lightAt(x, y, r, a, img) {
      (this.lights || (this.lights = [])).push({ x, y, r, a, img });
    }

    drawBuilding(ctx, b) {
      const g = this.game;
      const lvl = g.levels[b.id];
      const { x, z, w, d, h } = b.pos;
      const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
      const hover = this.hover === b.id || this.selected === b.id;
      const t = this.time;
      // Тень
      const sh = [P(x0 + 6, z1 + 8, 0), P(x1 + 14, z1 + 8, 0), P(x1 + 14, z0 + 4, 0), P(x0 + 6, z0 + 4, 0)];
      poly(ctx, sh, 'rgba(0,0,0,0.28)');
      if (hover) {
        const c0 = P(x, z, 0);
        ctx.strokeStyle = `rgba(255,214,110,${0.55 + Math.sin(t * 5) * 0.25})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(c0.x, c0.y, (w * 0.62) * c0.s, d * 0.62 * ZK, 0, 0, PI * 2); ctx.stroke();
      }
      const wallCol = { townhall: '#8a7a64', forge: '#6a645c', range: '#7a5a3a', workshop: '#77593b', masonry: '#8c877e', alchemy: '#5d566e' }[b.id];
      const roofCol = { townhall: '#3c4f8a', forge: '#3a3434', range: '#7a3b26', workshop: '#6b4424', masonry: '#5d5e66', alchemy: '#5b2f7a' }[b.id];

      if (b.id === 'alchemy') this.drawAlchemy(ctx, b, wallCol, roofCol, lvl);
      else {
        // Стены здания
        const fl = P(x0, z1, 0), fr = P(x1, z1, 0), ftr = P(x1, z1, h), ftl = P(x0, z1, h);
        const br = P(x1, z0, 0), btr = P(x1, z0, h), btl = P(x0, z0, h);
        poly(ctx, [fr, br, btr, ftr], shade(wallCol, 0.7), '#00000055');
        poly(ctx, [fl, fr, ftr, ftl], wallCol, '#00000055');
        // Деревянный каркас
        if (b.id !== 'masonry' && b.id !== 'forge') {
          ctx.strokeStyle = 'rgba(40,26,16,0.8)'; ctx.lineWidth = 2 * fl.s;
          ctx.beginPath();
          ctx.moveTo(ftl.x, ftl.y + 3); ctx.lineTo(ftr.x, ftr.y + 3);
          const m1 = P(x0, z1, h * 0.5), m2 = P(x1, z1, h * 0.5);
          ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y);
          for (let i = 0; i <= 4; i++) {
            const q0 = P(lerp(x0, x1, i / 4), z1, 0), q1 = P(lerp(x0, x1, i / 4), z1, h);
            ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y);
          }
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(30,28,26,0.45)'; ctx.lineWidth = 0.8;
          ctx.beginPath();
          for (let hh = 8; hh < h; hh += 8) {
            const q0 = P(x0, z1, hh), q1 = P(x1, z1, hh);
            ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y);
          }
          ctx.stroke();
        }
        // Дверь
        const dw = Math.min(18, w * 0.18), dh = Math.min(28, h * 0.55);
        const dx = b.id === 'forge' ? x + w * 0.15 : x;
        const d0 = P(dx - dw / 2, z1, 0), d1 = P(dx + dw / 2, z1, 0), d2 = P(dx + dw / 2, z1, dh), d3 = P(dx - dw / 2, z1, dh);
        poly(ctx, [d0, d1, d2, d3], b.id === 'forge' ? '#ff8a2a' : '#2a1a10');
        if (b.id === 'forge') this.lightAt((d0.x + d1.x) / 2, d0.y - 10, 60, 0.7 + Math.sin(t * 9) * 0.15);
        else this.lightAt((d0.x + d1.x) / 2, d3.y, 26, 0.35);
        // Окна (тёплый свет)
        const nwin = Math.max(1, Math.floor(w / 40));
        for (let i = 0; i < nwin * 2; i++) {
          const wx = lerp(x0 + 10, x1 - 10, (i + 0.5) / (nwin * 2));
          if (Math.abs(wx - dx) < dw) continue;
          const wy = h * 0.42;
          const q0 = P(wx - 4, z1, wy), q1 = P(wx + 4, z1, wy), q2 = P(wx + 4, z1, wy + 10), q3 = P(wx - 4, z1, wy + 10);
          const fl2 = 0.8 + Math.sin(t * 3 + i * 2 + x) * 0.15;
          poly(ctx, [q0, q1, q2, q3], `rgba(255,${190 + i * 5},90,${fl2})`, '#2a1a10', 1);
          this.lightAt((q0.x + q1.x) / 2, (q0.y + q2.y) / 2, 16, 0.35);
        }
        // Боковое окно
        const s0 = P(x1, (z0 + z1) / 2 - 5, h * 0.45), s1 = P(x1, (z0 + z1) / 2 + 5, h * 0.45), s2 = P(x1, (z0 + z1) / 2 + 5, h * 0.45 + 10), s3 = P(x1, (z0 + z1) / 2 - 5, h * 0.45 + 10);
        poly(ctx, [s0, s1, s2, s3], 'rgba(255,190,90,0.7)', '#2a1a10', 1);
        // Крыша (двускатная, конёк вдоль X)
        const rh = h * 0.55 + 10;
        const zm = (z0 + z1) / 2;
        const ov = 6;
        const r0 = P(x0 - ov, z1 + ov, h), r1 = P(x1 + ov, z1 + ov, h), r2 = P(x1 + ov, zm, h + rh), r3 = P(x0 - ov, zm, h + rh);
        const rb0 = P(x0 - ov, z0 - ov, h), rb1 = P(x1 + ov, z0 - ov, h);
        poly(ctx, [rb0, rb1, r2, r3], shade(roofCol, 0.6));
        poly(ctx, [P(x1, z1, h), P(x1, z0, h), P(x1, zm, h + rh)], shade(wallCol, 0.62), '#00000055');
        poly(ctx, [r0, r1, r2, r3], roofCol, '#00000066');
        // Черепица
        ctx.strokeStyle = shade(roofCol, 0.75); ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < 4; i++) {
          const a0 = P(x0 - ov, lerp(z1 + ov, zm, i / 4), lerp(h, h + rh, i / 4)), a1 = P(x1 + ov, lerp(z1 + ov, zm, i / 4), lerp(h, h + rh, i / 4));
          ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y);
        }
        ctx.stroke();
        if (lvl >= 8) line(ctx, r3.x, r3.y, r2.x, r2.y, '#e8c060', 2.2);
        // Особенности зданий
        this.buildingExtras(ctx, b, lvl, rh);
        if (lvl >= 4) this.flag(ctx, P(x0 + 6, zm, h + rh - 2), roofCol === '#3c4f8a' ? '#c33' : '#d9b54a', 20);
      }
      // Бейдж уровня + стрелка «можно улучшить»
      const top = P(x, z, b.pos.badge || h + 58);
      this.levelBadge(ctx, top.x, top.y, lvl, TD.ITEMS[b.id].max, g.canUpgrade(b.id));
      // Зона клика
      const pts = [P(x0, z1, 0), P(x1, z1, 0), P(x1, z0, 0), P(x1, z0, h + 50), P(x0, z0, h + 60)];
      let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
      for (const q of pts) { mnx = Math.min(mnx, q.x); mny = Math.min(mny, q.y); mxx = Math.max(mxx, q.x); mxy = Math.max(mxy, q.y); }
      this.hits.push({ id: b.id, x0: mnx - 4, y0: mny, x1: mxx + 4, y1: mxy + 4 });
      if (this.flashUp[b.id] > 0) {
        const p = P(x, z, h * 0.6);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.flashUp[b.id];
        ctx.drawImage(this.glowWhite, p.x - 90, p.y - 90, 180, 180);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    buildingExtras(ctx, b, lvl, rh) {
      const { x, z, w, d, h } = b.pos;
      const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
      const t = this.time;
      if (b.id === 'townhall') {
        // Центральная башня
        const tw = 34, td = 34, th = h + 70;
        this.box(ctx, x - tw / 2 - 10, x + tw / 2 - 10, z - td / 2, z + td / 2, 0, th, '#9a8a72', '#00000044');
        const a = P(x - tw / 2 - 14, z + td / 2 + 4, th), bb = P(x + tw / 2 - 6, z + td / 2 + 4, th), c = P(x - 10, z, th + 34), e = P(x + tw / 2 - 6, z - td / 2 - 4, th);
        poly(ctx, [bb, e, c], shade('#3c4f8a', 0.7));
        poly(ctx, [a, bb, c], '#3c4f8a', '#00000066');
        // Часы
        const cp = P(x - 10, z + td / 2, th - 16);
        circle(ctx, cp.x, cp.y, 7 * cp.s, '#e8dcb0');
        const ang = this.time * 0.5;
        line(ctx, cp.x, cp.y, cp.x + Math.cos(ang) * 5 * cp.s, cp.y + Math.sin(ang) * 5 * cp.s, '#222', 1.2);
        line(ctx, cp.x, cp.y, cp.x + Math.cos(ang / 12) * 3.5 * cp.s, cp.y + Math.sin(ang / 12) * 3.5 * cp.s, '#222', 1.6);
        this.flag(ctx, c, '#c33', 26);
      } else if (b.id === 'forge') {
        this.box(ctx, x - 28, x - 12, z - 8, z + 8, h, h + rh + 20, '#58524c', '#00000055');
        const ap = P(x1 + 14, z1 + 10, 0);
        ctx.fillStyle = '#2b2b30';
        ctx.fillRect(ap.x - 8 * ap.s, ap.y - 10 * ap.s, 16 * ap.s, 5 * ap.s);
        ctx.fillRect(ap.x - 3 * ap.s, ap.y - 5 * ap.s, 6 * ap.s, 5 * ap.s);
        // Кузнец бьёт молотом
        const hp = P(x1 + 26, z1 + 10, 0);
        const sw = Math.max(0, Math.sin(t * 5)) ;
        ctx.fillStyle = '#3a2a22'; ctx.fillRect(hp.x - 3 * hp.s, hp.y - 22 * hp.s, 7 * hp.s, 13 * hp.s);
        circle(ctx, hp.x, hp.y - 26 * hp.s, 3.5 * hp.s, '#c49a7a');
        line(ctx, hp.x - 1 * hp.s, hp.y - 9 * hp.s, hp.x - 1 * hp.s, hp.y, '#2a2a2a', 2.5 * hp.s);
        line(ctx, hp.x + 3 * hp.s, hp.y - 9 * hp.s, hp.x + 3 * hp.s, hp.y, '#2a2a2a', 2.5 * hp.s);
        const ha = -1.6 + sw * 1.9;
        const hx = hp.x - 2 * hp.s + Math.cos(ha + PI) * 12 * hp.s, hy = hp.y - 18 * hp.s + Math.sin(ha + PI) * 12 * hp.s;
        line(ctx, hp.x - 2 * hp.s, hp.y - 18 * hp.s, hx, hy, '#6b4a2a', 1.8 * hp.s);
        ctx.fillStyle = '#555'; ctx.fillRect(hx - 3 * hp.s, hy - 2 * hp.s, 6 * hp.s, 4 * hp.s);
        this.lightAt(ap.x, ap.y - 8, 30, 0.5 + sw * 0.3);
      } else if (b.id === 'range') {
        // Мишени
        for (let i = 0; i < 2; i++) {
          const p = P(x1 + 18, z0 + 12 + i * 26, 0);
          line(ctx, p.x, p.y, p.x, p.y - 18 * p.s, '#4a3220', 2 * p.s);
          circle(ctx, p.x, p.y - 22 * p.s, 9 * p.s, '#e8dcc0');
          circle(ctx, p.x, p.y - 22 * p.s, 6.5 * p.s, '#c33');
          circle(ctx, p.x, p.y - 22 * p.s, 4 * p.s, '#e8dcc0');
          circle(ctx, p.x, p.y - 22 * p.s, 1.8 * p.s, '#c33');
          line(ctx, p.x + 1, p.y - 23 * p.s, p.x - 8 * p.s, p.y - 27 * p.s, '#3a2a1a', 1);
        }
      } else if (b.id === 'workshop') {
        // Вращающаяся шестерня на фасаде
        const p = P(x1 - 18, z1, h * 0.55);
        const R = 10 * p.s;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 0.8);
        ctx.fillStyle = '#8a8070';
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * PI * 2, rr = i % 2 ? R : R * 1.3;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill();
        circle(ctx, 0, 0, R * 0.4, '#3a3028');
        ctx.restore();
        // Брёвна
        for (let i = 0; i < 3; i++) {
          const q = P(x1 + 10, z1 - 6 - i * 3, 4 + (i === 2 ? 7 : 0));
          ctx.fillStyle = '#6b4a2a';
          ctx.fillRect(q.x - 2, q.y - 4 * q.s, 30 * q.s, 7 * q.s);
          circle(ctx, q.x + 30 * q.s, q.y - 0.5 * q.s, 3.5 * q.s, '#a0784a');
        }
      } else if (b.id === 'masonry') {
        for (let i = 0; i < 3; i++) this.box(ctx, x1 + 6, x1 + 20, z1 - 20 + i * 2, z1 - 8 + i * 2, i * 9, i * 9 + 9, '#9a948c', '#00000044');
        this.box(ctx, x1 + 22, x1 + 34, z1 - 12, z1 - 2, 0, 9, '#8d8780', '#00000044');
      }
    }

    drawAlchemy(ctx, b, wallCol, roofCol, lvl) {
      const { x, z, w, h } = b.pos;
      const R = w / 2;
      const p0 = P(x, z, 0), p1 = P(x, z, h);
      const rx = R * p0.s, ry = R * ZK * 0.85;
      const rx1 = R * p1.s;
      ctx.fillStyle = shade(wallCol, 0.8);
      ctx.beginPath();
      ctx.ellipse(p0.x, p0.y, rx, ry, 0, 0, PI);
      ctx.lineTo(p1.x - rx1, p1.y);
      ctx.ellipse(p1.x, p1.y, rx1, ry, 0, PI, 0, true);
      ctx.closePath();
      const gr = ctx.createLinearGradient(p0.x - rx, 0, p0.x + rx, 0);
      gr.addColorStop(0, shade(wallCol, 1.1)); gr.addColorStop(0.6, wallCol); gr.addColorStop(1, shade(wallCol, 0.55));
      ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8;
      for (let hh = 9; hh < h; hh += 9) {
        const q = P(x, z, hh);
        ctx.beginPath(); ctx.ellipse(q.x, q.y, R * q.s, ry, 0, 0.05, PI - 0.05); ctx.stroke();
      }
      // Окна с зелёным светом
      for (let i = 0; i < 2; i++) {
        const q = P(x - 12 + i * 22, z + R * 0.85, h * (0.3 + i * 0.3));
        const fl = 0.7 + Math.sin(this.time * 4 + i) * 0.25;
        ctx.fillStyle = `rgba(140,255,120,${fl})`;
        ctx.fillRect(q.x - 3 * q.s, q.y - 8 * q.s, 6 * q.s, 9 * q.s);
        this.lightAt(q.x, q.y - 4, 22, 0.4, this.glowGreen);
      }
      // Дверь
      const dq = P(x, z + R * 0.9, 0);
      ctx.fillStyle = '#21152a';
      ctx.beginPath(); ctx.moveTo(dq.x - 7 * dq.s, dq.y); ctx.lineTo(dq.x - 7 * dq.s, dq.y - 16 * dq.s); ctx.arc(dq.x, dq.y - 16 * dq.s, 7 * dq.s, PI, 0); ctx.lineTo(dq.x + 7 * dq.s, dq.y); ctx.fill();
      // Коническая крыша
      const top = P(x, z, h + 46);
      ctx.fillStyle = shade(roofCol, 0.65);
      ctx.beginPath(); ctx.ellipse(p1.x, p1.y, rx1 + 6, ry + 4, 0, PI, 0); ctx.lineTo(top.x, top.y); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(p1.x - rx1 - 6, p1.y); ctx.ellipse(p1.x, p1.y, rx1 + 6, ry + 4, 0, PI, 0, true); ctx.lineTo(top.x, top.y); ctx.closePath();
      const rg = ctx.createLinearGradient(p1.x - rx1, 0, p1.x + rx1, 0);
      rg.addColorStop(0, shade(roofCol, 1.2)); rg.addColorStop(1, shade(roofCol, 0.6));
      ctx.fillStyle = rg; ctx.fill();
      circle(ctx, top.x, top.y, 3, '#d6ff7a');
      this.lightAt(top.x, top.y, 20, 0.6, this.glowGreen);
      if (lvl >= 4) this.flag(ctx, top, '#7a3bb0', 18);
      // Бурлящий котёл у входа
      const c = P(x + R + 16, z + b.pos.d / 2 + 6, 0);
      line(ctx, c.x - 8 * c.s, c.y, c.x - 5 * c.s, c.y - 8 * c.s, '#222', 1.5);
      line(ctx, c.x + 8 * c.s, c.y, c.x + 5 * c.s, c.y - 8 * c.s, '#222', 1.5);
      ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.ellipse(c.x, c.y - 2, 5 * c.s, 2 * c.s, 0, 0, PI * 2); ctx.fill();
      ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.ellipse(c.x, c.y - 10 * c.s, 9 * c.s, 7 * c.s, 0, 0, PI * 2); ctx.fill();
      ctx.fillStyle = '#7dff5a'; ctx.beginPath(); ctx.ellipse(c.x, c.y - 15 * c.s, 8 * c.s, 2.5 * c.s, 0, 0, PI * 2); ctx.fill();
      this.lightAt(c.x, c.y - 15, 28, 0.55, this.glowGreen);
    }

    flag(ctx, base, color, len) {
      const t = this.time;
      line(ctx, base.x, base.y, base.x, base.y - len, '#2a221c', 1.5);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - len);
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        ctx.lineTo(base.x + u * 16, base.y - len + Math.sin(t * 5 - u * 4) * 2.2 * u);
      }
      for (let i = 6; i >= 0; i--) {
        const u = i / 6;
        ctx.lineTo(base.x + u * 16, base.y - len + 9 + Math.sin(t * 5 - u * 4) * 2.2 * u);
      }
      ctx.closePath(); ctx.fill();
    }

    levelBadge(ctx, x, y, lvl, max, can) {
      const t = this.time;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = lvl >= max ? '#c99a2e' : '#2b2238';
      ctx.strokeStyle = lvl >= max ? '#ffe08a' : '#c9a35a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-10, -10); ctx.lineTo(10, -10); ctx.lineTo(10, 3); ctx.quadraticCurveTo(10, 10, 0, 13); ctx.quadraticCurveTo(-10, 10, -10, 3); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff3d0';
      ctx.font = 'bold 11px Philosopher, Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lvl >= max ? '★' : String(lvl), 0, 0);
      if (can && lvl < max) {
        const by = -20 + Math.sin(t * 5) * 3;
        ctx.fillStyle = '#6dff6a';
        ctx.strokeStyle = '#0a3a0a';
        ctx.beginPath(); ctx.moveTo(0, by - 7); ctx.lineTo(7, by + 1); ctx.lineTo(2.5, by + 1); ctx.lineTo(2.5, by + 6); ctx.lineTo(-2.5, by + 6); ctx.lineTo(-2.5, by + 1); ctx.lineTo(-7, by + 1); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    // ================= Осадные машины =================
    drawCatapult(ctx, c) {
      const p = P(c.x, c.z, 0);
      const s = p.s * 1.1;
      const far = P(c.x, c.z - 12, 0);
      const fdx = far.x - p.x, fdy = far.y - p.y;
      const appear = clamp(c.built / 0.6, 0, 1);
      const hover = this.hover === 'catapult' || this.selected === 'catapult';
      ctx.save();
      ctx.translate(p.x, p.y + (1 - appear) * 20);
      ctx.globalAlpha = appear;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(4 * s, 0, 30 * s, 9 * s, 0, 0, PI * 2); ctx.fill();
      const wood = '#7a5432', woodD = '#4e3420';
      // Дальняя рама
      ctx.save(); ctx.translate(fdx, fdy);
      this.catFrame(ctx, s, woodD);
      ctx.restore();
      // Рычаг
      const a = c.anim;
      const rest = PI - 0.18, fire = PI / 2 - 0.35;
      let th;
      if (a < 0.2) th = lerp(rest, fire, (a / 0.2) * (a / 0.2));
      else if (a < 0.45) th = fire + Math.sin((a - 0.2) * 30) * 0.08 * (1 - (a - 0.2) / 0.25);
      else { const rl = Math.max(0.8, (TD.S.catapultInterval(this.game.levels.catapult, this.game.mods) - 0.6)); th = lerp(fire, rest, ease(clamp((a - 0.45) / rl, 0, 1))); }
      const pv = { x: -6 * s + fdx / 2, y: -16 * s + fdy / 2 };
      const L = 40 * s;
      const tip = { x: pv.x + Math.cos(th) * L, y: pv.y - Math.sin(th) * L };
      line(ctx, pv.x, pv.y, tip.x, tip.y, wood, 4 * s);
      // Чаша
      ctx.fillStyle = woodD;
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 5 * s, 0, PI * 2); ctx.fill();
      const loaded = a > 0.9 || !c.shot && a > 9 - 1e-6;
      if (loaded || (c.shot && a < 0.22)) circle(ctx, tip.x, tip.y - 2 * s, 4.2 * s, this.game.mods.fireRocks ? '#c46a2a' : '#77706a');
      // Ближняя рама
      this.catFrame(ctx, s, wood);
      ctx.restore();
      ctx.globalAlpha = 1;
      if (hover) { ctx.strokeStyle = 'rgba(255,214,110,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x + 4 * s, p.y, 34 * s, 11 * s, 0, 0, PI * 2); ctx.stroke(); }
      this.hits.push({ id: 'catapult', x0: p.x - 30 * s, y0: p.y - 50 * s, x1: p.x + 30 * s, y1: p.y + 6 });
    }

    catFrame(ctx, s, col) {
      line(ctx, -26 * s, -6 * s, 24 * s, -6 * s, col, 4 * s);
      line(ctx, -2 * s, -6 * s, 6 * s, -34 * s, col, 3 * s);
      line(ctx, 14 * s, -6 * s, 6 * s, -34 * s, col, 3 * s);
      line(ctx, 2 * s, -34 * s, 10 * s, -34 * s, col, 3 * s);
      for (const wx of [-18, 16]) {
        circle(ctx, wx * s, -4 * s, 6 * s, '#3a2a1a');
        circle(ctx, wx * s, -4 * s, 4.2 * s, col);
        circle(ctx, wx * s, -4 * s, 1.5 * s, '#2a2a2a');
      }
    }

    drawTrebuchet(ctx, tr) {
      const p = P(tr.x, tr.z, 0);
      const s = p.s * 1.15;
      const far = P(tr.x, tr.z - 18, 0);
      const fdx = far.x - p.x, fdy = far.y - p.y;
      const appear = clamp(tr.built / 0.8, 0, 1);
      const hover = this.hover === 'trebuchet' || this.selected === 'trebuchet';
      ctx.save();
      ctx.translate(p.x, p.y + (1 - appear) * 30);
      ctx.globalAlpha = appear;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 0, 46 * s, 12 * s, 0, 0, PI * 2); ctx.fill();
      const wood = '#7d5a36', woodD = '#4b3220';
      ctx.save(); ctx.translate(fdx, fdy); this.trebFrame(ctx, s, woodD); ctx.restore();
      // Анимация броска
      const a = tr.anim;
      const rest = PI + 0.95, end = PI / 2 - 0.65;
      const swing = 0.85;
      let th, sling;
      const interval = TD.S.trebInterval(this.game.levels.trebuchet, this.game.mods);
      if (a < swing) {
        const u = (a / swing);
        const e = u * u;
        th = lerp(rest, end, e);
        sling = u < 0.5 ? lerp(0.05, -PI / 2, u / 0.5) : lerp(-PI / 2, end + 0.3, (u - 0.5) / 0.5);
      } else {
        const u = clamp((a - swing - 0.6) / Math.max(1, interval - swing - 1.6), 0, 1);
        th = a < swing + 0.6 ? end + Math.sin((a - swing) * 14) * 0.06 * (1 - (a - swing) / 0.6) : lerp(end, rest, ease(u));
        sling = a < swing + 0.6 ? end - 0.6 + Math.sin((a - swing) * 10) * 0.6 : lerp(-PI / 2 + th - end, 0.05, ease(u));
      }
      const pv = { x: fdx / 2, y: -64 * s + fdy / 2 };
      const Ll = 70 * s, Ls = 20 * s;
      const tip = { x: pv.x + Math.cos(th) * Ll, y: pv.y - Math.sin(th) * Ll };
      const cw = { x: pv.x - Math.cos(th) * Ls, y: pv.y + Math.sin(th) * Ls };
      // Противовес
      line(ctx, cw.x, cw.y, cw.x, cw.y + 10 * s, '#2a2a2a', 1.5 * s);
      ctx.fillStyle = '#4a3a2c';
      ctx.fillRect(cw.x - 10 * s, cw.y + 10 * s, 20 * s, 16 * s);
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.2 * s; ctx.strokeRect(cw.x - 10 * s, cw.y + 10 * s, 20 * s, 16 * s);
      line(ctx, cw.x - 10 * s, cw.y + 18 * s, cw.x + 10 * s, cw.y + 18 * s, '#2a2a2a', 1 * s);
      // Рычаг
      line(ctx, cw.x, cw.y, tip.x, tip.y, wood, 5 * s);
      circle(ctx, pv.x, pv.y, 3 * s, '#333');
      // Праща
      const SL = 26 * s;
      let bx = tip.x + Math.cos(sling) * SL, by = tip.y - Math.sin(sling) * SL;
      if (by > -3 * s) by = -3 * s;
      line(ctx, tip.x, tip.y, bx, by, '#c9b48a', 1.2 * s);
      const loaded = !(a >= 0.75 && a < interval - 1.2) || (tr.shot && a < 0.75);
      if (loaded) {
        circle(ctx, bx, by, 6.5 * s, this.game.mods.fireRocks ? '#b35a24' : '#6b655e');
        circle(ctx, bx - 2 * s, by - 2 * s, 2 * s, 'rgba(255,255,255,0.15)');
      }
      this.trebFrame(ctx, s, wood);
      ctx.restore();
      ctx.globalAlpha = 1;
      if (hover) { ctx.strokeStyle = 'rgba(255,214,110,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, 50 * s, 13 * s, 0, 0, PI * 2); ctx.stroke(); }
      this.hits.push({ id: 'trebuchet', x0: p.x - 50 * s, y0: p.y - 110 * s, x1: p.x + 50 * s, y1: p.y + 8 });
    }

    trebFrame(ctx, s, col) {
      line(ctx, -40 * s, -3 * s, 40 * s, -3 * s, col, 5 * s);
      line(ctx, -26 * s, -3 * s, 0, -64 * s, col, 4 * s);
      line(ctx, 26 * s, -3 * s, 0, -64 * s, col, 4 * s);
      line(ctx, -13 * s, -33 * s, 13 * s, -33 * s, col, 3 * s);
      line(ctx, 0, -64 * s, 0, -3 * s, col, 2 * s);
    }

    // ================= Стена =================
    wallCacheKey() {
      const g = this.game;
      return g.wallTier + ':' + g.levels.wall + ':' + g.ballistas.length + ':' + this.k;
    }

    drawWall(ctx) {
      const g = this.game;
      const key = this.wallCacheKey();
      if (key !== this.wallKey) {
        this.wallKey = key;
        this.wallImg = this.layer((c) => this.paintWall(c));
      }
      ctx.drawImage(this.wallImg, 0, 0, LW, LH);
      // Трещины и повреждения
      const f = g.wallHp / g.wallMax;
      if (f < 0.75) this.drawCracks(ctx, f);
      if (g.wallHitT > 0) {
        const a = [P(W.WALL_FRONT, -20, 0), P(W.WALL_FRONT, 420, 0), P(W.WALL_FRONT, 420, g.wallH), P(W.WALL_FRONT, -20, g.wallH)];
        poly(ctx, a, `rgba(255,60,40,${g.wallHitT * 0.5})`);
      }
      if (g.phase === 'defeat') this.drawBreach(ctx);
      const hp = [P(W.WALL_BACK, -20, g.wallH), P(W.WALL_FRONT, -20, g.wallH), P(W.WALL_FRONT, 420, 0), P(W.WALL_FRONT, 420, g.wallH + 10)];
      this.hits.push({ id: 'wall', poly: [P(W.WALL_BACK, -20, g.wallH + 8), P(W.WALL_FRONT + 4, -20, g.wallH + 8), P(W.WALL_FRONT + 4, 420, 0), P(W.WALL_BACK, 420, 0)] });
      void hp;
    }

    paintWall(c) {
      const g = this.game;
      const H = g.wallH, tier = g.wallTier, F = W.WALL_FRONT, B = W.WALL_BACK;
      const z0 = -20, z1 = 430;
      const r = seeded(99 + g.levels.wall);
      const base = ['#6e4f30', '#77736b', '#5e5b62'][tier];
      // Верх (боевой ход)
      poly(c, [P(B, z0, H), P(F, z0, H), P(F, z1, H), P(B, z1, H)], tier === 0 ? '#5a4128' : shade(base, 0.85));
      if (tier === 0) {
        c.strokeStyle = 'rgba(30,20,10,0.6)'; c.lineWidth = 0.8;
        c.beginPath();
        for (let z = z0; z < z1; z += 8) { const a = P(B, z, H), b = P(F - 6, z, H); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
        c.stroke();
      } else {
        c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.7;
        c.beginPath();
        for (let z = z0; z < z1; z += 14) { const a = P(B, z, H), b = P(F, z, H); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
        c.stroke();
      }
      // Лицевая грань
      const face = [P(F, z0, 0), P(F, z1, 0), P(F, z1, H), P(F, z0, H)];
      const fg = c.createLinearGradient(0, P(F, 0, H).y, 0, P(F, 400, 0).y);
      fg.addColorStop(0, shade(base, 1.08)); fg.addColorStop(1, shade(base, 0.7));
      poly(c, face, fg);
      if (tier === 0) {
        // Частокол из брёвен
        for (let z = z0; z < z1; z += 9) {
          const hh = H + 4 + r() * 6;
          const a = P(F, z, 0), b = P(F, z + 8.5, 0), d = P(F, z + 8.5, H), e = P(F, z, H);
          const tip = P(F, z + 4.25, hh + 6);
          const col = shade('#7a5634', 0.8 + r() * 0.35);
          poly(c, [a, b, d, P(F, z + 8.5, hh), tip, P(F, z, hh), e], col, 'rgba(30,18,8,0.7)', 0.8);
        }
        // Поперечные брусья
        for (const hh of [H * 0.25, H * 0.7]) {
          const a = P(F + 1, z0, hh), b = P(F + 1, z1, hh), b2 = P(F + 1, z1, hh + 5), a2 = P(F + 1, z0, hh + 5);
          poly(c, [a, b, b2, a2], '#4e3520');
        }
      } else {
        // Каменная кладка
        const rowH = tier === 1 ? 9 : 12;
        c.strokeStyle = 'rgba(25,22,28,0.55)'; c.lineWidth = 0.9;
        c.beginPath();
        let row = 0;
        for (let hh = 0; hh < H; hh += rowH, row++) {
          const a = P(F, z0, hh), b = P(F, z1, hh);
          c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
          const bw = tier === 1 ? 16 : 22;
          for (let z = z0 + (row % 2) * bw * 0.5; z < z1; z += bw) {
            const q0 = P(F, z, hh), q1 = P(F, z, Math.min(H, hh + rowH));
            c.moveTo(q0.x, q0.y); c.lineTo(q1.x, q1.y);
          }
        }
        c.stroke();
        // Случайные оттенки камней
        for (let i = 0; i < 160; i++) {
          const z = z0 + r() * (z1 - z0), hh = r() * (H - 6);
          const q = P(F, z, hh);
          c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
          c.fillRect(q.x - 1, q.y - 5 * q.s, 2.5 * q.s, 6 * q.s);
        }
        // Мох у основания
        for (let i = 0; i < 70; i++) {
          const z = z0 + r() * (z1 - z0);
          const q = P(F, z, r() * 8);
          c.fillStyle = 'rgba(60,90,50,0.35)';
          c.beginPath(); c.ellipse(q.x, q.y, 2 * q.s, 3 * q.s, 0, 0, PI * 2); c.fill();
        }
        if (tier === 2) {
          // Знамёна
          for (const z of [130, 268]) {
            const a = P(F + 1, z - 10, H - 6), b = P(F + 1, z + 10, H - 6), d = P(F + 1, z + 10, H - 46), e = P(F + 1, z, H - 52), f = P(F + 1, z - 10, H - 46);
            poly(c, [a, b, d, e, f], '#8a1e22', '#d4a64a', 1.2);
            const m = P(F + 1, z, H - 26);
            c.fillStyle = '#e8c060';
            c.font = `bold ${14 * m.s}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText('♜', m.x, m.y);
          }
          // Шипы у подножия
          for (let z = z0 + 5; z < z1; z += 14) {
            const a = P(F, z, 2), b = P(F + 16, z + 3, 6);
            c.strokeStyle = '#5a4a3a'; c.lineWidth = 2 * a.s;
            c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
            c.fillStyle = '#9a9a9a'; c.beginPath(); c.arc(b.x, b.y, 1.2, 0, PI * 2); c.fill();
          }
        }
        // Зубцы
        const mw = tier === 1 ? 12 : 14, gap = tier === 1 ? 9 : 10, mh = tier === 1 ? 10 : 13;
        for (let z = z0; z < z1; z += mw + gap) {
          c.save();
          this.box(c, F - 7, F, z, z + mw, H, H + mh, shade(base, 1.0), 'rgba(0,0,0,0.35)');
          c.restore();
        }
      }
      // Башни баллист
      const towers = [];
      for (let i = 0; i < g.ballistas.length; i++) towers.push(TD.TOWER_Z[i]);
      towers.sort((a, b) => a - b);
      for (const tz of towers) this.paintTower(c, tz, H, tier, base);
      // Угловая башня на дальнем конце
      this.paintTower(c, -22, H, tier, base, true);
    }

    paintTower(c, tz, H, tier, base, corner) {
      const x0 = W.WALL_BACK - 4, x1 = W.WALL_FRONT + 14;
      const z0 = tz - 24, z1 = tz + 24;
      const th = H + (corner ? 26 : 34);
      const col = tier === 0 ? '#6b4c2e' : shade(base, 1.05);
      this.box(c, x0, x1, z0, z1, 0, th, col, 'rgba(0,0,0,0.4)');
      if (tier === 0) {
        c.strokeStyle = 'rgba(30,18,8,0.6)'; c.lineWidth = 0.8;
        c.beginPath();
        for (let z = z0; z <= z1; z += 6) { const a = P(x1, z, 0), b = P(x1, z, th); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
        for (let x = x0; x <= x1; x += 6) { const a = P(x, z1, 0), b = P(x, z1, th); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
        c.stroke();
      } else {
        c.strokeStyle = 'rgba(25,22,28,0.45)'; c.lineWidth = 0.8;
        c.beginPath();
        for (let hh = 9; hh < th; hh += 9) {
          const a = P(x1, z0, hh), b = P(x1, z1, hh), d = P(x0, z1, hh);
          c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y);
        }
        c.stroke();
      }
      // Бойница
      const s0 = P(x1, tz - 2, th * 0.55), s1 = P(x1, tz + 2, th * 0.55 + 12);
      c.fillStyle = '#120e14'; c.fillRect(s0.x - 1, s1.y, 3, s0.y - s1.y);
      // Зубцы башни
      const mh = 8;
      for (const [zx0, zx1] of [[z1 - 9, z1], [tz - 4.5, tz + 4.5], [z0, z0 + 9]]) this.box(c, x1 - 8, x1, zx0, zx1, th, th + mh, col, 'rgba(0,0,0,0.35)');
      for (const [xa, xb] of [[x0, x0 + 9], [(x0 + x1) / 2 - 4, (x0 + x1) / 2 + 4]]) this.box(c, xa, xb, z1 - 8, z1, th, th + mh, col, 'rgba(0,0,0,0.35)');
      if (corner) {
        const top = P((x0 + x1) / 2, tz, th + 40);
        const a = P(x0 - 3, z1 + 3, th + mh), b = P(x1 + 3, z1 + 3, th + mh), d = P(x1 + 3, z0 - 3, th + mh);
        poly(c, [b, d, top], tier === 0 ? '#4a3420' : '#3a2f4a');
        poly(c, [a, b, top], tier === 0 ? '#5e4228' : '#4a3d60', 'rgba(0,0,0,0.4)');
      }
    }

    drawCracks(ctx, f) {
      const g = this.game;
      if (!this.cracks) {
        const r = seeded(3);
        this.cracks = [];
        for (let i = 0; i < 26; i++) {
          const z = r() * 400, pts = [];
          let h = 0.2 + r() * 0.7, zz = z;
          for (let k = 0; k < 5; k++) { pts.push([zz, h]); zz += (r() - 0.5) * 14; h += (r() - 0.6) * 0.18; }
          this.cracks.push({ pts, th: r() });
        }
      }
      ctx.strokeStyle = 'rgba(15,10,10,0.8)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (const c of this.cracks) {
        if (c.th < (0.75 - f) * 1.4) {
          c.pts.forEach(([z, h], i) => {
            const q = P(W.WALL_FRONT + 0.5, z, clamp(h, 0.02, 0.98) * g.wallH);
            if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
          });
        }
      }
      ctx.stroke();
    }

    drawBreach(ctx) {
      const g = this.game;
      const z0 = 160, z1 = 245;
      const pts = [P(W.WALL_FRONT + 2, z0, g.wallH + 14), P(W.WALL_FRONT + 2, z0 + 10, g.wallH * 0.3), P(W.WALL_FRONT + 2, (z0 + z1) / 2, 4), P(W.WALL_FRONT + 2, z1 - 8, g.wallH * 0.25), P(W.WALL_FRONT + 2, z1, g.wallH + 14)];
      poly(ctx, pts, '#140f12');
      const r = seeded(8);
      for (let i = 0; i < 26; i++) {
        const q = P(W.WALL_FRONT + 6 + r() * 40, z0 + r() * (z1 - z0), 0);
        ctx.fillStyle = g.wallTier === 0 ? '#5a3e22' : '#6f6a62';
        ctx.fillRect(q.x - 4 * q.s, q.y - 6 * q.s, (5 + r() * 7) * q.s, (4 + r() * 4) * q.s);
      }
    }

    // Лучники, баллисты, котлы и факелы на стене — по глубине
    drawWallTop(ctx) {
      const g = this.game;
      const items = [];
      for (const a of g.archers) items.push({ z: a.z, f: () => this.drawArcher(ctx, a) });
      for (const b of g.ballistas) items.push({ z: b.z, f: () => this.drawBallista(ctx, b) });
      for (const c of g.cauldrons) items.push({ z: c.z + 0.5, f: () => this.drawCauldron(ctx, c) });
      for (const tz of [30, 100, 165, 235, 300, 375]) items.push({ z: tz, f: () => this.drawTorch(ctx, tz) });
      items.sort((a, b) => a.z - b.z);
      for (const it of items) it.f();
    }

    drawTorch(ctx, z) {
      const g = this.game;
      const p = P(W.WALL_FRONT + 1, z, g.wallH - 14);
      const s = p.s;
      line(ctx, p.x, p.y, p.x + 4 * s, p.y - 9 * s, '#3a2a1a', 2 * s);
      const fl = Math.sin(this.time * 17 + z) * 0.5 + Math.sin(this.time * 23 + z * 2) * 0.5;
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(p.x + 2 * s, p.y - 9 * s);
      ctx.quadraticCurveTo(p.x + (4 + fl) * s, p.y - (19 + fl * 2) * s, p.x + 6.5 * s, p.y - 9 * s);
      ctx.fill();
      circle(ctx, p.x + 4.3 * s, p.y - 11 * s, 1.8 * s, '#fff2b0');
      this.lightAt(p.x + 4 * s, p.y - 12 * s, 48 * s, 0.55 + fl * 0.08);
    }

    drawArcher(ctx, a) {
      const g = this.game;
      const p = P(a.x, a.z, g.wallH);
      const s = p.s * 1.05;
      const lvl = g.levels.archers;
      // Направление выстрела (в экранных координатах)
      let aim = -0.55;
      if (a.target && a.target.state !== 'dead') {
        const tp = P(a.target.x, a.target.z, 20);
        const ang = Math.atan2(tp.y - (p.y - 22 * s), tp.x - p.x);
        aim = clamp(ang - 0.45 - Math.min(0.4, Math.hypot(tp.x - p.x, tp.y - p.y) / 1400), -1.25, 0.35);
      }
      a.aim = lerp(a.aim, aim, 0.2);
      const interval = TD.S.archerInterval(lvl, g.mods);
      const pull = a.anim < 0.12 ? 0 : clamp((a.anim - 0.25) / Math.max(0.2, interval * 0.55), 0, 1);
      const snap = a.anim < 0.15 ? Math.sin(a.anim * 90) * (1 - a.anim / 0.15) : 0;
      const tunic = lvl >= 11 ? '#2c4a8a' : lvl >= 6 ? '#6f7680' : '#3f5a2e';
      const hood = lvl >= 11 ? '#c9a33a' : lvl >= 6 ? '#8f969e' : '#2f4424';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(s, s);
      // Тело
      line(ctx, -1.5, 0, -2, -9, '#2a2420', 2.6);
      line(ctx, 2, 0, 2.5, -9, '#2a2420', 2.6);
      ctx.fillStyle = tunic;
      ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(5, -8); ctx.lineTo(4, -21); ctx.lineTo(-4, -21); ctx.closePath(); ctx.fill();
      // Колчан
      ctx.fillStyle = '#5a3a20'; ctx.save(); ctx.translate(-4, -18); ctx.rotate(-0.4); ctx.fillRect(-2, -8, 4, 12);
      ctx.fillStyle = '#ddd'; ctx.fillRect(-1.8, -11, 1.2, 3); ctx.fillRect(0.4, -10, 1.2, 3); ctx.restore();
      // Голова
      circle(ctx, 0.5, -25, 3.6, '#d2a882');
      ctx.fillStyle = hood;
      ctx.beginPath(); ctx.arc(0, -25.5, 4.2, PI * 0.95, PI * 2.1); ctx.lineTo(-3, -22); ctx.closePath(); ctx.fill();
      if (lvl >= 6) { ctx.fillStyle = hood; ctx.fillRect(-4.5, -27, 9, 1.4); }
      // Лук и руки
      const sx = 1, sy = -18;
      ctx.translate(sx, sy);
      ctx.rotate(a.aim);
      const bowR = 10;
      const bend = 0.9 + pull * 0.25;
      ctx.strokeStyle = lvl >= 11 ? '#d6b25a' : '#8a5a2b';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(9 - bowR * 0.55, 0, bowR, -bend, bend); ctx.stroke();
      const tipx = 9 - bowR * 0.55 + Math.cos(bend) * bowR, tipy = Math.sin(bend) * bowR;
      const hand = 9 - 2 - pull * 9 + snap * 1.5;
      ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(tipx, -tipy); ctx.lineTo(hand - 1, 0); ctx.lineTo(tipx, tipy); ctx.stroke();
      // Руки
      line(ctx, 0, 0, 9, 0, tunic, 2.2);
      line(ctx, 0, 0, hand, 0.5, shade(tunic, 0.8), 2.2);
      circle(ctx, 9, 0, 1.4, '#d2a882');
      // Стрела на тетиве
      if (a.anim > 0.3 || g.phase !== 'battle') {
        line(ctx, hand - 1, 0, hand + 15, 0, '#c8b08a', 0.9);
        ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(hand + 17, 0); ctx.lineTo(hand + 14, -1.3); ctx.lineTo(hand + 14, 1.3); ctx.fill();
        if (g.mods.fireArrow > 0 && a.anim > 0.3 && (a.z * 7 + Math.floor(this.time)) % 5 < 1) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(this.glowFire, hand + 12, -5, 10, 10);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.restore();
    }

    drawBallista(ctx, b) {
      const g = this.game;
      const th = g.wallH + 34;
      const p = P(b.x + 2, b.z, th);
      const s = p.s;
      const appear = clamp(b.built / 0.5, 0, 1);
      // Поворот к цели в экранных координатах
      const ahead = P(b.x + Math.cos(b.aim) * 100, b.z + Math.sin(b.aim) * 100, th - 10);
      const ang = Math.atan2(ahead.y - p.y, ahead.x - p.x);
      const recoil = b.anim < 0.25 ? Math.sin((b.anim / 0.25) * PI) * 4 : 0;
      const interval = TD.S.ballistaInterval(g.levels.ballista, g.mods);
      const loaded = b.anim > Math.min(1.0, interval * 0.6) || g.phase !== 'battle';
      ctx.save();
      ctx.translate(p.x, p.y - 4 * s);
      ctx.scale(s * appear, s * appear);
      // Опора
      ctx.fillStyle = '#4b3220';
      ctx.fillRect(-3, -2, 6, 8);
      ctx.rotate(ang);
      ctx.translate(-recoil, 0);
      // Ложе
      ctx.fillStyle = '#7a5432';
      ctx.fillRect(-14, -2.5, 30, 5);
      // Плечи
      const pullB = loaded ? 1 : clamp(b.anim / (interval * 0.6), 0, 1);
      ctx.strokeStyle = g.levels.ballista >= 9 ? '#bfa36a' : '#5a3a20';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(6 - pullB * 3, -11, 2 - pullB * 4, -15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(6 - pullB * 3, 11, 2 - pullB * 4, 15); ctx.stroke();
      const sx = lerp(9, -10, pullB);
      ctx.strokeStyle = '#ddd2b0'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(2 - pullB * 4, -15); ctx.lineTo(sx, 0); ctx.lineTo(2 - pullB * 4, 15); ctx.stroke();
      if (loaded) {
        line(ctx, sx, 0, sx + 26, 0, '#3a2a1a', 2);
        ctx.fillStyle = '#aaa'; ctx.beginPath(); ctx.moveTo(sx + 31, 0); ctx.lineTo(sx + 25, -2.5); ctx.lineTo(sx + 25, 2.5); ctx.fill();
      }
      ctx.restore();
      // Расчёт баллисты
      const cp = P(b.x - 14, b.z + 8, th);
      ctx.save(); ctx.translate(cp.x, cp.y); ctx.scale(s, s);
      ctx.fillStyle = '#6a3a2a'; ctx.fillRect(-3, -18, 6, 12);
      line(ctx, -1, -6, -1, 0, '#2a2420', 2.2); line(ctx, 2, -6, 2, 0, '#2a2420', 2.2);
      circle(ctx, 0, -21, 3.3, '#d2a882');
      ctx.fillStyle = '#777'; ctx.beginPath(); ctx.arc(0, -22, 3.8, PI, 0); ctx.fill();
      ctx.restore();
      this.hits.push({ id: 'ballista', x0: p.x - 30 * s, y0: p.y - 30 * s, x1: p.x + 30 * s, y1: p.y + (th * s) });
    }

    drawCauldron(ctx, c) {
      const g = this.game;
      const H = g.wallH;
      const p = P(c.x, c.z, H);
      const s = p.s;
      const appear = clamp(c.built / 0.5, 0, 1);
      const t = c.pour;
      let tilt = 0;
      if (t < 0.5) tilt = ease(t / 0.5) * 1.5;
      else if (t < 1.4) tilt = 1.5;
      else if (t < 2.0) tilt = 1.5 * (1 - ease((t - 1.4) / 0.6));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(s * appear, s * appear);
      // Тренога и огонь
      line(ctx, -7, 0, -3, -12, '#222', 1.6);
      line(ctx, 7, 0, 3, -12, '#222', 1.6);
      const fl = Math.sin(this.time * 20 + c.z) * 1.5;
      ctx.fillStyle = '#ff8a2a';
      ctx.beginPath(); ctx.moveTo(-5, -1); ctx.quadraticCurveTo(0, -10 - fl, 5, -1); ctx.fill();
      ctx.fillStyle = '#ffe07a';
      ctx.beginPath(); ctx.moveTo(-2.5, -1); ctx.quadraticCurveTo(0, -6 - fl, 2.5, -1); ctx.fill();
      // Котёл (наклоняется к полю)
      ctx.translate(0, -14);
      ctx.rotate(tilt);
      ctx.fillStyle = '#26262a';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, PI); ctx.lineTo(-9, -3); ctx.lineTo(9, -3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(-10, -4.5, 20, 2.5);
      if (t > 1.6 || tilt < 0.4) {
        ctx.fillStyle = '#ffb63a';
        ctx.beginPath(); ctx.ellipse(0, -3.5, 8, 1.8, 0, 0, PI * 2); ctx.fill();
      }
      ctx.restore();
      this.lightAt(p.x, p.y - 6 * s, 30 * s, 0.5);
      // Пар
      if (Math.random() < 0.05 && g.particles.length < 1200) g.particle('smoke', c.x, c.z, H + 18, { vh: 16, life: 1.4, size: 4, color: '#8a8a95' });
      // Струя горящего воска
      if (t > 0.35 && t < 1.55) {
        const k = clamp((t - 0.35) / 0.15, 0, 1) * clamp((1.55 - t) / 0.2, 0, 1);
        const lip = P(c.x + 16, c.z, H + 10);
        const mid = P(W.WALL_FRONT + 14, c.z, H * 0.5);
        const ground = P(W.WALL_FRONT + 22, c.z, 0);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = ['rgba(255,120,30,0.55)', 'rgba(255,190,70,0.75)', 'rgba(255,245,180,0.9)'][i];
          ctx.lineWidth = (8 - i * 2.6) * s * k;
          ctx.beginPath();
          ctx.moveTo(lip.x, lip.y);
          const wob = Math.sin(this.time * 30 + i) * 2;
          ctx.quadraticCurveTo(mid.x + wob, mid.y, ground.x, ground.y);
          ctx.stroke();
        }
        ctx.restore();
        if (Math.random() < 0.6) g.particle('splash', W.WALL_FRONT + 22, c.z + (Math.random() - 0.5) * 10, 2, { vh: 60 + Math.random() * 60, vx: Math.random() * 40, vz: (Math.random() - 0.5) * 50, life: 0.5, size: 2.5 });
        this.lightAt(ground.x, ground.y - 10, 70, 0.8 * k);
      }
      this.hits.push({ id: 'oil', x0: p.x - 12 * s, y0: p.y - 28 * s, x1: p.x + 12 * s, y1: p.y + 2 });
    }

    // ================= Поле боя =================
    drawDecals(ctx) {
      const g = this.game;
      for (const d of g.decals) {
        const p = P(d.x, d.z, 0);
        const a = Math.min(1, (d.life - d.t) / 2);
        ctx.globalAlpha = a;
        const s = p.s;
        if (d.kind === 'crater') {
          ctx.globalAlpha = a * 0.8;
          ctx.fillStyle = 'rgba(30,24,20,0.5)';
          ctx.beginPath(); ctx.ellipse(p.x, p.y, d.size * s, d.size * ZK * 0.6, 0, 0, PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(20,16,14,0.55)';
          ctx.beginPath(); ctx.ellipse(p.x, p.y, d.size * s * 0.55, d.size * ZK * 0.32, 0, 0, PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(120,100,80,0.45)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, d.size * s * 1.02, d.size * ZK * 0.62, 0, PI * 0.9, PI * 2.1); ctx.stroke();
        } else if (d.kind === 'blood' || d.kind === 'goo') {
          ctx.fillStyle = d.kind === 'goo' ? 'rgba(110,150,40,0.6)' : 'rgba(70,14,14,0.65)';
          ctx.beginPath(); ctx.ellipse(p.x, p.y, d.size * s * 0.8, d.size * ZK * 0.4, d.rot * 0.1, 0, PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(p.x + d.size * 0.6 * s * Math.cos(d.rot), p.y + 2, d.size * s * 0.3, d.size * ZK * 0.18, 0, 0, PI * 2); ctx.fill();
        } else if (d.kind === 'arrow' || d.kind === 'bolt') {
          const L = d.kind === 'bolt' ? 18 : 10;
          const ang = d.kind === 'bolt' ? d.rot : -1.1 + d.rot;
          const ex = p.x - Math.cos(ang) * L * s * (d.kind === 'bolt' ? 1 : 0.5), ey = p.y - Math.abs(Math.sin(-1.0)) * L * 0.8 * s;
          line(ctx, p.x, p.y, ex, ey, d.kind === 'bolt' ? '#3a2a1a' : '#b8a07a', d.kind === 'bolt' ? 2 : 1);
          ctx.fillStyle = '#ddd'; ctx.fillRect(ex - 1, ey - 1, 2.5, 2.5);
        }
      }
      ctx.globalAlpha = 1;
    }

    drawPools(ctx) {
      const g = this.game;
      if (!g.pools.length) return;
      ctx.save();
      for (const p of g.pools) {
        const q = P(p.x, p.z, 0);
        const life = 1 - p.t / p.life;
        const a = Math.min(1, p.t * 4) * Math.min(1, life * 3);
        const rx = p.rx * q.s, ry = p.rz * ZK * 0.75;
        const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rx);
        gr.addColorStop(0, `rgba(255,190,80,${0.6 * a})`);
        gr.addColorStop(0.5, `rgba(230,100,30,${0.55 * a})`);
        gr.addColorStop(1, 'rgba(120,30,10,0)');
        ctx.fillStyle = gr;
        ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1, ry / rx); ctx.translate(-q.x, -q.y);
        ctx.beginPath(); ctx.arc(q.x, q.y, rx, 0, PI * 2); ctx.fill();
        ctx.restore();
        this.lightAt(q.x, q.y - 10, rx * 1.3, 0.35 * a);
      }
      ctx.restore();
    }

    drawZombies(ctx) {
      const g = this.game;
      const zs = g.zombies.slice().sort((a, b) => a.z - b.z || (a.state === 'dead' ? -1 : 1));
      // Сначала трупы
      for (const z of zs) if (z.state === 'dead' && !z.gone) this.drawZombie(ctx, z);
      for (const z of zs) if (z.state !== 'dead') this.drawZombie(ctx, z);
    }

    drawZombie(ctx, z) {
      const p = P(z.x, z.z, 0);
      const k = p.s * z.size;
      if (p.x < -60 || p.x > LW + 80) return;
      const g = this.game;
      let alpha = 1;
      if (z.state === 'dead') alpha = clamp(1 - (z.deadT - 4) / 3, 0, 1);
      if (z.x > W.SPAWN_X - 40 && z.state !== 'dead') alpha = Math.min(alpha, clamp((W.SPAWN_X + 70 - z.x) / 110, 0.15, 1));
      if (alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      // Тень
      if (z.state !== 'dead') {
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 11 * k, 3.6 * k, 0, 0, PI * 2); ctx.fill();
      }
      if (z.boss) {
        const glow = z.type === 'lich' ? this.glowBlue : z.type === 'necro' || z.type === 'titan' ? this.glowGreen : this.glowFire;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * (0.25 + (z.casting > 0 ? z.casting * 0.6 : 0) + Math.sin(this.time * 3) * 0.06);
        ctx.drawImage(glow, p.x - 50 * k, p.y - 70 * k, 100 * k, 90 * k);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;
      }
      ctx.translate(p.x, p.y);
      if (z.state === 'rise') {
        const u = clamp(z.stateT / 1.0, 0, 1);
        ctx.beginPath(); ctx.rect(-80 * k, -200 * k, 160 * k, 200 * k); ctx.clip();
        ctx.translate(0, (1 - ease(u)) * 48 * k);
      }
      if (z.state === 'dead') {
        const u = clamp(z.deadT / 0.55, 0, 1);
        ctx.rotate(u * u * PI * 0.48);
        ctx.translate(0, u * 2 * k);
      }
      ctx.scale(k, k);
      this.drawZombieBody(ctx, z);
      ctx.restore();
      // Полоска здоровья
      if (z.state !== 'dead' && !z.boss && z.hp < z.maxHp) {
        const w = 22 * k, y = p.y - 54 * k;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(p.x - w / 2 - 1, y - 1, w + 2, 4);
        ctx.fillStyle = z.burn > 0 ? '#ff9a3a' : '#d84040';
        ctx.fillRect(p.x - w / 2, y, w * (z.hp / z.maxHp), 2);
      }
    }

    drawZombieBody(ctx, z) {
      const pal = PAL[z.type] || PAL.walker;
      const fl = z.flash > 0;
      const skin = fl ? shade(pal.skin, 1.55) : z.burn > 0 ? '#b9844a' : pal.skin;
      const shirt = fl ? shade(pal.shirt, 1.45) : pal.shirt;
      const pants = fl ? shade(pal.pants, 1.4) : pal.pants;
      const walking = z.state === 'walk' || z.state === 'rise';
      const spd = z.speed / 26;
      const ph = z.t * 5.2 * Math.sqrt(spd) + z.seed * 10;
      const bob = walking ? -Math.abs(Math.cos(ph)) * 1.6 : 0;
      const type = z.type;
      const robed = type === 'necro' || type === 'lich';
      const bulky = type === 'brute' || type === 'elite' || type === 'butcher' || type === 'colossus' || type === 'titan';
      const lean = type === 'runner' ? 7 : bulky ? 3 : 5;
      const hipY = -20 + bob;
      const neck = { x: -lean, y: -37 + bob };
      // Атака
      let strike = 0;
      if (z.state === 'attack' && z.type !== 'spitter') {
        const u = z.atkAnim;
        strike = u < 0.18 ? -u / 0.18 : u < 0.32 ? -1 + ((u - 0.18) / 0.14) * 2 : u < 0.6 ? 1 - (u - 0.32) / 0.28 : 0;
      }
      const legs = (front) => {
        if (robed) return;
        const off = front ? 0 : PI;
        const amp = walking ? (type === 'runner' ? 0.75 : 0.5) : 0.08;
        const a = Math.sin(ph + off) * amp;
        const bend = walking ? Math.max(0, -Math.cos(ph + off)) * 0.8 : 0.1;
        const hx = front ? -1 : 1.5;
        const kx = hx - Math.sin(a) * 10, ky = hipY + Math.cos(a) * 10;
        const fx = kx - Math.sin(a - bend) * 10, fy = ky + Math.cos(a - bend) * 10;
        const col = front ? pants : shade(pants.startsWith('#') ? pants : '#555555', 0.7);
        const lw = bulky ? 6 : type === 'runner' ? 3.6 : 4.4;
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx, hipY); ctx.lineTo(kx, ky); ctx.lineTo(fx, Math.min(0, fy)); ctx.stroke();
        ctx.strokeStyle = front ? '#2a221c' : '#1a1512'; ctx.lineWidth = lw * 0.8;
        ctx.beginPath(); ctx.moveTo(fx, Math.min(0, fy)); ctx.lineTo(fx - 3.5, Math.min(0, fy)); ctx.stroke();
      };
      const arm = (front) => {
        const sh = { x: neck.x + (front ? -1 : 2), y: neck.y + 3 };
        let hx, hy;
        if (z.state === 'attack' && type !== 'spitter') {
          const sw = strike + (front ? 0 : 0.3);
          hx = sh.x - 13 + Math.max(0, sw) * 2;
          hy = sh.y - 6 + sw * 12;
        } else if (robed) {
          hx = sh.x - 9; hy = sh.y + 7 + (front ? 0 : 2);
        } else {
          const sway = Math.sin(ph * 0.5 + (front ? 0 : 1.7)) * 2.5;
          hx = sh.x - 15 + (front ? 0 : 2); hy = sh.y + 1 + sway;
          if (type === 'runner') { hx = sh.x - 8 + Math.sin(ph + (front ? PI : 0)) * 6; hy = sh.y + 9; }
        }
        const ex = (sh.x + hx) / 2 + 1, ey = (sh.y + hy) / 2 + 2.5;
        const lw = bulky ? 5.5 : 3.6;
        ctx.strokeStyle = front ? (robed ? shirt : skin) : shade(robed ? '#2a1f3a' : (fl ? '#ffffff' : pal.skin), 0.7);
        ctx.lineWidth = lw; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
        if (robed) circle(ctx, hx, hy, 2, skin);
        return { x: hx, y: hy };
      };
      legs(false);
      arm(false);
      // Туловище
      if (robed) {
        const sway = Math.sin(ph) * 2;
        ctx.fillStyle = shirt;
        ctx.beginPath();
        ctx.moveTo(neck.x - 4, neck.y);
        ctx.lineTo(neck.x + 5, neck.y);
        ctx.lineTo(9 + sway, 0);
        ctx.lineTo(-10 + sway, 0);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = type === 'lich' ? '#5ad2ff' : '#7dff6a'; ctx.globalAlpha *= 0.6; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-10 + sway, -1); ctx.lineTo(9 + sway, -1); ctx.stroke();
        ctx.globalAlpha /= 0.6;
      } else {
        const tw = bulky ? 13 : type === 'runner' ? 7 : 9;
        ctx.strokeStyle = shirt; ctx.lineWidth = tw; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(neck.x + 1, neck.y + 3); ctx.stroke();
        if (type === 'brute' || type === 'titan' || type === 'butcher') {
          ctx.fillStyle = type === 'butcher' ? shade(skin.startsWith('#') ? skin : '#ffffff', 0.95) : skin;
          ctx.beginPath(); ctx.ellipse(-4, hipY - 7, type === 'titan' ? 12 : 9, type === 'titan' ? 11 : 8, 0, 0, PI * 2); ctx.fill();
        }
        if (type === 'butcher') {
          ctx.fillStyle = fl ? '#fff' : '#d8d2c4';
          ctx.beginPath(); ctx.moveTo(-12, hipY - 12); ctx.lineTo(1, hipY - 12); ctx.lineTo(2, hipY + 8); ctx.lineTo(-11, hipY + 8); ctx.fill();
          ctx.fillStyle = '#8a1a1a'; circle(ctx, -6, hipY - 2, 3, '#8a1a1a'); circle(ctx, -3, hipY + 4, 2, '#7a1515');
        }
        if (type === 'exploder' || type === 'titan') {
          const sw = z.state === 'swell' ? 1 + z.stateT * 0.7 : 1;
          const pr = (type === 'titan' ? 14 : 9) * sw;
          ctx.fillStyle = fl ? '#fff' : '#9fc04a';
          ctx.beginPath(); ctx.arc(-4, hipY - 6, pr, 0, PI * 2); ctx.fill();
          const pulse = 0.5 + Math.sin(this.time * (z.state === 'swell' ? 25 : 5) + z.seed * 9) * 0.5;
          for (let i = 0; i < (type === 'titan' ? 6 : 3); i++) {
            const a = i * 2.1 + z.seed * 5;
            circle(ctx, -4 + Math.cos(a) * pr * 0.6, hipY - 6 + Math.sin(a) * pr * 0.6, pr * 0.2, `rgba(220,255,90,${0.5 + pulse * 0.5})`);
          }
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35 + pulse * 0.3;
          ctx.drawImage(this.glowGreen, -4 - pr * 2, hipY - 6 - pr * 2, pr * 4, pr * 4);
          ctx.restore();
        }
        if (type === 'colossus' || type === 'elite') {
          ctx.fillStyle = fl ? '#fff' : type === 'colossus' ? '#55545c' : '#5a5e66';
          ctx.fillRect(neck.x - 6, neck.y + 1, 13, 7);
          ctx.fillRect(-7, hipY - 10, 12, 8);
          if (type === 'colossus') {
            ctx.strokeStyle = '#ff9a2a'; ctx.lineWidth = 0.9;
            ctx.beginPath(); ctx.moveTo(-5, hipY - 2); ctx.lineTo(-2, hipY - 8); ctx.lineTo(-4, hipY - 13); ctx.stroke();
          }
          ctx.fillStyle = '#bbb';
          ctx.beginPath(); ctx.moveTo(neck.x + 4, neck.y + 1); ctx.lineTo(neck.x + 7, neck.y - 5); ctx.lineTo(neck.x + 8, neck.y + 2); ctx.fill();
        }
        // Рваньё одежды
        if (type === 'walker' || type === 'runner' || type === 'spitter') {
          ctx.fillStyle = shirt;
          ctx.beginPath(); ctx.moveTo(-3, hipY + 2); ctx.lineTo(-1, hipY + 6); ctx.lineTo(1, hipY + 2); ctx.lineTo(3, hipY + 5); ctx.lineTo(4, hipY); ctx.fill();
          ctx.fillStyle = 'rgba(60,10,10,0.6)'; circle(ctx, -2, hipY - 9, 1.6, 'rgba(60,10,10,0.6)');
        }
      }
      // Голова
      const hr = type === 'titan' ? 4.8 : bulky ? 5.6 : type === 'spitter' ? 6 : 5.4;
      const hxp = neck.x - 2.5, hyp = neck.y - hr + 0.5 + (z.state === 'attack' && type === 'spitter' && z.atkAnim < 0.4 ? -2 : 0);
      if (robed) {
        ctx.fillStyle = type === 'lich' ? '#c5d0e0' : '#d8dcc8';
        circle(ctx, hxp, hyp, hr, fl ? '#fff' : ctx.fillStyle);
        ctx.fillStyle = shirt;
        ctx.beginPath(); ctx.arc(hxp + 1, hyp, hr + 2.2, PI * 1.05, PI * 2.15); ctx.lineTo(hxp + 5, hyp + 6); ctx.closePath(); ctx.fill();
        circle(ctx, hxp - 2.5, hyp - 0.5, 1.1, '#000');
      } else {
        circle(ctx, hxp, hyp, hr, skin);
        // Челюсть
        ctx.fillStyle = shade(fl ? '#ffffff' : pal.skin, 0.75);
        const jaw = z.state === 'attack' ? 2.2 : 1 + Math.sin(z.t * 3) * 0.6;
        ctx.fillRect(hxp - hr + 0.5, hyp + hr * 0.35, hr * 1.1, jaw);
        // Волосы/лысина
        if (type === 'walker' || type === 'runner') {
          ctx.fillStyle = '#2a2420';
          ctx.beginPath(); ctx.arc(hxp + 0.8, hyp - 0.8, hr, PI * 1.1, PI * 1.9); ctx.fill();
        }
        if (type === 'colossus' || type === 'elite') {
          ctx.fillStyle = fl ? '#fff' : '#4a4a52';
          ctx.beginPath(); ctx.arc(hxp, hyp - 0.5, hr + 0.8, PI, 0); ctx.fill();
          ctx.fillRect(hxp - hr - 0.8, hyp - 0.5, 2.2, 4);
        }
      }
      // Глаза
      const ex = hxp - hr * 0.55, ey = hyp - hr * 0.15;
      circle(ctx, ex, ey, 1.05, pal.eye);
      if (z.boss || type === 'elite') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(type === 'lich' ? this.glowBlue : this.glowFire, ex - 4, ey - 4, 8, 8);
        ctx.restore();
      }
      // Корона короля мёртвых
      if (type === 'lich') {
        ctx.fillStyle = '#e8c060';
        ctx.beginPath();
        const cy = hyp - hr - 1;
        ctx.moveTo(hxp - 5, cy + 2); ctx.lineTo(hxp - 5, cy - 3); ctx.lineTo(hxp - 2.5, cy); ctx.lineTo(hxp, cy - 4.5); ctx.lineTo(hxp + 2.5, cy); ctx.lineTo(hxp + 5, cy - 3); ctx.lineTo(hxp + 5, cy + 2); ctx.closePath(); ctx.fill();
      }
      legs(true);
      const hand = arm(true);
      // Оружие боссов
      if (type === 'butcher') {
        ctx.save(); ctx.translate(hand.x, hand.y); ctx.rotate(-0.4 + strike * 0.9);
        line(ctx, 0, 0, 0, -6, '#4a3020', 2);
        ctx.fillStyle = fl ? '#fff' : '#b8bcc4'; ctx.fillRect(-7, -15, 10, 9);
        ctx.fillStyle = '#7a1515'; ctx.fillRect(-7, -9, 10, 2);
        ctx.restore();
      } else if (robed) {
        const orbC = type === 'lich' ? this.glowBlue : this.glowGreen;
        line(ctx, hand.x, hand.y + 14, hand.x - 1, hand.y - 20, '#3a2a1a', 1.8);
        circle(ctx, hand.x - 1, hand.y - 22, 2.6, type === 'lich' ? '#9ae4ff' : '#a6ff8a');
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gs = 14 + (z.casting > 0 ? z.casting * 20 : 0) + Math.sin(this.time * 6) * 2;
        ctx.drawImage(orbC, hand.x - 1 - gs / 2, hand.y - 22 - gs / 2, gs, gs);
        ctx.restore();
      } else if (type === 'colossus') {
        ctx.fillStyle = fl ? '#fff' : '#6a6970';
        ctx.fillRect(hand.x - 5, hand.y - 4, 8, 8);
      }
    }

    drawParticles(ctx) {
      const g = this.game;
      const ps = g.particles;
      // Обычные
      for (const p of ps) {
        const k = p.kind;
        if (k === 'fire' || k === 'spark' || k === 'magic' || k === 'splash') continue;
        const q = P(p.x, p.z, p.h);
        const u = p.t / p.life;
        if (k === 'smoke' || k === 'dust') {
          ctx.globalAlpha = (1 - u) * (k === 'smoke' ? 0.45 : 0.4);
          circle(ctx, q.x, q.y, p.size * (0.6 + u * 1.6) * q.s, p.color || (k === 'dust' ? '#7d6e5e' : '#3a3640'));
        } else if (k === 'debris') {
          ctx.globalAlpha = Math.min(1, (1 - u) * 3);
          ctx.fillStyle = p.color || '#5b4a3a';
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(p.rot);
          ctx.fillRect(-p.size * q.s / 2, -p.size * q.s / 2, p.size * q.s, p.size * q.s * 0.8);
          ctx.restore();
        } else if (k === 'glob') {
          ctx.globalAlpha = 1 - u * 0.5;
          circle(ctx, q.x, q.y, p.size * q.s, '#9fd04a');
        } else {
          ctx.globalAlpha = 1 - u * 0.4;
          circle(ctx, q.x, q.y, p.size * q.s * 0.7, p.color || '#5a1010');
        }
      }
      ctx.globalAlpha = 1;
      // Светящиеся (аддитивно)
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) {
        const k = p.kind;
        if (!(k === 'fire' || k === 'spark' || k === 'magic' || k === 'splash')) continue;
        const q = P(p.x, p.z, p.h);
        const u = p.t / p.life;
        if (k === 'fire') {
          const sz = p.size * (1.2 - u * 0.6) * q.s * 2.4;
          ctx.globalAlpha = (1 - u) * 0.62;
          ctx.drawImage(this.glowFire, q.x - sz, q.y - sz, sz * 2, sz * 2);
          if (u < 0.4) { ctx.globalAlpha = (0.4 - u) * 1.6; circle(ctx, q.x, q.y, p.size * 0.35 * q.s, '#fff3b0'); }
        } else if (k === 'spark') {
          ctx.globalAlpha = 1 - u;
          line(ctx, q.x, q.y, q.x - p.vx * 0.012, q.y + p.vh * 0.012, '#ffd27a', 1.4);
        } else if (k === 'magic') {
          const sz = p.size * 3 * q.s;
          ctx.globalAlpha = (1 - u) * 0.9;
          ctx.drawImage(p.color === 'green' ? this.glowGreen : this.glowPurple, q.x - sz, q.y - sz, sz * 2, sz * 2);
        } else {
          const sz = p.size * 2.2 * q.s;
          ctx.globalAlpha = 1 - u;
          ctx.drawImage(this.glowFire, q.x - sz, q.y - sz, sz * 2, sz * 2);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    drawProjectiles(ctx) {
      const g = this.game;
      for (const p of g.projectiles) {
        const q = P(p.x, p.z, p.h);
        if (p.kind === 'arrow' || p.kind === 'bolt') {
          let ang;
          if (p.kind === 'bolt') {
            const n = P(p.x + p.vx * 0.02, p.z + p.vz * 0.02, p.h + p.vh * 0.02);
            ang = Math.atan2(n.y - q.y, n.x - q.x);
          } else {
            const k = Math.min(1, p.t / p.T + 0.02);
            const nx = p.x0 + (p.x1 - p.x0) * k, nz = p.z0 + (p.z1 - p.z0) * k, nh = p.h0 + (p.h1 - p.h0) * k + p.arc * 4 * k * (1 - k);
            const n = P(nx, nz, nh);
            ang = Math.atan2(n.y - q.y, n.x - q.x);
          }
          const L = (p.kind === 'bolt' ? 26 : 13) * q.s;
          ctx.save();
          ctx.translate(q.x, q.y); ctx.rotate(ang);
          if (p.kind === 'bolt') {
            ctx.globalAlpha = 0.25; line(ctx, -L * 2.5, 0, -L, 0, '#fff', 2); ctx.globalAlpha = 1;
            line(ctx, -L, 0, 0, 0, '#4a3220', 2.6);
            ctx.fillStyle = '#c0c0c8'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-1, -3); ctx.lineTo(-1, 3); ctx.fill();
            ctx.fillStyle = '#aa2222'; ctx.fillRect(-L, -3, 5, 6);
          } else {
            line(ctx, -L, 0, 0, 0, '#d8c49a', 1.3);
            ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-1, -1.6); ctx.lineTo(-1, 1.6); ctx.fill();
            ctx.fillStyle = p.crit ? '#ff6a4a' : '#f0f0f0'; ctx.fillRect(-L, -1.8, 3.5, 3.6);
            if (p.fire) {
              ctx.globalCompositeOperation = 'lighter';
              ctx.drawImage(this.glowFire, -8, -8, 16, 16);
              ctx.globalCompositeOperation = 'source-over';
            }
          }
          ctx.restore();
        } else if (p.kind === 'rock' || p.kind === 'boulder') {
          const big = p.kind === 'boulder';
          const r = (big ? 9 : 5.5) * q.s;
          // Тень на земле
          const gq = P(p.x, p.z, 0);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath(); ctx.ellipse(gq.x, gq.y, r * 1.2, r * 0.45, 0, 0, PI * 2); ctx.fill();
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(p.rot || 0);
          ctx.fillStyle = p.fire ? '#7a3a1a' : '#6f6860';
          ctx.beginPath();
          for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; const rr = r * (0.85 + ((i * 37) % 10) / 40); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.35, 0, PI * 2); ctx.fill();
          ctx.restore();
          if (p.fire) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(this.glowFire, q.x - r * 3, q.y - r * 3, r * 6, r * 6);
            ctx.globalCompositeOperation = 'source-over';
          }
        } else if (p.kind === 'glob') {
          circle(ctx, q.x, q.y, 3.5 * q.s, '#a6e04a');
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(this.glowGreen, q.x - 8, q.y - 8, 16, 16);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }

    drawTexts(ctx) {
      const g = this.game;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of g.texts) {
        const q = P(t.x, t.z, t.h);
        const u = t.t / t.life;
        ctx.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
        const sz = t.size * (u < 0.1 ? 0.6 + u * 4 : 1);
        ctx.font = `bold ${sz}px Philosopher, Georgia, serif`;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(t.s, q.x, q.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.s, q.x, q.y);
      }
      ctx.globalAlpha = 1;
    }

    drawLights(ctx) {
      const L = this.lights;
      if (!L || !L.length) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const l of L) {
        ctx.globalAlpha = clamp(l.a, 0, 1) * 0.55;
        const img = l.img || this.glowFire;
        ctx.drawImage(img, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      L.length = 0;
    }

    drawBossBar(ctx) {
      const b = this.game.boss;
      if (!b || b.state === 'dead') return;
      const w = 420, x = (LW - w) / 2, y = 64;
      ctx.fillStyle = 'rgba(10,6,14,0.75)';
      ctx.fillRect(x - 6, y - 22, w + 12, 40);
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 6, y - 22, w + 12, 40);
      ctx.font = 'bold 15px Philosopher, Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffcf7a';
      ctx.fillText('☠ ' + b.name + ' ☠', LW / 2, y - 9);
      ctx.fillStyle = '#2a0e10'; ctx.fillRect(x, y + 2, w, 9);
      const gr = ctx.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, '#b0202a'); gr.addColorStop(1, '#ff5a3a');
      ctx.fillStyle = gr; ctx.fillRect(x, y + 2, w * clamp(b.hp / b.maxHp, 0, 1), 9);
    }

    drawBanner(ctx, dt) {
      const b = this.banner;
      if (!b) return;
      b.t += dt;
      const D = 2.8;
      if (b.t > D) { this.banner = null; return; }
      const a = b.t < 0.3 ? b.t / 0.3 : b.t > D - 0.6 ? (D - b.t) / 0.6 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      const y = 230;
      const gr = ctx.createLinearGradient(0, 0, LW, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, 'rgba(10,5,15,0.7)'); gr.addColorStop(0.7, 'rgba(10,5,15,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, y - 46, LW, 92);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sc2 = 1 + Math.max(0, 0.3 - b.t) * 0.8;
      ctx.translate(LW / 2, y - 8); ctx.scale(sc2, sc2);
      ctx.font = 'bold 46px Philosopher, Georgia, serif';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(b.title, 0, 0);
      ctx.fillStyle = b.color; ctx.fillText(b.title, 0, 0);
      if (b.sub) {
        ctx.font = '18px Philosopher, Georgia, serif';
        ctx.fillStyle = '#e8d8c0';
        ctx.fillText(b.sub, 0, 34);
      }
      ctx.restore();
    }
  }

  function pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  TD.Renderer = Renderer;
})();
