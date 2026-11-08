/* Последний Бастион — 2.5D-сцена: фон, поселение, стена, защитники, зомби, эффекты */
(function () {
  const TD = globalThis.TD;
  const W = TD.WORLD;
  const A = TD.Art;
  const { P, ZK, PI, shade, poly, path, line, circle, ellipse, OUT, seeded } = A;
  const LW = 1280, LH = 720;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const F_ = W.WALL_FRONT, B_ = W.WALL_BACK;
  const GATE = { z0: 168, z1: 232 };
  // Угловая башня стоит на дальнем краю земли (z >= 0), ближний конец стены уходит за нижний край экрана
  const CORNER = { z0: 2, z1: 34, tz: 18, half: 16 };

  class Renderer {
    constructor(canvas, game) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.game = game;
      this.time = 0;
      this.hits = [];
      this.lights = [];
      this.hover = null;
      this.selected = null;
      this.banner = null;
      this.flashUp = {};
      this.bsprites = {};
      this.glowFire = A.makeGlow(255, 150, 50, 64);
      this.glowGreen = A.makeGlow(150, 255, 90, 48);
      this.glowBlue = A.makeGlow(90, 180, 255, 64);
      this.glowWhite = A.makeGlow(255, 240, 210, 48);
      this.glowPurple = A.makeGlow(190, 90, 255, 48);
      this.shadowImg = document.createElement('canvas');
      this.shadowImg.width = 64; this.shadowImg.height = 64;
      { const x = this.shadowImg.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
      this.clouds = [];
      const r = seeded(7);
      for (let i = 0; i < 7; i++) this.clouds.push({ x: r() * 1500 - 100, y: 40 + r() * 170, w: 160 + r() * 260, sp: 4 + r() * 8, a: 0.1 + r() * 0.14 });
      this.resize();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = Math.max(1, Math.round(rect.width * dpr)), ch = Math.max(1, Math.round(rect.height * dpr));
      if (this.canvas.width !== cw) this.canvas.width = cw;
      if (this.canvas.height !== ch) this.canvas.height = ch;
      this.dpr = dpr;
      this.scale = Math.min(rect.width / LW, rect.height / LH) || 1;
      this.ox = (rect.width - LW * this.scale) / 2;
      this.oy = (rect.height - LH * this.scale) / 2;
      // Нижняя видимая граница сцены: стена должна уходить за неё, а не обрываться
      this.viewPad = this.oy / this.scale;
      this.wallEnd = Math.max(460, Math.ceil((LH + this.viewPad + 90 - W.GY0) / ZK));
      const k = this.scale * dpr;
      if (k !== this.k) { this.k = k; this.bsprites = {}; this.wallKey = null; }
      TD.ZArt.setRes(Math.max(1.5, Math.min(3, this.k * 1.05)));
      this.bg = this.layer((c) => this.drawBackground(c));
      this.fog = this.layer((c) => this.drawFogOverlay(c));
      this.vig = null;
    }

    layer(fn) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(LW * this.k));
      c.height = Math.max(1, Math.round(LH * this.k));
      const x = c.getContext('2d');
      x.setTransform(this.k, 0, 0, this.k, 0, 0);
      x.lineJoin = 'round';
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
    lightAt(x, y, r, a, img) { this.lights.push({ x, y, r, a, img }); }

    // ================= Статичный фон =================
    drawBackground(c) {
      const r = seeded(42);
      const sky = c.createLinearGradient(0, 0, 0, W.GY0 + 20);
      sky.addColorStop(0, '#070a1c'); sky.addColorStop(0.45, '#1c1840'); sky.addColorStop(0.78, '#5b2a4e'); sky.addColorStop(1, '#b4524a');
      c.fillStyle = sky; c.fillRect(0, 0, LW, W.GY0 + 30);
      for (let i = 0; i < 180; i++) {
        const y = r() * 240;
        c.globalAlpha = (0.3 + r() * 0.7) * (1 - y / 270);
        c.fillStyle = '#fff';
        c.fillRect(r() * LW, y, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1);
      }
      c.globalAlpha = 1;
      const mx = 1010, my = 95;
      const mg = c.createRadialGradient(mx, my, 10, mx, my, 150);
      mg.addColorStop(0, 'rgba(255,230,200,0.35)'); mg.addColorStop(1, 'rgba(255,230,200,0)');
      c.fillStyle = mg; c.fillRect(mx - 160, my - 160, 320, 320);
      const mgr = c.createRadialGradient(mx - 10, my - 10, 4, mx, my, 34);
      mgr.addColorStop(0, '#fff6e0'); mgr.addColorStop(1, '#e0cfa8');
      circle(c, mx, my, 34, mgr);
      for (const [dx, dy, rr] of [[-10, -6, 7], [12, 10, 5], [6, -14, 4], [-4, 14, 3]]) circle(c, mx + dx, my + dy, rr, 'rgba(170,150,120,0.3)');
      const ridge = (base, amp, color, seed, step) => {
        const rr = seeded(seed);
        c.beginPath(); c.moveTo(0, W.GY0 + 5);
        let y = base;
        for (let x = 0; x <= LW + step; x += step) { y = clamp(y + (rr() - 0.5) * amp, base - amp * 1.6, base + amp * 0.8); c.lineTo(x, y); }
        c.lineTo(LW, W.GY0 + 5); c.closePath(); c.fillStyle = color; c.fill();
      };
      ridge(230, 38, '#2b2142', 3, 40);
      ridge(262, 26, '#21193a', 9, 28);
      c.fillStyle = '#1a1430';
      c.fillRect(860, 268, 10, 30); c.fillRect(876, 278, 22, 20); c.fillRect(902, 262, 9, 36);
      for (let i = 0; i < 4; i++) c.fillRect(876 + i * 6, 274, 3, 4);
      const hz = c.createLinearGradient(0, 250, 0, W.GY0 + 10);
      hz.addColorStop(0, 'rgba(170,80,90,0)'); hz.addColorStop(1, 'rgba(120,60,80,0.55)');
      c.fillStyle = hz; c.fillRect(0, 250, LW, W.GY0 - 240);
      const tr = seeded(11);
      for (let x = -10; x < LW + 10; x += 5 + tr() * 7) {
        const h = 14 + tr() * 24, y = W.GY0 + 4;
        c.fillStyle = tr() < 0.5 ? '#150f22' : '#1a1428';
        c.beginPath(); c.moveTo(x - h * 0.3, y); c.lineTo(x, y - h); c.lineTo(x + h * 0.3, y); c.fill();
      }
      const g = c.createLinearGradient(0, W.GY0, 0, LH);
      g.addColorStop(0, '#2b2a2c'); g.addColorStop(0.3, '#33362b'); g.addColorStop(1, '#2c3424');
      c.fillStyle = g; c.fillRect(0, W.GY0, LW, LH - W.GY0);
      for (let i = 0; i < 110; i++) {
        const x = F_ + 20 + r() * 900, z = r() * 400, p = P(x, z, 0);
        c.fillStyle = r() < 0.5 ? 'rgba(70,58,44,0.32)' : 'rgba(40,52,32,0.32)';
        c.beginPath(); c.ellipse(p.x, p.y, (20 + r() * 50) * p.s, (8 + r() * 18) * p.s, 0, 0, PI * 2); c.fill();
      }
      poly(c, [P(F_, GATE.z0 + 4, 0), P(1500, 140, 0), P(1500, 262, 0), P(F_, GATE.z1 - 4, 0)], 'rgba(86,70,52,0.5)');
      for (const zz of [188, 212]) { const a = P(F_ + 10, zz, 0), b = P(1500, zz + (zz < 200 ? -12 : 12), 0); line(c, a.x, a.y, b.x, b.y, 'rgba(40,30,22,0.35)', 2); }
      for (let i = 0; i < 700; i++) {
        const x = -200 + r() * 1700, z = r() * 400, p = P(x, z, 0);
        if (x > B_ - 10 && x < F_ + 22) continue;
        const t = r();
        if (t < 0.62) {
          c.strokeStyle = r() < 0.5 ? 'rgba(90,110,60,0.6)' : 'rgba(60,80,45,0.6)';
          c.lineWidth = 1; c.beginPath();
          for (let k = -1; k <= 1; k++) { c.moveTo(p.x + k * 2 * p.s, p.y); c.lineTo(p.x + k * 3.5 * p.s, p.y - (4 + r() * 4) * p.s); }
          c.stroke();
        } else if (t < 0.82) {
          ellipse(c, p.x, p.y, (2 + r() * 3) * p.s, (1.3 + r() * 2) * p.s, 0, r() < 0.5 ? '#4a4741' : '#3d3a35');
        } else if (x > F_ + 80 && r() < 0.18) {
          ellipse(c, p.x, p.y - 2 * p.s, 3 * p.s, 2.6 * p.s, 0, '#b9b0a0');
          c.fillStyle = '#222'; c.fillRect(p.x - 1.6 * p.s, p.y - 2.6 * p.s, p.s, p.s); c.fillRect(p.x + 0.6 * p.s, p.y - 2.6 * p.s, p.s, p.s);
        }
      }
      for (let i = 0; i < 7; i++) {
        const x = 700 + r() * 600, z = r() < 0.5 ? r() * 60 : 340 + r() * 60, p = P(x, z, 0), s = p.s;
        if (i < 3) {
          c.strokeStyle = '#1e1814'; c.lineCap = 'round';
          c.lineWidth = 3 * s; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 2 * s, p.y - 34 * s); c.stroke();
          c.lineWidth = 1.5 * s; c.beginPath();
          c.moveTo(p.x + 1.5 * s, p.y - 22 * s); c.lineTo(p.x - 10 * s, p.y - 34 * s);
          c.moveTo(p.x + 2 * s, p.y - 28 * s); c.lineTo(p.x + 12 * s, p.y - 40 * s);
          c.moveTo(p.x - 6 * s, p.y - 29 * s); c.lineTo(p.x - 8 * s, p.y - 40 * s); c.stroke();
        } else {
          c.fillStyle = '#4a4850'; c.beginPath(); c.moveTo(p.x - 4 * s, p.y); c.lineTo(p.x - 4 * s, p.y - 9 * s); c.arc(p.x, p.y - 9 * s, 4 * s, PI, 0); c.lineTo(p.x + 4 * s, p.y); c.fill();
          c.strokeStyle = '#2a282e'; c.lineWidth = 0.7; c.stroke();
          line(c, p.x, p.y - 11 * s, p.x, p.y - 5 * s, '#2a282e', 0.8); line(c, p.x - 2 * s, p.y - 9 * s, p.x + 2 * s, p.y - 9 * s, '#2a282e', 0.8);
        }
      }
      poly(c, [P(-300, 0, 0), P(B_, 0, 0), P(B_, 400, 0), P(-300, 400, 0)], 'rgba(70,60,48,0.35)');
      const cob = (x0, x1, z0, z1) => {
        for (let z = z0; z < z1; z += 4) for (let x = x0 + ((z / 4) % 2) * 3; x < x1; x += 6) {
          const p = P(x, z, 0);
          c.fillStyle = `rgba(${110 + r() * 30},${100 + r() * 25},${88 + r() * 20},0.5)`;
          c.beginPath(); c.ellipse(p.x, p.y, 2.5 * p.s, 1.4 * p.s, 0, 0, PI * 2); c.fill();
        }
      };
      cob(-60, B_ - 4, 178, 222);
      cob(160, 200, 0, 400);
      cob(260, 330, 120, 280);
    }

    drawFogOverlay(c) {
      const f = c.createLinearGradient(1090, 0, LW, 0);
      f.addColorStop(0, 'rgba(25,22,40,0)'); f.addColorStop(0.6, 'rgba(25,22,40,0.4)'); f.addColorStop(1, 'rgba(18,15,30,0.85)');
      c.fillStyle = f; c.fillRect(1090, W.GY0 - 60, LW - 1090, LH - W.GY0 + 60);
    }

    // ================= Главный кадр =================
    render(dt) {
      const g = this.game;
      this.time += dt;
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const hy = (this.oy + W.GY0 * this.scale) * this.dpr;
      ctx.fillStyle = '#070a1c'; ctx.fillRect(0, 0, this.canvas.width, hy);
      ctx.fillStyle = '#2c3424'; ctx.fillRect(0, hy, this.canvas.width, this.canvas.height - hy);
      const sh = g.shake;
      const sx = sh ? (Math.random() - 0.5) * sh : 0, sy = sh ? (Math.random() - 0.5) * sh : 0;
      ctx.setTransform(this.k, 0, 0, this.k, this.dpr * this.ox + sx * this.k, this.dpr * this.oy + sy * this.k);
      ctx.lineJoin = 'round';
      ctx.save();
      ctx.beginPath(); ctx.rect(-20, -this.viewPad - 20, LW + 40, LH + this.viewPad * 2 + 40); ctx.clip();
      ctx.drawImage(this.bg, 0, 0, LW, LH);
      // Продолжение земли поселения ниже кадра (для высоких экранов)
      if (this.viewPad > 1) poly(ctx, [P(-300, 400, 0), P(B_, 400, 0), P(B_, this.wallEnd, 0), P(-300, this.wallEnd, 0)], 'rgba(70,60,48,0.35)');
      this.hits = [];
      this.drawClouds(ctx, dt);
      this.drawDecals(ctx);
      this.ambient(dt);
      this.drawSettlement(ctx);
      this.drawWall(ctx);
      this.drawPools(ctx);
      this.drawZombies(ctx);
      this.drawParticles(ctx);
      this.drawProjectiles(ctx);
      this.drawTexts(ctx);
      ctx.drawImage(this.fog, 0, 0, LW, LH);
      this.drawLights(ctx);
      ctx.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const cw = this.canvas.width, ch = this.canvas.height;
      if (!this.vig) {
        const v = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.45, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
        this.vig = v;
      }
      ctx.fillStyle = this.vig; ctx.fillRect(0, 0, cw, ch);
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
        ctx.ellipse(c.x - c.w * 0.2, c.y - 5, c.w * 0.2, 10, 0, 0, PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ambient(dt) {
      const g = this.game;
      if (g.particles.length > 1200) return;
      const r = Math.random;
      const B = (id) => TD.ITEMS[id].pos;
      if (r() < dt * 7) { const f = B('forge'); g.particle('smoke', f.x - 20, f.z, f.h + 46, { vh: 18, vx: 6, life: 2.6, size: 6 + r() * 4, color: '#3a3640' }); }
      if (r() < dt * 3) { const f = B('forge'); for (let i = 0; i < 3; i++) g.particle('spark', f.x + 18, f.z + f.d / 2 + 4, 6, { vh: 40 + r() * 70, vx: (r() - 0.5) * 50, vz: 10 + r() * 30, life: 0.5, size: 1.6 }); }
      if (r() < dt * 5) { const a = B('alchemy'); g.particle('magic', a.x + a.w / 2 + 16 + (r() - 0.5) * 8, a.z + a.d / 2 + 6, 14, { vh: 20 + r() * 20, life: 1.0, size: 2 + r() * 2, color: 'green' }); }
      if (r() < dt * 2.5) { const t = B('townhall'); g.particle('smoke', t.x - t.w / 2 + 16, t.z - t.d / 2 + 14, t.h + 54, { vh: 14, vx: 5, life: 2.5, size: 5, color: '#3a3640' }); }
      if (g.phase === 'battle' || g.phase === 'defeat') {
        const f = g.wallHp / g.wallMax;
        if (f < 0.35 && r() < dt * (8 * (1 - f))) {
          const z = r() * 400;
          g.particle(r() < 0.5 ? 'fire' : 'smoke', F_ - 5, z, g.wallH * (0.6 + r() * 0.4), { vh: 30 + r() * 30, life: 1 + r(), size: 6 + r() * 6, color: '#2a2630' });
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
      if (!this.decor) {
        const r = seeded(5);
        this.decor = [];
        const trees = [[-70, 20], [-40, 120], [-90, 260], [-30, 392], [20, 130], [270, 0], [140, 8], [-120, 70], [-60, 330], [395, 398], [-10, 250]];
        for (const [x, z] of trees) this.decor.push({ k: 'tree', x, z, s: 0.8 + r() * 0.5, seed: r() });
        this.decor.push({ k: 'well', x: 175, z: 280 });
        this.decor.push({ k: 'cart', x: 300, z: 102 });
        this.decor.push({ k: 'barrels', x: 352, z: 384 });
        this.decor.push({ k: 'lamp', x: 150, z: 160 });
        this.decor.push({ k: 'lamp', x: 300, z: 238 });
        this.decor.push({ k: 'lamp', x: 440, z: 165 });
        this.decor.push({ k: 'fence', x: -40, z: 120 });
        this.decor.push({ k: 'campfire', x: 400, z: 250 });
      }
      for (const d of this.decor) list.push({ z: d.z, f: () => this.drawDecor(ctx, d) });
      list.sort((a, b) => a.z - b.z);
      for (const it of list) it.f();
    }

    drawDecor(ctx, d) {
      const p = P(d.x, d.z, 0), s = p.s;
      if (d.k === 'tree') {
        const k = s * d.s;
        ellipse(ctx, p.x + 4 * k, p.y, 17 * k, 6 * k, 0, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = A.lit(ctx, p.x, p.y - 8 * k, 4 * k, '#3a2a1c'); ctx.fillRect(p.x - 2.5 * k, p.y - 15 * k, 5 * k, 15 * k);
        const sway = Math.sin(this.time * 0.8 + d.seed * 10) * 1.5 * k;
        for (let i = 0; i < 4; i++) {
          const y = p.y - (12 + i * 12) * k, w = (21 - i * 4.5) * k, top = y - 20 * k;
          const gr = ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
          gr.addColorStop(0, '#2e4a36'); gr.addColorStop(0.55, '#1f3628'); gr.addColorStop(1, '#122018');
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.moveTo(p.x - w, y);
          for (let j = 1; j < 6; j++) ctx.lineTo(p.x - w + (w * 2 * j) / 6, y + (j % 2 ? 2.5 : 0) * k);
          ctx.lineTo(p.x + w, y); ctx.lineTo(p.x + sway * (i + 1) * 0.4, top); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(8,14,10,0.6)'; ctx.lineWidth = 0.5; ctx.stroke();
        }
      } else if (d.k === 'well') {
        ellipse(ctx, p.x, p.y, 16 * s, 6 * s, 0, 'rgba(0,0,0,0.3)');
        const gr = ctx.createLinearGradient(p.x - 13 * s, 0, p.x + 13 * s, 0); gr.addColorStop(0, '#8a857c'); gr.addColorStop(1, '#4a4640');
        ctx.fillStyle = gr; ctx.fillRect(p.x - 13 * s, p.y - 10 * s, 26 * s, 10 * s);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.4;
        for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(p.x - 13 * s, p.y - (3.5 + i * 3.5) * s); ctx.lineTo(p.x + 13 * s, p.y - (3.5 + i * 3.5) * s); ctx.stroke(); }
        ellipse(ctx, p.x, p.y - 10 * s, 13 * s, 5 * s, 0, '#6a665e', OUT, 0.5);
        ellipse(ctx, p.x, p.y - 10 * s, 9.5 * s, 3.4 * s, 0, '#0e141c');
        for (const xx of [-11, 11]) { ctx.fillStyle = '#4a3220'; ctx.fillRect(p.x + xx * s - 1.2 * s, p.y - 32 * s, 2.4 * s, 22 * s); }
        line(ctx, p.x - 11 * s, p.y - 27 * s, p.x + 11 * s, p.y - 27 * s, '#3a2618', 1.6 * s);
        line(ctx, p.x + 2 * s, p.y - 27 * s, p.x + 2 * s, p.y - 16 * s, '#c8b48a', 0.5);
        ctx.fillStyle = '#5a3a20'; ctx.fillRect(p.x, p.y - 17 * s, 4 * s, 3.5 * s);
        poly(ctx, [{ x: p.x - 17 * s, y: p.y - 29 * s }, { x: p.x, y: p.y - 40 * s }, { x: p.x + 17 * s, y: p.y - 29 * s }], '#6a3a26', OUT, 0.5);
      } else if (d.k === 'cart') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(s, s);
        ellipse(ctx, 0, 0, 20, 5, 0, 'rgba(0,0,0,0.3)');
        TD.UArt.beam(ctx, -16, -9, 14, -9, 4, '#7a5432');
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-16, -17, 30, 7); ctx.strokeStyle = OUT; ctx.lineWidth = 0.5; ctx.strokeRect(-16, -17, 30, 7);
        for (let i = 0; i < 4; i++) circle(ctx, -11 + i * 6, -19, 3.5, ['#b49448', '#a68a40', '#b49448', '#9a7e3a'][i], OUT, 0.4);
        TD.UArt.beam(ctx, 14, -9, 28, -4, 1.6, '#5a3e24');
        TD.UArt.wheel(ctx, -6, -5, 5.5, '#6a4a2a', 0.3);
        ctx.restore();
      } else if (d.k === 'barrels') {
        for (let i = 0; i < 3; i++) {
          const q = P(d.x + (i % 2) * 14, d.z + (i >> 1) * 12 - 6, 0);
          const gr = ctx.createLinearGradient(q.x - 6 * s, 0, q.x + 6 * s, 0); gr.addColorStop(0, '#8a5a30'); gr.addColorStop(0.5, '#6a4426'); gr.addColorStop(1, '#3a2414');
          ctx.fillStyle = gr; ctx.fillRect(q.x - 6 * s, q.y - 15 * s, 12 * s, 15 * s);
          ellipse(ctx, q.x, q.y - 15 * s, 6 * s, 2.5 * s, 0, '#7a5232', OUT, 0.4);
          line(ctx, q.x - 6 * s, q.y - 4 * s, q.x + 6 * s, q.y - 4 * s, '#2b2b2b', 1.2 * s);
          line(ctx, q.x - 6 * s, q.y - 11 * s, q.x + 6 * s, q.y - 11 * s, '#2b2b2b', 1.2 * s);
        }
      } else if (d.k === 'lamp') {
        line(ctx, p.x, p.y, p.x, p.y - 34 * s, '#25211d', 2.5 * s);
        line(ctx, p.x, p.y - 34 * s, p.x + 5 * s, p.y - 34 * s, '#25211d', 1.5 * s);
        ctx.fillStyle = '#2a2a2e'; ctx.fillRect(p.x + 2 * s, p.y - 34 * s, 6 * s, 7 * s);
        ctx.fillStyle = '#ffcf6a'; ctx.fillRect(p.x + 3 * s, p.y - 33 * s, 4 * s, 5 * s);
        this.lightAt(p.x + 5 * s, p.y - 30 * s, 48 * s, 0.55);
      } else if (d.k === 'fence') {
        for (let i = 0; i < 8; i++) {
          const a = P(d.x - 50, d.z - 50 + i * 14, 0), b = P(d.x - 50, d.z - 50 + i * 14, 12);
          line(ctx, a.x, a.y, b.x, b.y, '#4a3220', 1.6 * a.s);
          if (i) {
            for (const hh of [9, 4]) { const pa = P(d.x - 50, d.z - 64 + i * 14, hh), pb = P(d.x - 50, d.z - 50 + i * 14, hh); line(ctx, pa.x, pa.y, pb.x, pb.y, '#5a3e24', 1.2 * a.s); }
          }
        }
      } else if (d.k === 'campfire') {
        ellipse(ctx, p.x, p.y, 9 * s, 3.5 * s, 0, '#2a2420');
        for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; ellipse(ctx, p.x + Math.cos(a) * 8 * s, p.y + Math.sin(a) * 3 * s, 2 * s, 1.3 * s, 0, '#5a5650'); }
        line(ctx, p.x - 5 * s, p.y - 1, p.x + 5 * s, p.y - 3, '#4a2e1a', 1.6 * s);
        line(ctx, p.x - 5 * s, p.y - 3, p.x + 5 * s, p.y - 1, '#3a2414', 1.6 * s);
        const fl = Math.sin(this.time * 17) * 1.5;
        ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(p.x - 4 * s, p.y - 2); ctx.quadraticCurveTo(p.x, p.y - (14 + fl) * s, p.x + 4 * s, p.y - 2); ctx.fill();
        ctx.fillStyle = '#ffd86a'; ctx.beginPath(); ctx.moveTo(p.x - 2 * s, p.y - 2); ctx.quadraticCurveTo(p.x, p.y - (8 - fl) * s, p.x + 2 * s, p.y - 2); ctx.fill();
        this.lightAt(p.x, p.y - 6 * s, 60 * s, 0.7);
        if (Math.random() < 0.08) this.game.particle('spark', d.x, d.z, 6, { vh: 50, vx: (Math.random() - 0.5) * 20, life: 0.8, size: 1.4 });
        const q = P(d.x - 14, d.z + 6, 0);
        ctx.save(); ctx.translate(q.x, q.y); ctx.scale(q.s, q.s);
        TD.UArt.drawCrew(ctx, { tunic: '#4a5a6a' });
        line(ctx, 6, -26, 6, 0, '#5a3e24', 1);
        ctx.fillStyle = '#c8ccd4'; ctx.beginPath(); ctx.moveTo(6, -31); ctx.lineTo(7.3, -26); ctx.lineTo(4.7, -26); ctx.fill();
        ctx.restore();
      }
    }

    buildingSprite(b) {
      const lvl = this.game.levels[b.id];
      const tier = TD.Bld.tier(lvl);
      let s = this.bsprites[b.id];
      if (!s || s.tier !== tier) {
        s = TD.Bld.sprite(b, lvl, this.k);
        s.tier = tier;
        this.bsprites[b.id] = s;
      }
      return s;
    }

    drawBuilding(ctx, b) {
      const g = this.game;
      const lvl = g.levels[b.id];
      const { x, z, w, d, h } = b.pos;
      const t = this.time;
      const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
      poly(ctx, [P(x0 + 6, z1 + 10, 0), P(x1 + 18, z1 + 10, 0), P(x1 + 18, z0 + 4, 0), P(x0 + 6, z0 + 4, 0)], 'rgba(0,0,0,0.28)');
      if (this.hover === b.id || this.selected === b.id) {
        const c0 = P(x, z, 0);
        ctx.strokeStyle = `rgba(255,214,110,${0.55 + Math.sin(t * 5) * 0.25})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(c0.x, c0.y, w * 0.68 * c0.s, d * 0.66 * ZK, 0, 0, PI * 2); ctx.stroke();
      }
      const sp = this.buildingSprite(b);
      ctx.drawImage(sp.img, sp.bb.x0, sp.bb.y0, sp.bb.x1 - sp.bb.x0, sp.bb.y1 - sp.bb.y0);
      const m = sp.meta;
      for (const L of m.lights) {
        const fl = L.flick ? 0.85 + Math.sin(t * (L.flick === 2 ? 9 : 3) + L.x) * 0.15 : 1;
        this.lightAt(L.x, L.y, L.r, L.a * fl, L.green ? this.glowGreen : null);
      }
      if (b.id === 'townhall') {
        const cp = m.clock, an = t * 0.5;
        line(ctx, cp.x, cp.y, cp.x + Math.cos(an) * 5 * cp.s, cp.y + Math.sin(an) * 5 * cp.s, '#222', 0.9);
        line(ctx, cp.x, cp.y, cp.x + Math.cos(an / 12) * 3.5 * cp.s, cp.y + Math.sin(an / 12) * 3.5 * cp.s, '#222', 1.3);
        this.flag(ctx, m.flag, '#b8262a', 22, lvl >= 4 ? '#e8c060' : null);
      } else if (b.id === 'forge') {
        const hp = m.smith, s = hp.s;
        const sw = Math.max(0, Math.sin(t * 5));
        ctx.save(); ctx.translate(hp.x, hp.y); ctx.scale(-s, s);
        TD.UArt.drawCrew(ctx, { tunic: '#5a3a2a' });
        const ha = -1.6 + sw * 1.9;
        const hx = 1.5 + Math.cos(ha + PI) * 11, hy = -17 + Math.sin(ha + PI) * 11;
        line(ctx, 1.5, -17, hx, hy, '#6b4a2a', 1.6);
        ctx.fillStyle = '#4a4a52'; ctx.fillRect(hx - 2.5, hy - 2, 5, 4);
        ctx.restore();
        if (sw > 0.97 && Math.random() < 0.5) for (let i = 0; i < 4; i++) g.particle('spark', x1 + 14, z1 + 10, 12, { vh: 60 + Math.random() * 60, vx: (Math.random() - 0.5) * 80, vz: (Math.random() - 0.5) * 40, life: 0.4, size: 1.4 });
        this.lightAt(m.anvil.x, m.anvil.y - 10, 26, 0.35 + sw * 0.3);
      } else if (b.id === 'workshop') {
        const p = m.gear, R = 9 * p.s;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 0.8);
        ctx.beginPath();
        for (let i = 0; i < 20; i++) { const a = (i / 20) * PI * 2, rr = i % 2 ? R : R * 1.28; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fillStyle = A.lit(ctx, 0, 0, R, '#8a8070'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.5; ctx.stroke();
        circle(ctx, 0, 0, R * 0.55, '#6a6050', OUT, 0.4);
        for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2; line(ctx, 0, 0, Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, '#4a4036', 1); }
        circle(ctx, 0, 0, R * 0.2, '#3a3028');
        ctx.restore();
      } else if (b.id === 'alchemy') {
        const c = m.cauldron, s = c.s;
        line(ctx, c.x - 8 * s, c.y, c.x - 5 * s, c.y - 8 * s, '#222', 1.5);
        line(ctx, c.x + 8 * s, c.y, c.x + 5 * s, c.y - 8 * s, '#222', 1.5);
        ellipse(ctx, c.x, c.y - 2, 5 * s, 2 * s, 0, '#ff8a2a');
        const gr = ctx.createLinearGradient(c.x - 9 * s, 0, c.x + 9 * s, 0); gr.addColorStop(0, '#4a4a52'); gr.addColorStop(1, '#141418');
        ellipse(ctx, c.x, c.y - 10 * s, 9 * s, 7 * s, 0, gr, OUT, 0.5);
        ellipse(ctx, c.x, c.y - 15 * s, 8 * s, 2.5 * s, 0, '#7dff5a');
        const bub = (t * 2) % 1;
        circle(ctx, c.x - 3 * s + Math.sin(t * 3) * 2 * s, c.y - 15 * s - bub * 2, (0.6 + bub) * s, '#d6ffb0');
        this.lightAt(c.x, c.y - 15, 28, 0.55, this.glowGreen);
        if (lvl >= 4) this.flag(ctx, m.apex, '#7a3bb0', 18, lvl >= 8 ? '#e8c060' : null);
      }
      if ((b.id === 'forge' || b.id === 'range' || b.id === 'workshop' || b.id === 'masonry') && lvl >= 4) {
        const fp = P(x0 - 4, z, h + h * 0.55 + 8);
        this.flag(ctx, fp, b.id === 'forge' ? '#b8262a' : b.id === 'range' ? '#2c6a3a' : b.id === 'workshop' ? '#c88a2a' : '#3a5a8a', 16, lvl >= 8 ? '#e8c060' : null);
      }
      const top = P(x, z, b.pos.badge || h + 62);
      this.levelBadge(ctx, top.x, top.y, lvl, TD.ITEMS[b.id].max, g.canUpgrade(b.id));
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

    flag(ctx, base, color, len, trim) {
      const t = this.time;
      line(ctx, base.x, base.y + 2, base.x, base.y - len, '#2a221c', 1.4);
      circle(ctx, base.x, base.y - len - 1, 1.2, trim || '#8a8a92');
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - len);
      for (let i = 0; i <= 8; i++) { const u = i / 8; ctx.lineTo(base.x + u * 17, base.y - len + Math.sin(t * 5 - u * 4) * 2.4 * u); }
      ctx.lineTo(base.x + 14, base.y - len + 5 + Math.sin(t * 5 - 4) * 2.4);
      for (let i = 8; i >= 0; i--) { const u = i / 8; ctx.lineTo(base.x + u * 17, base.y - len + 10 + Math.sin(t * 5 - u * 4) * 2.4 * u); }
      ctx.closePath();
      const gr = ctx.createLinearGradient(base.x, 0, base.x + 17, 0); gr.addColorStop(0, shade(color, 1.15)); gr.addColorStop(1, shade(color, 0.65));
      ctx.fillStyle = gr; ctx.fill();
      if (trim) { ctx.strokeStyle = trim; ctx.lineWidth = 0.8; ctx.stroke(); }
    }

    levelBadge(ctx, x, y, lvl, max, can) {
      const t = this.time;
      ctx.save();
      ctx.translate(x, y);
      const full = lvl >= max;
      ctx.beginPath();
      ctx.moveTo(-10, -11); ctx.lineTo(10, -11); ctx.lineTo(10, 3); ctx.quadraticCurveTo(10, 11, 0, 14); ctx.quadraticCurveTo(-10, 11, -10, 3); ctx.closePath();
      const gr = ctx.createLinearGradient(0, -11, 0, 14);
      gr.addColorStop(0, full ? '#e8b84a' : '#3a2d4c'); gr.addColorStop(1, full ? '#8a6418' : '#1a1424');
      ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = full ? '#fff0b0' : '#d8b060'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,230,160,0.25)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-7.5, -8.5); ctx.lineTo(7.5, -8.5); ctx.stroke();
      ctx.fillStyle = full ? '#3a2a08' : '#fff0c8';
      ctx.font = 'bold 11px "Alegreya SC", Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(full ? '★' : String(lvl), 0, 0.5);
      if (can && !full) {
        const by = -22 + Math.sin(t * 5) * 3;
        ctx.save(); ctx.shadowColor = '#7dff6a'; ctx.shadowBlur = 6;
        ctx.fillStyle = '#7dff6a';
        ctx.beginPath(); ctx.moveTo(0, by - 7); ctx.lineTo(7, by + 1); ctx.lineTo(2.5, by + 1); ctx.lineTo(2.5, by + 6); ctx.lineTo(-2.5, by + 6); ctx.lineTo(-2.5, by + 1); ctx.lineTo(-7, by + 1); ctx.closePath();
        ctx.fill(); ctx.restore();
        ctx.strokeStyle = '#0a3a0a'; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.restore();
    }

    // ================= Осадные машины =================
    drawCatapult(ctx, c) {
      const g = this.game;
      const p = P(c.x, c.z, 0);
      const s = p.s * 1.1;
      const far = P(c.x, c.z - 13, 0);
      const appear = clamp(c.built / 0.6, 0, 1);
      const a = c.anim;
      const rest = PI - 0.18, fire = PI / 2 - 0.35;
      const interval = TD.S.catapultInterval(g.levels.catapult, g.mods);
      const rl = Math.max(0.8, interval - 0.6);
      let th, crank = 0, reloading = false;
      if (a < 0.2) th = lerp(rest, fire, (a / 0.2) * (a / 0.2));
      else if (a < 0.45) th = fire + Math.sin((a - 0.2) * 30) * 0.08 * (1 - (a - 0.2) / 0.25);
      else { const u = clamp((a - 0.45) / rl, 0, 1); th = lerp(fire, rest, ease(u)); reloading = u < 1; crank = a * 5; }
      const loaded = a > 0.45 + rl * 0.92 || (c.shot && a < 0.22) || g.phase !== 'battle';
      ctx.save();
      ctx.translate(p.x, p.y + (1 - appear) * 20);
      ctx.globalAlpha = appear;
      ellipse(ctx, 4 * s, 0, 34 * s, 9 * s, 0, 'rgba(0,0,0,0.3)');
      ctx.scale(s, s);
      TD.UArt.drawCatapult(ctx, { arm: th, loaded, fire: g.mods.fireRocks, fdx: (far.x - p.x) / s, fdy: (far.y - p.y) / s, crank, cocked: !reloading && a > 0.45 });
      ctx.save(); ctx.translate(-34, 2);
      TD.UArt.drawCrew(ctx, { pose: reloading ? 'crank' : 'stand', phase: crank * 1.5, tunic: '#6a3a2a' });
      ctx.restore();
      ctx.restore();
      ctx.globalAlpha = 1;
      if (this.hover === 'catapult' || this.selected === 'catapult') { ctx.strokeStyle = 'rgba(255,214,110,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x + 4 * s, p.y, 38 * s, 11 * s, 0, 0, PI * 2); ctx.stroke(); }
      this.hits.push({ id: 'catapult', x0: p.x - 40 * s, y0: p.y - 50 * s, x1: p.x + 30 * s, y1: p.y + 6 });
    }

    drawTrebuchet(ctx, tr) {
      const g = this.game;
      const p = P(tr.x, tr.z, 0);
      const s = p.s * 1.12;
      const far = P(tr.x, tr.z - 20, 0);
      const appear = clamp(tr.built / 0.8, 0, 1);
      const a = tr.anim;
      const rest = PI + 0.95, end = PI / 2 - 0.65, swing = 0.85;
      const interval = TD.S.trebInterval(g.levels.trebuchet, g.mods);
      let th, sling, cwSwing = 0, reloading = false;
      if (a < swing) {
        const u = a / swing, e = u * u;
        th = lerp(rest, end, e);
        sling = u < 0.5 ? lerp(0.05, -PI / 2, u / 0.5) : lerp(-PI / 2, end + 0.3, (u - 0.5) / 0.5);
        cwSwing = -0.25 * u;
      } else {
        const u = clamp((a - swing - 0.6) / Math.max(1, interval - swing - 1.6), 0, 1);
        th = a < swing + 0.6 ? end + Math.sin((a - swing) * 14) * 0.06 * (1 - (a - swing) / 0.6) : lerp(end, rest, ease(u));
        sling = a < swing + 0.6 ? end - 0.6 + Math.sin((a - swing) * 10) * 0.6 : lerp(-PI / 2 + th - end, 0.05, ease(u));
        cwSwing = Math.sin((a - swing) * 7) * 0.35 * Math.exp(-(a - swing) * 1.2);
        reloading = u > 0 && u < 1;
      }
      const loaded = !(a >= 0.75 && a < interval - 1.2) || (tr.shot && a < 0.75) || g.phase !== 'battle';
      ctx.save();
      ctx.translate(p.x, p.y + (1 - appear) * 30);
      ctx.globalAlpha = appear;
      ellipse(ctx, 0, 0, 52 * s, 13 * s, 0, 'rgba(0,0,0,0.3)');
      ctx.scale(s, s);
      TD.UArt.drawTrebuchet(ctx, { arm: th, sling, loaded, fire: g.mods.fireRocks, fdx: (far.x - p.x) / s, fdy: (far.y - p.y) / s, cwSwing });
      ctx.save(); ctx.translate(-50, 3);
      TD.UArt.drawCrew(ctx, { pose: reloading ? 'crank' : 'stand', phase: a * 6, tunic: '#4a3a5a' });
      ctx.restore();
      ctx.restore();
      ctx.globalAlpha = 1;
      if (this.hover === 'trebuchet' || this.selected === 'trebuchet') { ctx.strokeStyle = 'rgba(255,214,110,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, 56 * s, 14 * s, 0, 0, PI * 2); ctx.stroke(); }
      this.hits.push({ id: 'trebuchet', x0: p.x - 56 * s, y0: p.y - 112 * s, x1: p.x + 50 * s, y1: p.y + 8 });
    }

    // ================= Стена =================
    // Стена режется на куски (участки между башнями и сами башни). Каждый кусок кешируется
    // отдельным спрайтом и рисуется по глубине вместе с лучниками, баллистами, котлами и факелами.
    wallPieces() {
      const g = this.game;
      const key = g.wallTier + ':' + g.levels.wall + ':' + g.ballistas.length + ':' + this.k + ':' + this.wallEnd;
      if (key === this.wallKey && this.pieces) return this.pieces;
      this.wallKey = key;
      const H = g.wallH, tier = g.wallTier;
      const base = ['#6e4f30', '#8a857c', '#6a6670'][tier];
      const rnd = seeded(99 + g.levels.wall);
      const pieces = [];
      const add = (k, x0, x1, z0, z1, h1, fn) => pieces.push(Object.assign({ key: k }, this.piece(x0, x1, z0, z1, h1, fn)));
      add(CORNER.z0, B_ - 6, F_ + 16, CORNER.z0, CORNER.z1, H + 18 + 9 + 52, (c) => this.paintTower(c, CORNER.tz, H + 18, tier, base, rnd, CORNER.half, true));
      add(GATE.z0, B_ - 10, F_ + 24, GATE.z0, GATE.z1, TD.towerTop(0, H) + 14, (c) => this.paintGatehouse(c, H, tier, base, rnd));
      for (let i = 1; i < g.ballistas.length; i++) {
        const tz = TD.TOWER_Z[i];
        add(tz - 24, B_ - 6, F_ + 16, tz - 24, tz + 24, TD.towerTop(i, H) + 12, (c) => this.paintTower(c, tz, TD.towerTop(i, H), tier, base, rnd, 24, false));
      }
      for (const [a, b] of this.wallSegments()) add(a, B_ - 2, F_ + 24, a, b, H + 22, (c) => this.paintSegment(c, a, b, H, tier, base, rnd));
      pieces.sort((p, q) => p.key - q.key);
      return (this.pieces = pieces);
    }

    // Кусок стены в собственном спрайте (только по своей рамке)
    piece(x0, x1, z0, z1, h1, fn) {
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (const x of [x0, x1]) for (const z of [z0, z1]) for (const h of [0, h1]) {
        const p = P(x, z, h);
        bx0 = Math.min(bx0, p.x); by0 = Math.min(by0, p.y); bx1 = Math.max(bx1, p.x); by1 = Math.max(by1, p.y);
      }
      const bb = { x0: Math.floor(bx0 - 8), y0: Math.floor(by0 - 8), x1: Math.ceil(bx1 + 8), y1: Math.ceil(by1 + 8) };
      const k = this.k;
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil((bb.x1 - bb.x0) * k)); cv.height = Math.max(1, Math.ceil((bb.y1 - bb.y0) * k));
      const c = cv.getContext('2d');
      c.setTransform(k, 0, 0, k, -bb.x0 * k, -bb.y0 * k);
      c.lineJoin = 'round';
      fn(c);
      return { img: cv, bb };
    }

    drawWall(ctx) {
      const g = this.game;
      const H = g.wallH;
      const items = [];
      for (const p of this.wallPieces()) items.push({ k: p.key, f: () => ctx.drawImage(p.img, p.bb.x0, p.bb.y0, p.bb.x1 - p.bb.x0, p.bb.y1 - p.bb.y0) });
      for (const a of g.archers) items.push({ k: a.z, f: () => this.drawArcher(ctx, a) });
      g.ballistas.forEach((b, i) => items.push({ k: (i === 0 ? GATE.z0 : TD.TOWER_Z[i] - 24) + 0.5, f: () => this.drawBallista(ctx, b, i) }));
      for (const c of g.cauldrons) items.push({ k: c.z + 0.5, f: () => this.drawCauldron(ctx, c) });
      for (const tz of [104, 150, 250, 300, 384, 440]) items.push({ k: tz, f: () => this.drawTorch(ctx, tz, F_ + (g.wallTier === 2 ? 5 : 1), H - 16) });
      for (const tz of [GATE.z0 + 10, GATE.z1 - 10]) items.push({ k: tz, f: () => this.drawTorch(ctx, tz, F_ + 21, Math.min(38, H * 0.55) + 2) });
      items.sort((a, b) => a.k - b.k);
      for (const it of items) it.f();
      const f = g.wallHp / g.wallMax;
      if (f < 0.75) this.drawCracks(ctx, f);
      if (g.wallHitT > 0) poly(ctx, [P(F_, CORNER.z1, 0), P(F_, this.wallEnd, 0), P(F_, this.wallEnd, H), P(F_, CORNER.z1, H)], `rgba(255,60,40,${g.wallHitT * 0.45})`);
      if (g.phase === 'defeat') this.drawBreach(ctx);
      this.hits.push({ id: 'wall', poly: [P(B_, CORNER.z0, H + 8), P(F_ + 4, CORNER.z0, H + 8), P(F_ + 4, this.wallEnd, 0), P(B_, this.wallEnd, 0)] });
    }

    // Участок стены между башнями: боевой ход, лицевая грань, зубцы
    paintSegment(c, a, b, H, tier, base, rnd) {
      const T = TD.Bld.tex;
      const front = { x: F_ };
      poly(c, [P(F_, a, 0), P(F_ + 14, a, 0), P(F_ + 14, b, 0), P(F_, b, 0)], 'rgba(40,32,24,0.55)');
      poly(c, [P(B_, a, H), P(F_, a, H), P(F_, b, H), P(B_, b, H)], tier === 0 ? '#5e4428' : shade(base, 0.82));
      c.strokeStyle = tier === 0 ? 'rgba(30,20,10,0.6)' : 'rgba(0,0,0,0.22)'; c.lineWidth = 0.6;
      c.beginPath();
      for (let z = a; z < b; z += tier === 0 ? 7 : 12) { const p0 = P(B_, z, H), p1 = P(F_ - 6, z, H); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); }
      c.stroke();
      if (tier === 0) {
        for (let z = a; z < b - 0.5; z += 8.6) {
          const zb = Math.min(b, z + 8.6);
          const hh = H + 3 + rnd() * 7;
          const m0 = P(F_, z, H * 0.5), m1 = P(F_, zb, H * 0.5);
          const gr = c.createLinearGradient(m0.x, m0.y, m1.x, m1.y);
          gr.addColorStop(0, '#3e2a18'); gr.addColorStop(0.35, '#8a6440'); gr.addColorStop(0.6, '#6e4c2c'); gr.addColorStop(1, '#2e1e10');
          const tip = P(F_, (z + zb) / 2, hh + 7);
          poly(c, [P(F_, z, 0), P(F_, zb, 0), P(F_, zb, hh), tip, P(F_, z, hh)], gr, 'rgba(20,12,6,0.8)', 0.6);
          poly(c, [P(F_, z + 2, hh + 1), tip, P(F_, zb - 2, hh + 1), P(F_, (z + zb) / 2, hh - 1)], '#c8a070');
          c.strokeStyle = 'rgba(20,12,6,0.45)'; c.lineWidth = 0.4; c.beginPath();
          for (let k = 0; k < 3; k++) { const zz = z + 2 + rnd() * 4.6, hA = rnd() * hh * 0.8; const q0 = P(F_, zz, hA), q1 = P(F_, zz + 0.5, hA + 6 + rnd() * 8); c.moveTo(q0.x, q0.y); c.lineTo(q1.x, q1.y); }
          c.stroke();
        }
        for (const hh of [H * 0.22, H * 0.68]) {
          const bf = { x: F_ + 1.5 };
          T.quadFill(c, bf, a, hh, b, hh + 5, T.vg(c, bf, a, hh, hh + 5, '#7a5634', '#3e2a18'), 'rgba(20,12,6,0.8)', 0.5);
          for (let z = a + 10; z < b; z += 26) poly(c, [P(F_ + 2, z, hh - 1), P(F_ + 2, z, hh + 6), P(F_ + 2, z + 2.5, hh + 6), P(F_ + 2, z + 2.5, hh - 1)], '#a8905a', 'rgba(40,30,10,0.6)', 0.3);
        }
        return;
      }
      T.stones(c, { x: F_ + 3 }, a, b, 0, 9, shade(base, 0.85), rnd, 9, 18, false);
      poly(c, [P(F_, a, 9), P(F_ + 3, a, 9), P(F_ + 3, b, 9), P(F_, b, 9)], shade(base, 1.1));
      T.stones(c, front, a, b, 9, H, base, rnd, tier === 1 ? 7 : 8, tier === 1 ? 14 : 18, false);
      for (let i = 0; i < (b - a) / 10; i++) {
        const zz = a + rnd() * (b - a);
        const q0 = P(F_ + 0.2, zz, H - 2), q1 = P(F_ + 0.2, zz + 1, H * (0.3 + rnd() * 0.4));
        const gr = c.createLinearGradient(q0.x, q0.y, q1.x, q1.y); gr.addColorStop(0, 'rgba(20,20,26,0.3)'); gr.addColorStop(1, 'rgba(20,20,26,0)');
        line(c, q0.x, q0.y, q1.x, q1.y, gr, 2.2 * q0.s);
      }
      for (let i = 0; i < (b - a) / 6; i++) { const q = P(F_ + 0.3, a + rnd() * (b - a), 9 + rnd() * 6); ellipse(c, q.x, q.y, 2.2 * q.s, 1.6 * q.s, 0, 'rgba(70,100,55,0.45)'); }
      for (let z = a + 18; z < b - 10; z += 42) poly(c, [P(F_ + 0.3, z - 1, H * 0.45), P(F_ + 0.3, z + 1, H * 0.45), P(F_ + 0.3, z + 1, H * 0.45 + 13), P(F_ + 0.3, z - 1, H * 0.45 + 13)], '#0e0b10');
      if (tier === 2) {
        for (let z = a + 3; z < b - 3; z += 9) poly(c, [P(F_, z, H - 9), P(F_, z + 4, H - 9), P(F_ + 4, z + 4, H - 2), P(F_ + 4, z, H - 2)], shade(base, 1.05), OUT, 0.4);
        poly(c, [P(F_ + 4, a, H - 2), P(F_ + 4, b, H - 2), P(F_ + 4, b, H + 1), P(F_ + 4, a, H + 1)], shade(base, 1.15), OUT, 0.4);
        for (let z = a + 3; z < b; z += 14) {
          const p0 = P(F_, z, 2), p1 = P(F_ + 18, z + 3, 7);
          line(c, p0.x, p0.y, p1.x, p1.y, '#4a3a2a', 2 * p0.s);
          circle(c, p1.x, p1.y, 1.2, '#b8b8c0');
        }
        for (const z of [128, 274]) {
          if (z - 12 < a || z + 12 > b) continue;
          const pts = [P(F_ + 5, z - 11, H - 10), P(F_ + 5, z + 11, H - 10), P(F_ + 5, z + 11, H - 52), P(F_ + 5, z, H - 60), P(F_ + 5, z - 11, H - 52)];
          const gr = c.createLinearGradient(pts[0].x, pts[0].y, pts[1].x, pts[1].y); gr.addColorStop(0, '#a82a2e'); gr.addColorStop(1, '#5a1418');
          poly(c, pts, gr, '#d4a64a', 1.2);
          const m = P(F_ + 5, z, H - 30);
          c.fillStyle = '#e8c060'; c.font = `bold ${16 * m.s}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('♜', m.x, m.y);
        }
      }
      const mw = tier === 1 ? 11 : 12, gap = tier === 1 ? 8 : 9, mh = tier === 1 ? 11 : 13;
      const fx = tier === 2 ? F_ + 4 : F_;
      for (let z = a + 1; z < b - 2; z += mw + gap) {
        const ze = Math.min(b - 1, z + mw);
        T.texBox(c, fx - 7, fx, z, ze, H, H + mh, 'stone', base, rnd, { rowH: mh / 2, len: 7, top: shade(base, 1.2), sideF: 1.05, frontF: 0.75 });
      }
    }

    // Участки стены между башнями (от угловой башни до ближнего края за экраном)
    wallSegments() {
      const g = this.game;
      const blocks = [[GATE.z0, GATE.z1]];
      for (let i = 1; i < g.ballistas.length; i++) blocks.push([TD.TOWER_Z[i] - 24, TD.TOWER_Z[i] + 24]);
      blocks.sort((a, b) => a[0] - b[0]);
      const out = [];
      let cur = CORNER.z1;
      for (const [a, b] of blocks) { if (a > cur) out.push([cur, a]); cur = Math.max(cur, b); }
      if (cur < this.wallEnd) out.push([cur, this.wallEnd]);
      return out;
    }

    paintTower(c, tz, th, tier, base, rnd, half, corner) {
      const T = TD.Bld.tex;
      const x0 = B_ - 4, x1 = F_ + 14, z0 = tz - half, z1 = tz + half;
      const col = tier === 0 ? '#7a5634' : shade(base, 1.05);
      if (tier === 0) T.texBox(c, x0, x1, z0, z1, 0, th, 'planks', col, rnd, { pw: 5, sideF: 1.05, frontF: 0.7 });
      else T.texBox(c, x0, x1, z0, z1, 0, th, 'stone', col, rnd, { rowH: 7, len: 12, sideF: 1.05, frontF: 0.68 });
      poly(c, [P(x1 + 0.3, tz - 1.2, th * 0.5), P(x1 + 0.3, tz + 1.2, th * 0.5), P(x1 + 0.3, tz + 1.2, th * 0.5 + 14), P(x1 + 0.3, tz - 1.2, th * 0.5 + 14)], '#0e0b10');
      poly(c, [P(x0 - 1, z1 + 1, th), P(x1 + 1, z1 + 1, th), P(x1 + 1, z0 - 1, th), P(x0 - 1, z0 - 1, th)], tier === 0 ? '#5e4428' : shade(base, 0.8), OUT, 0.5);
      const mh = 9;
      const box = (xa, xb, za, zb) => T.texBox(c, xa, xb, za, zb, th, th + mh, tier === 0 ? 'planks' : 'stone', col, rnd, { rowH: mh / 2, len: 6, pw: 3, top: shade(col, 1.2), sideF: 1.05, frontF: 0.75 });
      for (const [za, zb] of [[z0, z0 + 9], [tz - 4.5, tz + 4.5]]) box(x1 - 8, x1, za, zb);
      for (const [xa, xb] of [[x0, x0 + 9], [(x0 + x1) / 2 - 4.5, (x0 + x1) / 2 + 4.5]]) box(xa, xb, z1 - 8, z1);
      box(x1 - 8, x1, z1 - 9, z1);
      if (corner) {
        const top = P((x0 + x1) / 2, tz, th + mh + 40);
        const a = P(x0 - 4, z1 + 4, th + mh), b = P(x1 + 4, z1 + 4, th + mh), d = P(x1 + 4, z0 - 4, th + mh);
        poly(c, [b, d, top], tier === 0 ? '#4a3420' : '#352a48', OUT, 0.5);
        poly(c, [a, b, top], tier === 0 ? '#6a4a2a' : '#4a3d66', OUT, 0.5);
        c.save(); path(c, [a, b, top]); c.clip();
        for (let i = 1; i < 7; i++) { const t = i / 7; line(c, lerp(a.x, top.x, t), lerp(a.y, top.y, t), lerp(b.x, top.x, t), lerp(b.y, top.y, t), 'rgba(0,0,0,0.35)', 0.6); }
        c.restore();
        line(c, top.x, top.y, top.x, top.y - 10, '#3a3a40', 1.2);
      }
    }

    paintGatehouse(c, H, tier, base, rnd) {
      const T = TD.Bld.tex;
      const x0 = B_ - 8, x1 = F_ + 20, z0 = GATE.z0, z1 = GATE.z1, th = TD.towerTop(0, H);
      const col = tier === 0 ? '#7a5634' : shade(base, 1.08);
      if (tier === 0) T.texBox(c, x0, x1, z0, z1, 0, th, 'planks', col, rnd, { pw: 5.5, sideF: 1.05, frontF: 0.7 });
      else T.texBox(c, x0, x1, z0, z1, 0, th, 'stone', col, rnd, { rowH: 7, len: 13, sideF: 1.05, frontF: 0.68 });
      const fc = { x: x1 };
      const gz0 = 184, gz1 = 216, gh = Math.min(38, H * 0.55);
      const arch = (inset) => {
        const pts = [P(x1 + 0.2, gz0 - inset, 0), P(x1 + 0.2, gz1 + inset, 0)];
        for (let i = 0; i <= 12; i++) { const a = (i / 12) * PI; pts.push(P(x1 + 0.2, (gz0 + gz1) / 2 + Math.cos(a) * ((gz1 - gz0) / 2 + inset), gh - (gz1 - gz0) / 2 + Math.sin(a) * ((gz1 - gz0) / 2 + inset))); }
        return pts;
      };
      poly(c, arch(3.5), tier === 0 ? '#4a3220' : shade(base, 1.25), OUT, 0.6);
      poly(c, arch(0), '#0c090c');
      c.save(); path(c, arch(0)); c.clip();
      T.planks(c, { x: x1 - 2 }, gz0, gz1, 0, gh, '#5a3a20', rnd, 4);
      for (const hh of [gh * 0.2, gh * 0.55]) T.quadFill(c, { x: x1 - 1.8 }, gz0, hh, gz1, hh + 2.4, '#2a2a30');
      for (let z = gz0 + 3; z < gz1; z += 5) for (const hh of [gh * 0.2 + 1.2, gh * 0.55 + 1.2]) { const q = P(x1 - 1.6, z, hh); circle(c, q.x, q.y, 0.55, '#a0a0a8'); }
      const m0 = P(x1 - 1.8, (gz0 + gz1) / 2, 0), m1 = P(x1 - 1.8, (gz0 + gz1) / 2, gh);
      line(c, m0.x, m0.y, m1.x, m1.y, '#1a1008', 1);
      c.strokeStyle = '#3a3a42'; c.lineWidth = 1.3;
      c.beginPath();
      for (let z = gz0 + 3; z < gz1; z += 4) { const q0 = P(x1 - 0.5, z, gh + 2), q1 = P(x1 - 0.5, z, gh * 0.62); c.moveTo(q0.x, q0.y); c.lineTo(q1.x, q1.y); }
      for (let hh = gh * 0.66; hh < gh; hh += 4) { const q0 = P(x1 - 0.5, gz0, hh), q1 = P(x1 - 0.5, gz1, hh); c.moveTo(q0.x, q0.y); c.lineTo(q1.x, q1.y); }
      c.stroke();
      for (let z = gz0 + 3; z < gz1; z += 4) { const q = P(x1 - 0.5, z, gh * 0.62); c.fillStyle = '#5a5a62'; c.beginPath(); c.moveTo(q.x - 0.9, q.y - 1); c.lineTo(q.x + 0.9, q.y - 1); c.lineTo(q.x, q.y + 2); c.fill(); }
      c.restore();
      const cp = P(x1 + 0.4, 200, gh + 12);
      const s = cp.s;
      c.beginPath(); c.moveTo(cp.x - 6 * s, cp.y - 7 * s); c.lineTo(cp.x + 6 * s, cp.y - 7 * s); c.lineTo(cp.x + 6 * s, cp.y + s); c.quadraticCurveTo(cp.x + 6 * s, cp.y + 6 * s, cp.x, cp.y + 8 * s); c.quadraticCurveTo(cp.x - 6 * s, cp.y + 6 * s, cp.x - 6 * s, cp.y + s); c.closePath();
      c.fillStyle = '#2c4a8a'; c.fill(); c.strokeStyle = '#d4a64a'; c.lineWidth = 1; c.stroke();
      c.fillStyle = '#e8c060'; c.font = `bold ${9 * s}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('♜', cp.x, cp.y);
      T.windowW(c, fc, 200, th - 22, 6, 11, { shutters: false, arch: true, lit: true });
      poly(c, [P(x0 - 1, z1 + 1, th), P(x1 + 1, z1 + 1, th), P(x1 + 1, z0 - 1, th), P(x0 - 1, z0 - 1, th)], tier === 0 ? '#5e4428' : shade(base, 0.8), OUT, 0.5);
      const mh = 10;
      const box = (xa, xb, za, zb) => T.texBox(c, xa, xb, za, zb, th, th + mh, tier === 0 ? 'planks' : 'stone', col, rnd, { rowH: mh / 2, len: 6, pw: 3, top: shade(col, 1.2) });
      for (const [za, zb] of [[z0, z0 + 9], [z0 + 18, z0 + 27], [z1 - 27, z1 - 18]]) box(x1 - 8, x1, za, zb);
      for (const [xa, xb] of [[x0, x0 + 9], [x0 + 18, x0 + 27]]) box(xa, xb, z1 - 8, z1);
      box(x1 - 8, x1, z1 - 9, z1);
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
      ctx.strokeStyle = 'rgba(15,10,10,0.85)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const c of this.cracks) {
        if (c.th < (0.75 - f) * 1.4) c.pts.forEach(([z, h], i) => { const q = P(F_ + 0.5, z, clamp(h, 0.02, 0.98) * g.wallH); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
      }
      ctx.stroke();
    }

    drawBreach(ctx) {
      const g = this.game;
      const z0 = 240, z1 = 310;
      poly(ctx, [P(F_ + 2, z0, g.wallH + 14), P(F_ + 2, z0 + 10, g.wallH * 0.3), P(F_ + 2, (z0 + z1) / 2, 4), P(F_ + 2, z1 - 8, g.wallH * 0.25), P(F_ + 2, z1, g.wallH + 14)], '#140f12');
      const r = seeded(8);
      for (let i = 0; i < 30; i++) {
        const q = P(F_ + 6 + r() * 40, z0 + r() * (z1 - z0), 0);
        ctx.fillStyle = g.wallTier === 0 ? '#5a3e22' : shade('#6f6a62', 0.8 + r() * 0.4);
        ctx.fillRect(q.x - 4 * q.s, q.y - 6 * q.s, (5 + r() * 7) * q.s, (4 + r() * 4) * q.s);
      }
    }

    drawTorch(ctx, z, x, h) {
      const p = P(x, z, h), s = p.s;
      line(ctx, p.x, p.y + 3 * s, p.x + 4 * s, p.y - 7 * s, '#2a2a2e', 1.4 * s);
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(p.x + 2.6 * s, p.y - 10 * s, 3 * s, 4 * s);
      const fl = Math.sin(this.time * 17 + z) * 0.5 + Math.sin(this.time * 23 + z * 2) * 0.5;
      ctx.fillStyle = '#ff9a2a';
      ctx.beginPath(); ctx.moveTo(p.x + 2.2 * s, p.y - 10 * s); ctx.quadraticCurveTo(p.x + (4 + fl) * s, p.y - (21 + fl * 2) * s, p.x + 6.4 * s, p.y - 10 * s); ctx.fill();
      ctx.fillStyle = '#ffe07a';
      ctx.beginPath(); ctx.moveTo(p.x + 3.2 * s, p.y - 10 * s); ctx.quadraticCurveTo(p.x + (4.2 + fl * 0.5) * s, p.y - (16 + fl) * s, p.x + 5.4 * s, p.y - 10 * s); ctx.fill();
      this.lightAt(p.x + 4 * s, p.y - 13 * s, 50 * s, 0.6 + fl * 0.08);
    }

    drawArcher(ctx, a) {
      const g = this.game;
      const p = P(a.x, a.z, g.wallH);
      const s = p.s;
      const lvl = g.levels.archers;
      let aim = -0.55;
      if (a.target && a.target.state !== 'dead') {
        const tp = P(a.target.x, a.target.z, 20);
        const ang = Math.atan2(tp.y - (p.y - 19 * s), tp.x - p.x);
        aim = clamp(ang - 0.45 - Math.min(0.4, Math.hypot(tp.x - p.x, tp.y - p.y) / 1400), -1.25, 0.35);
      }
      a.aim = lerp(a.aim, aim, 0.2);
      const interval = TD.S.archerInterval(lvl, g.mods);
      const battle = g.phase === 'battle';
      const pull = !battle ? 0.15 : a.anim < 0.12 ? 0 : clamp((a.anim - 0.25) / Math.max(0.2, interval * 0.55), 0, 1);
      const snap = a.anim < 0.15 ? Math.sin(a.anim * 90) * (1 - a.anim / 0.15) : 0;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(s, s);
      TD.UArt.drawArcher(ctx, { tier: lvl >= 11 ? 2 : lvl >= 6 ? 1 : 0, aim: a.aim, pull, snap, nocked: a.anim > 0.3 || !battle, fire: g.mods.fireArrow > 0 && ((a.v * 7 + Math.floor(this.time)) % 5 < 1), time: this.time, variant: a.v || 0 });
      ctx.restore();
    }

    drawBallista(ctx, b, i) {
      const g = this.game;
      const th = TD.towerTop(i, g.wallH);
      const p = P(b.x + 2, b.z, th);
      const s = p.s;
      const appear = clamp(b.built / 0.5, 0, 1);
      const ahead = P(b.x + Math.cos(b.aim) * 100, b.z + Math.sin(b.aim) * 100, th - 10);
      const ang = Math.atan2(ahead.y - p.y, ahead.x - p.x);
      const recoil = b.anim < 0.25 ? Math.sin((b.anim / 0.25) * PI) * 4 : 0;
      const interval = TD.S.ballistaInterval(g.levels.ballista, g.mods);
      const loaded = b.anim > Math.min(1.0, interval * 0.6) || g.phase !== 'battle';
      const pull = loaded ? 1 : clamp(b.anim / (interval * 0.6), 0, 1);
      const cp = P(b.x - 16, b.z + 10, th);
      ctx.save(); ctx.translate(cp.x, cp.y); ctx.scale(s * 0.95, s * 0.95);
      TD.UArt.drawCrew(ctx, { pose: loaded ? 'stand' : 'crank', phase: b.anim * 8, tunic: '#5a3030' });
      ctx.restore();
      ctx.save();
      ctx.translate(p.x, p.y - 7 * s);
      ctx.scale(s * appear, s * appear);
      TD.UArt.drawBallista(ctx, { aim: ang, recoil, loaded, pull, tier: g.levels.ballista >= 9 ? 2 : 0, crank: loaded ? 0 : b.anim * 6 });
      ctx.restore();
      this.hits.push({ id: 'ballista', x0: p.x - 30 * s, y0: p.y - 30 * s, x1: p.x + 30 * s, y1: p.y + th * s });
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
      ctx.scale(s * appear * 0.95, s * appear * 0.95);
      TD.UArt.drawCauldron(ctx, { tilt, full: t > 1.8 || tilt < 0.4, time: this.time, seed: c.z });
      ctx.restore();
      this.lightAt(p.x, p.y - 6 * s, 30 * s, 0.5);
      if (Math.random() < 0.05 && g.particles.length < 1200) g.particle('smoke', c.x, c.z, H + 20, { vh: 16, life: 1.4, size: 4, color: '#8a8a95' });
      if (t > 0.35 && t < 1.55) {
        const k = clamp((t - 0.35) / 0.15, 0, 1) * clamp((1.55 - t) / 0.2, 0, 1);
        const lip = P(c.x + 17, c.z, H + 18), mid = P(F_ + 14, c.z, H * 0.5), ground = P(F_ + 22, c.z, 0);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = ['rgba(255,120,30,0.55)', 'rgba(255,190,70,0.75)', 'rgba(255,245,180,0.9)'][i];
          ctx.lineWidth = (8 - i * 2.6) * s * k;
          ctx.beginPath(); ctx.moveTo(lip.x, lip.y);
          ctx.quadraticCurveTo(mid.x + Math.sin(this.time * 30 + i) * 2, mid.y, ground.x, ground.y); ctx.stroke();
        }
        ctx.restore();
        if (Math.random() < 0.6) g.particle('splash', F_ + 22, c.z + (Math.random() - 0.5) * 10, 2, { vh: 60 + Math.random() * 60, vx: Math.random() * 40, vz: (Math.random() - 0.5) * 50, life: 0.5, size: 2.5 });
        this.lightAt(ground.x, ground.y - 10, 70, 0.8 * k);
      }
      this.hits.push({ id: 'oil', x0: p.x - 12 * s, y0: p.y - 28 * s, x1: p.x + 12 * s, y1: p.y + 2 });
    }

    // ================= Поле боя =================
    drawDecals(ctx) {
      for (const d of this.game.decals) {
        const p = P(d.x, d.z, 0);
        const a = Math.min(1, (d.life - d.t) / 2);
        ctx.globalAlpha = a;
        const s = p.s;
        if (d.kind === 'crater') {
          ctx.globalAlpha = a * 0.8;
          ellipse(ctx, p.x, p.y, d.size * s, d.size * ZK * 0.6, 0, 'rgba(30,24,20,0.5)');
          ellipse(ctx, p.x, p.y, d.size * s * 0.55, d.size * ZK * 0.32, 0, 'rgba(20,16,14,0.55)');
          ctx.strokeStyle = 'rgba(120,100,80,0.45)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, d.size * s * 1.02, d.size * ZK * 0.62, 0, PI * 0.9, PI * 2.1); ctx.stroke();
        } else if (d.kind === 'blood' || d.kind === 'goo') {
          const col = d.kind === 'goo' ? 'rgba(110,150,40,0.6)' : 'rgba(70,14,14,0.65)';
          ellipse(ctx, p.x, p.y, d.size * s * 0.8, d.size * ZK * 0.4, d.rot * 0.1, col);
          ellipse(ctx, p.x + d.size * 0.6 * s * Math.cos(d.rot), p.y + 2, d.size * s * 0.3, d.size * ZK * 0.18, 0, col);
          ellipse(ctx, p.x - d.size * 0.5 * s * Math.sin(d.rot), p.y - 1, d.size * s * 0.18, d.size * ZK * 0.1, 0, col);
        } else if (d.kind === 'arrow' || d.kind === 'bolt') {
          const L = d.kind === 'bolt' ? 18 : 10;
          const ang = d.kind === 'bolt' ? d.rot : -1.1 + d.rot;
          const ex = p.x - Math.cos(ang) * L * s * (d.kind === 'bolt' ? 1 : 0.5), ey = p.y - 0.84 * L * 0.8 * s;
          line(ctx, p.x, p.y, ex, ey, d.kind === 'bolt' ? '#3a2a1a' : '#b8a07a', d.kind === 'bolt' ? 2 : 1);
          ctx.fillStyle = d.kind === 'bolt' ? '#aa2222' : '#ddd'; ctx.fillRect(ex - 1, ey - 1, 2.5, 2.5);
        }
      }
      ctx.globalAlpha = 1;
    }

    drawPools(ctx) {
      for (const p of this.game.pools) {
        const q = P(p.x, p.z, 0);
        const life = 1 - p.t / p.life;
        const a = Math.min(1, p.t * 4) * Math.min(1, life * 3);
        const rx = p.rx * q.s, ry = p.rz * ZK * 0.75;
        const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rx);
        gr.addColorStop(0, `rgba(255,190,80,${0.6 * a})`); gr.addColorStop(0.5, `rgba(230,100,30,${0.55 * a})`); gr.addColorStop(1, 'rgba(120,30,10,0)');
        ctx.fillStyle = gr;
        ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1, ry / rx); ctx.translate(-q.x, -q.y);
        ctx.beginPath(); ctx.arc(q.x, q.y, rx, 0, PI * 2); ctx.fill();
        ctx.restore();
        this.lightAt(q.x, q.y - 10, rx * 1.3, 0.35 * a);
      }
    }

    drawZombies(ctx) {
      const zs = this.game.zombies.slice().sort((a, b) => a.z - b.z);
      for (const z of zs) if (z.state === 'dead' && !z.gone) this.drawZombie(ctx, z);
      for (const z of zs) if (z.state !== 'dead') this.drawZombie(ctx, z);
    }

    drawZombie(ctx, z) {
      const p = P(z.x, z.z, 0);
      const base = TD.BOSS_BY_TYPE[z.type] || TD.ZOMBIES[z.type];
      const k = p.s * z.size;
      if (p.x < -80 || p.x > LW + 100) return;
      let alpha = 1;
      if (z.state === 'dead') alpha = clamp(1 - (z.deadT - TD.CORPSE_FADE) / (TD.CORPSE_LIFE - TD.CORPSE_FADE), 0, 1);
      if (z.x > W.SPAWN_X - 40 && z.state !== 'dead') alpha = Math.min(alpha, clamp((W.SPAWN_X + 70 - z.x) / 110, 0.15, 1));
      if (alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (z.state !== 'dead') {
        ctx.globalAlpha = alpha * 0.8;
        ctx.drawImage(this.shadowImg, p.x - 14 * k, p.y - 4.5 * k, 28 * k, 9 * k);
        ctx.globalAlpha = alpha;
      }
      if (z.boss) {
        const glow = z.type === 'lich' ? this.glowBlue : z.type === 'necro' || z.type === 'titan' ? this.glowGreen : this.glowFire;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * (0.22 + (z.casting > 0 ? z.casting * 0.6 : 0) + Math.sin(this.time * 3) * 0.06);
        ctx.drawImage(glow, p.x - 50 * k, p.y - 70 * k, 100 * k, 90 * k);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;
      }
      ctx.translate(p.x, p.y);
      if (z.state === 'rise') {
        const u = clamp(z.stateT / 1.0, 0, 1);
        ctx.beginPath(); ctx.rect(-80 * k, -200 * k, 160 * k, 200 * k); ctx.clip();
        ctx.translate(0, (1 - ease(u)) * 50 * k);
      }
      const variant = Math.floor(z.seed * 1000) % TD.ZArt.variants(z.type);
      if (z.state === 'dead') {
        // Падение назад с ускорением, лёгкий отскок при ударе о землю, затем тело лежит неподвижно
        const rest = TD.ZArt.deathRest(z.type, variant);
        const u = clamp((z.deadT - 0.12) / 0.55, 0, 1), e = u * u;
        let rot = rest.rot * e;
        const b = z.deadT - 0.67;
        if (b > 0) rot -= Math.sin(b * 18) * 0.07 * Math.exp(-b * 7);
        ctx.globalAlpha = alpha * 0.55 * e;
        ctx.drawImage(this.shadowImg, 2 * k, -4 * k, 40 * k, 9 * k);
        ctx.globalAlpha = alpha;
        ctx.translate(3 * e * k, rest.dy * e * k);
        ctx.rotate(rot);
      }
      if (z.state === 'swell') ctx.scale(1 + z.stateT * 0.35, 1 + z.stateT * 0.15);
      ctx.scale(k, k);
      const fr = TD.ZArt.frame(z);
      const tint = z.flash > 0 ? 'flash' : z.burn > 0 ? 'burn' : null;
      const spr = TD.ZArt.sprite(z.type, variant, fr.anim, fr.f, tint, base.size > 1.5 ? Math.min(2.2, base.size) : 1);
      ctx.drawImage(spr.img, TD.ZArt.BX0, TD.ZArt.BY0, TD.ZArt.BW, TD.ZArt.BH);
      if ((z.type === 'exploder' || z.type === 'titan') && z.state !== 'dead') {
        const pulse = 0.5 + Math.sin(this.time * (z.state === 'swell' ? 25 : 4) + z.seed * 9) * 0.5;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * (0.2 + pulse * 0.3);
        const rr = z.type === 'titan' ? 30 : 20;
        ctx.drawImage(this.glowGreen, -6 - rr, -26 - rr, rr * 2, rr * 2);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
      if (z.state !== 'dead' && !z.boss && z.hp < z.maxHp) {
        const w = 22 * k, y = p.y - 56 * k;
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(p.x - w / 2 - 1, y - 1, w + 2, 4);
        ctx.fillStyle = z.burn > 0 ? '#ff9a3a' : '#d84040';
        ctx.fillRect(p.x - w / 2, y, w * (z.hp / z.maxHp), 2);
      }
    }

    drawParticles(ctx) {
      const ps = this.game.particles;
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
      for (const p of this.game.projectiles) {
        const q = P(p.x, p.z, p.h);
        if (p.kind === 'arrow' || p.kind === 'bolt') {
          let n;
          if (p.kind === 'bolt') n = P(p.x + p.vx * 0.02, p.z + p.vz * 0.02, p.h + p.vh * 0.02);
          else {
            const k = Math.min(1, p.t / p.T + 0.02);
            n = P(p.x0 + (p.x1 - p.x0) * k, p.z0 + (p.z1 - p.z0) * k, p.h0 + (p.h1 - p.h0) * k + p.arc * 4 * k * (1 - k));
          }
          const ang = Math.atan2(n.y - q.y, n.x - q.x);
          const L = (p.kind === 'bolt' ? 26 : 14) * q.s;
          ctx.save();
          ctx.translate(q.x, q.y); ctx.rotate(ang);
          if (p.kind === 'bolt') {
            ctx.globalAlpha = 0.25; line(ctx, -L * 2.5, 0, -L, 0, '#fff', 2); ctx.globalAlpha = 1;
            line(ctx, -L, 0, 0, 0, '#4a3220', 2.6);
            ctx.fillStyle = '#c8ccd4'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-1, -3); ctx.lineTo(-1, 3); ctx.fill();
            ctx.fillStyle = '#aa2222'; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(-L + 5, -3); ctx.lineTo(-L + 7, 0); ctx.lineTo(-L + 5, 3); ctx.closePath(); ctx.fill();
          } else {
            ctx.globalAlpha = 0.18; line(ctx, -L * 2, 0, -L, 0, '#fff', 1); ctx.globalAlpha = 1;
            line(ctx, -L, 0, 0, 0, '#d8c49a', 1.3);
            ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(3.5, 0); ctx.lineTo(-1, -1.7); ctx.lineTo(-1, 1.7); ctx.fill();
            ctx.fillStyle = p.crit ? '#ff6a4a' : '#f0f0f0';
            ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(-L + 3, -2); ctx.lineTo(-L + 4.5, 0); ctx.lineTo(-L + 3, 2); ctx.closePath(); ctx.fill();
            if (p.fire) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(this.glowFire, -8, -8, 16, 16); ctx.globalCompositeOperation = 'source-over'; }
          }
          ctx.restore();
        } else if (p.kind === 'rock' || p.kind === 'boulder') {
          const big = p.kind === 'boulder';
          const r = (big ? 9 : 5.5) * q.s;
          const gq = P(p.x, p.z, 0);
          ellipse(ctx, gq.x, gq.y, r * 1.2, r * 0.45, 0, 'rgba(0,0,0,0.3)');
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(p.rot || 0);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; const rr = r * (0.85 + ((i * 37) % 10) / 40); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          ctx.closePath();
          ctx.fillStyle = p.fire ? '#7a3a1a' : A.lit(ctx, 0, 0, r, '#7a736a'); ctx.fill();
          ctx.strokeStyle = OUT; ctx.lineWidth = 0.6; ctx.stroke();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(r * 0.2, r * 0.1, r * 0.4, 0.4, 2.2); ctx.stroke();
          ctx.restore();
          if (p.fire) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(this.glowFire, q.x - r * 3, q.y - r * 3, r * 6, r * 6); ctx.globalCompositeOperation = 'source-over'; }
        } else if (p.kind === 'glob') {
          circle(ctx, q.x, q.y, 3.5 * q.s, '#a6e04a');
          ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(this.glowGreen, q.x - 8, q.y - 8, 16, 16); ctx.globalCompositeOperation = 'source-over';
        }
      }
    }

    drawTexts(ctx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of this.game.texts) {
        const q = P(t.x, t.z, t.h);
        const u = t.t / t.life;
        ctx.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
        const sz = t.size * (u < 0.1 ? 0.6 + u * 4 : 1);
        ctx.font = `bold ${sz}px "Alegreya SC", Georgia, serif`;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(t.s, q.x, q.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.s, q.x, q.y);
      }
      ctx.globalAlpha = 1;
    }

    drawLights(ctx) {
      const L = this.lights;
      if (!L.length) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const l of L) {
        ctx.globalAlpha = clamp(l.a, 0, 1) * 0.55;
        ctx.drawImage(l.img || this.glowFire, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      L.length = 0;
    }

    drawBossBar(ctx) {
      const b = this.game.boss;
      if (!b || b.state === 'dead') return;
      const w = 440, x = (LW - w) / 2, y = 70;
      ctx.save();
      ctx.fillStyle = 'rgba(12,8,16,0.82)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - 10, y - 26, w + 20, 46, 8); else ctx.rect(x - 10, y - 26, w + 20, 46);
      ctx.fill();
      ctx.strokeStyle = '#a07a3a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = 'bold 17px "Alegreya SC", Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffcf7a';
      ctx.fillText('☠ ' + b.name + ' ☠', LW / 2, y - 10);
      ctx.fillStyle = '#2a0e10'; ctx.fillRect(x, y + 3, w, 10);
      const gr = ctx.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#8a1a22'); gr.addColorStop(1, '#ff5a3a');
      ctx.fillStyle = gr; ctx.fillRect(x, y + 3, w * clamp(b.hp / b.maxHp, 0, 1), 10);
      ctx.strokeStyle = 'rgba(255,220,160,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(x, y + 3, w, 10);
      ctx.restore();
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
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, 'rgba(10,5,15,0.72)'); gr.addColorStop(0.7, 'rgba(10,5,15,0.72)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, y - 48, LW, 96);
      const lg = ctx.createLinearGradient(0, 0, LW, 0);
      lg.addColorStop(0, 'rgba(216,176,96,0)'); lg.addColorStop(0.5, 'rgba(216,176,96,0.8)'); lg.addColorStop(1, 'rgba(216,176,96,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, y - 48, LW, 1.5); ctx.fillRect(0, y + 46, LW, 1.5);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sc2 = 1 + Math.max(0, 0.3 - b.t) * 0.8;
      ctx.translate(LW / 2, y - 8); ctx.scale(sc2, sc2);
      ctx.font = 'bold 48px "Alegreya SC", Georgia, serif';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(b.title, 0, 0);
      ctx.fillStyle = b.color; ctx.fillText(b.title, 0, 0);
      if (b.sub) { ctx.font = '19px Alegreya, Georgia, serif'; ctx.fillStyle = '#e8d8c0'; ctx.fillText(b.sub, 0, 36); }
      ctx.restore();
    }

    // ================= Иконки для панели улучшений =================
    thumb(id, level) {
      const S = 120, R = 2;
      const cv = document.createElement('canvas');
      cv.width = S * R; cv.height = S * R;
      const c = cv.getContext('2d');
      c.lineJoin = 'round';
      const it = TD.ITEMS[id];
      if (it.kind === 'building') {
        const tmp = TD.Bld.sprite(it, level, 3);
        const box = tightBox(tmp.img);
        if (box) {
          const sc = Math.min((S * R * 0.94) / box.w, (S * R * 0.94) / box.h);
          const w = box.w * sc, h = box.h * sc;
          c.drawImage(tmp.img, box.x, box.y, box.w, box.h, (S * R - w) / 2, (S * R - h) / 2 + 4, w, h);
        }
        return cv;
      }
      const U = TD.UArt;
      const tierW = level < 4 ? 0 : level < 9 ? 1 : 2;
      c.setTransform(R, 0, 0, R, 0, 0);
      c.translate(S / 2, S * 0.8);
      switch (id) {
        case 'wall': c.scale(1.5, 1.5); c.translate(0, 4); U.drawWallIcon(c, tierW); break;
        case 'archers': c.scale(2.7, 2.7); c.translate(-4, 6); U.drawArcher(c, { tier: level >= 11 ? 2 : level >= 6 ? 1 : 0, aim: -0.5, pull: 0.8, nocked: true, time: 1 }); break;
        case 'oil': c.scale(3, 3); c.translate(0, 4); U.drawCauldron(c, { tilt: 0.25, full: true, time: 1 }); break;
        case 'ballista': c.scale(2.1, 2.1); c.translate(-3, -6); U.drawBallista(c, { aim: -0.25, loaded: true, pull: 1, tier: level >= 9 ? 2 : 0 }); break;
        case 'catapult': c.scale(1.55, 1.55); c.translate(4, 6); U.drawCatapult(c, { arm: PI - 0.18, loaded: true, fdx: 6, fdy: -6 }); break;
        case 'trebuchet': c.scale(0.92, 0.92); c.translate(0, 12); U.drawTrebuchet(c, { arm: PI + 0.95, sling: 0.05, loaded: true, fdx: 7, fdy: -7 }); break;
      }
      return cv;
    }
  }

  function tightBox(img) {
    const c = img.getContext('2d');
    const { width: w, height: h } = img;
    const d = c.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      if (d[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return null;
    return { x: x0, y: y0, w: x1 - x0 + 2, h: y1 - y0 + 2 };
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
