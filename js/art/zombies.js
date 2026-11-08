/* Детализированные зомби: скелетная модель + кеш кадров анимации в спрайты */
(function () {
  const TD = globalThis.TD;
  const A = TD.Art;
  const { PI, shade, capsule, OUT, alpha } = A;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const dir = (t) => ({ x: -Math.sin(t), y: Math.cos(t) }); // угол от «вниз», + вперёд (влево)
  const up = (t) => ({ x: -Math.sin(t), y: -Math.cos(t) });
  const add = (p, d, l) => ({ x: p.x + d.x * l, y: p.y + d.y * l });
  const mid = (a, b, t = 0.5) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const LWU = 0.5;

  // Габариты спрайта в локальных единицах (ступни в (0,0), лицом влево)
  const BX0 = -36, BY0 = -78, BW = 72, BH = 86;
  const FRAMES = { walk: 12, attack: 8, spit: 6, death: 8 };
  const DEATH_ROT = 1.02; // насколько тело заваливается назад к концу падения

  const DEF = {
    kind: 'human', thigh: 10.5, shin: 10.5, torso: 15, neck: 3.2, headR: 5.4,
    thighW: 2.9, shinW: 2.3, upperW: 2.0, foreW: 1.7, handR: 1.45, upper: 8.5, fore: 8,
    chest: 10, waist: 8.5, hunch: 1.8, lean: 0.28, neckLean: 0.55, belly: 0.6,
    amp: 0.42, knee: 0.55, stride: 20, arms: 'reach', eye: '#ff5a3c', shoes: '#2a211a',
    hair: 'messy', hairC: '#2a2420', skin: '#8ea27a', shirt: '#6b5a45', pants: '#3d4152',
    sleeve: true, blood: 0.5,
  };
  const V = (o) => Object.assign({}, DEF, o);
  const SPECS = {
    walker: [
      V({ skin: '#8ea27a', shirt: '#6b5a45', pants: '#3d4152', hair: 'messy' }),
      V({ skin: '#9aa98a', shirt: '#cbc3b0', pants: '#4a3b2c', hair: 'bald', wound: true, limpArm: true, blood: 0.9 }),
      V({ skin: '#869a74', shirt: '#4e6188', pants: '#3a3836', hair: 'long', hairC: '#5a3a22', dress: true }),
      V({ skin: '#93a07c', shirt: '#7a3030', pants: '#2f3646', hair: 'messy', hairC: '#6a6a60', tornShin: true, limp: true }),
    ],
    runner: [
      V({ skin: '#a9b391', shirt: null, pants: '#384050', thighW: 2.1, shinW: 1.7, upperW: 1.55, foreW: 1.35, chest: 8.5, waist: 7, hunch: 2.6, lean: 0.55, neckLean: 0.35, amp: 0.78, knee: 1.05, stride: 30, arms: 'run', eye: '#ffdf5a', hair: 'messy', ribs: true, tornShin: true, bare: true, shin: 11 }),
      V({ skin: '#b4b89a', shirt: null, pants: '#5a3f2c', thighW: 2.1, shinW: 1.7, upperW: 1.55, foreW: 1.35, chest: 8.5, waist: 7, hunch: 2.6, lean: 0.55, neckLean: 0.35, amp: 0.78, knee: 1.05, stride: 30, arms: 'run', eye: '#ffdf5a', hair: 'bald', ribs: true, bare: true, shin: 11, wound: true }),
    ],
    brute: [V({ skin: '#6e8058', shirt: null, pants: '#4a3a2a', thigh: 10, shin: 9.5, torso: 17, neck: 2, headR: 4.9, thighW: 3.9, shinW: 3.2, upperW: 3.7, foreW: 3.3, handR: 2.6, upper: 10, fore: 10, chest: 17, waist: 13, hunch: 4.5, lean: 0.3, belly: 2.5, amp: 0.32, knee: 0.4, stride: 22, arms: 'heavy', eye: '#ff3a2a', hair: 'bald', stitches: true, ropeBelt: true })],
    exploder: [V({ skin: '#9cb455', shirt: '#55602e', pants: '#3c3a30', thighW: 2.8, shinW: 2.3, chest: 12, waist: 12, hunch: 1, lean: 0.12, bloat: 9, eye: '#d6ff5a', hair: 'bald', amp: 0.34, stride: 17, arms: 'wide' })],
    spitter: [V({ skin: '#8f80a8', shirt: '#3b2f4c', pants: '#2a2a35', neck: 6.5, headR: 5.8, lean: 0.55, neckLean: 0.8, hunch: 3.6, eye: '#b6ff4a', hair: 'bald', sac: true, arms: 'dangle', stride: 18 })],
    elite: [V({ skin: '#5d6b48', shirt: '#6e737c', pants: '#2e2a26', thigh: 10, shin: 9.5, torso: 17, neck: 2, headR: 5, thighW: 3.8, shinW: 3.2, upperW: 3.6, foreW: 3.3, handR: 2.6, upper: 10, fore: 10, chest: 17, waist: 13, hunch: 4, lean: 0.3, belly: 1.5, amp: 0.32, knee: 0.4, stride: 22, arms: 'heavy', eye: '#ff2020', hair: 'none', armor: true, shoes: '#3a3530' })],
    butcher: [V({ skin: '#c09a8c', shirt: '#7a6a5a', pants: '#3a2c24', thigh: 10, shin: 9.5, torso: 17, neck: 1.8, headR: 5.2, thighW: 4, shinW: 3.3, upperW: 3.6, foreW: 3.2, handR: 2.5, upper: 10, fore: 9.5, chest: 17, waist: 15, hunch: 3.5, lean: 0.22, belly: 5, amp: 0.3, knee: 0.4, stride: 20, arms: 'heavy', eye: '#ff2a2a', hair: 'bald', apron: true, cleaver: true, stitches: true, sleeve: false })],
    necro: [V({ kind: 'robe', skin: '#d4d6c2', shirt: '#2c2140', trim: '#7dff6a', torso: 18, chest: 10, waist: 10, lean: 0.12, hunch: 2.5, neckLean: 0.4, headR: 5, eye: '#7dff6a', arms: 'staff', stride: 20, staff: 'skull', hood: true, upperW: 2.2, foreW: 1.8 })],
    lich: [V({ kind: 'robe', skin: '#d6dbe6', shirt: '#1b2140', trim: '#e2b84a', torso: 18, chest: 11, waist: 10, lean: 0.08, hunch: 1.5, neckLean: 0.3, headR: 5.2, eye: '#5ad2ff', arms: 'staff', stride: 20, staff: 'crystal', crown: true, cape: '#3a1f4a', upperW: 2.3, foreW: 1.9, pauldron: true })],
    colossus: [V({ kind: 'golem', skin: '#7c7a82', shirt: null, pants: '#6a6870', thigh: 11, shin: 10, torso: 18, neck: 1, headR: 4.2, thighW: 4.4, shinW: 4, upperW: 4.4, foreW: 4.8, handR: 3.2, upper: 10.5, fore: 10.5, chest: 19, waist: 14, hunch: 5, lean: 0.25, amp: 0.28, knee: 0.35, stride: 24, arms: 'heavy', eye: '#ffb02a', hair: 'none' })],
    titan: [V({ kind: 'bloat', skin: '#7f9440', shirt: null, pants: '#4a5626', thigh: 8, shin: 7.5, torso: 16, neck: 0.5, headR: 4.4, thighW: 4.4, shinW: 3.6, upperW: 3.4, foreW: 3, handR: 2.4, upper: 8, fore: 7.5, chest: 16, waist: 15, hunch: 3, lean: 0.12, bloat: 15, amp: 0.3, knee: 0.35, stride: 14, arms: 'wide', eye: '#e0ff40', hair: 'bald', bare: true })],
  };

  // ---------------- Поза ----------------
  function pose(sp, anim, f) {
    const t = f / FRAMES[anim];
    const walking = anim === 'walk';
    const phi = t * PI * 2;
    let L = sp.lean + (walking ? 0.045 * Math.sin(2 * phi) : 0);
    let tilt = 0.14, jaw = 0.14 + (walking ? 0.1 * (0.5 + 0.5 * Math.sin(phi * 2)) : 0);
    const legs = [];
    for (let i = 0; i < 2; i++) {
      const ph = phi + i * PI;
      const amp = sp.amp * (sp.limp && i === 0 ? 0.5 : 1);
      let th, bend;
      if (walking) { th = amp * Math.sin(ph); bend = 0.08 + sp.knee * Math.max(0, Math.cos(ph)) * (sp.limp && i === 0 ? 0.4 : 1); }
      else { th = i ? 0.3 : -0.2; bend = 0.18; }
      legs.push({ th, sh: th - bend, lift: walking ? Math.max(0, Math.cos(ph)) : 0 });
    }
    let arms;
    const sw = (i) => Math.sin(phi + i * 1.4);
    if (anim === 'attack') {
      let U, F, slam = 0;
      if (t < 0.35) { const k = ease(t / 0.35); U = lerp(1.25, 2.75, k); F = U + lerp(0.25, 0.55, k); L -= 0.1 * k; }
      else if (t < 0.5) { const k = (t - 0.35) / 0.15; U = lerp(2.75, 0.9, k); F = U - 0.1 * k; slam = Math.sin(k * PI); L += -0.1 * (1 - k) + 0.2 * k; }
      else { const k = ease((t - 0.5) / 0.5); U = lerp(0.9, 1.25, k); F = U + 0.25 * k; L += 0.2 * (1 - k); }
      arms = [{ U: U - 0.2, F: F - 0.15 }, { U, F }];
      jaw = 0.55; tilt = 0.02 - slam * 0.1;
    } else if (anim === 'spit') {
      if (t < 0.5) { const k = ease(t / 0.5); tilt = lerp(0.1, -0.7, k); jaw = lerp(0.15, 0.3, k); L -= 0.15 * k; }
      else { const k = ease((t - 0.5) / 0.5); tilt = lerp(-0.7, 0.4, Math.min(1, k * 2)) * (1 - k * 0.6); jaw = lerp(0.9, 0.2, k); L += 0.1 * (1 - k); }
      arms = [{ U: 0.5, F: 0.9 }, { U: 0.6, F: 1.0 }];
    } else if (anim === 'death') {
      // Подкашиваются колени, корпус откидывается назад, руки взлетают и обмякают
      const u = ease(Math.min(1, f / (FRAMES.death - 1)));
      // В середине падения колени сильно согнуты, к концу ноги вытягиваются вдоль земли
      const buckle = Math.sin(u * PI);
      legs[0].th = lerp(-0.2, 0.42, u); legs[0].sh = legs[0].th - (lerp(0.2, 0.15, u) + 1.25 * buckle);
      legs[1].th = lerp(0.3, 0.62, u); legs[1].sh = legs[1].th - (lerp(0.2, 0.4, u) + 1.0 * buckle);
      for (const lg of legs) lg.lift = 0;
      L = lerp(sp.lean, -0.55, u);
      // Руки взлетают вверх и опадают за голову на землю
      const U = lerp(1.15, 3.85, u);
      arms = [{ U: U - 0.3, F: U - 0.3 + 0.2 * (1 - u) + 0.15 }, { U, F: U + 0.35 * (1 - u) + 0.12 }];
      tilt = lerp(0.14, -0.6, u); jaw = lerp(0.2, 0.75, u);
    } else {
      switch (sp.arms) {
        case 'run': arms = [0, 1].map((i) => { const U = 0.15 + 0.85 * Math.sin(phi + i * PI + PI); return { U, F: U + 1.35 }; }); break;
        case 'heavy': arms = [0, 1].map((i) => { const U = 0.35 + 0.32 * Math.sin(phi + i * PI + PI); return { U, F: U + 0.35 }; }); break;
        case 'dangle': arms = [0, 1].map((i) => ({ U: 0.45 + 0.12 * sw(i), F: 0.8 + 0.15 * sw(i) })); break;
        case 'wide': arms = [0, 1].map((i) => ({ U: 0.75 + 0.15 * sw(i), F: 1.25 + 0.15 * sw(i) })); break;
        case 'staff': arms = [{ U: 0.5 + 0.1 * sw(0), F: 0.9 + 0.1 * sw(0) }, { U: 0.85, F: 1.65 }]; break;
        default: arms = [0, 1].map((i) => ({ U: 1.22 + 0.13 * sw(i), F: 1.55 + 0.12 * sw(i) }));
      }
      if (sp.limpArm) arms[0] = { U: 0.12 + 0.12 * Math.sin(phi), F: 0.25 + 0.12 * Math.sin(phi) };
    }
    // Положения суставов
    const hip0 = { x: 0, y: 0 };
    let maxY = -1e9;
    for (const lg of legs) {
      lg.knee = add(hip0, dir(lg.th), sp.thigh);
      lg.foot = add(lg.knee, dir(lg.sh), sp.shin);
      maxY = Math.max(maxY, lg.foot.y);
    }
    let hipY = sp.kind === 'robe' ? -(sp.thigh + sp.shin) * 0.97 + (walking ? Math.abs(Math.sin(phi)) * -0.6 : 0) : -(maxY + 1.1);
    const hip = { x: 0, y: hipY };
    for (const lg of legs) {
      lg.hip = { x: hip.x, y: hip.y };
      lg.knee = { x: lg.knee.x, y: lg.knee.y + hipY };
      lg.foot = { x: lg.foot.x, y: Math.min(-1.1, lg.foot.y + hipY) };
      lg.grounded = lg.foot.y > -1.4;
    }
    const sh = add(hip, up(L), sp.torso);
    const n = { x: Math.cos(L), y: -Math.sin(L) }; // нормаль назад
    const hd = add(add(sh, up(L + sp.neckLean), sp.neck + sp.headR * 0.75), { x: -1, y: 0 }, 0.6);
    const armOut = arms.map((a, i) => {
      const s0 = add(sh, n, i === 0 ? 1.4 : -0.6);
      const s1 = add(s0, up(L), -1.2);
      const elbow = add(s1, dir(a.U), sp.upper);
      const hand = add(elbow, dir(a.F), sp.fore);
      return { sh: s1, elbow, hand, F: a.F, U: a.U };
    });
    return { hip, sh, n, L, head: hd, tilt, jaw, legs, arms: armOut, phi, walking, t };
  }

  // ---------------- Примитивы ----------------
  function limbGrad(c, a, b, r, base) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    let mx = -dy / len, my = dx / len;
    if (mx - my < 0) { mx = -mx; my = -my; }
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const g = c.createLinearGradient(cx + mx * r, cy + my * r, cx - mx * r, cy - my * r);
    g.addColorStop(0, shade(base, 1.3));
    g.addColorStop(0.4, base);
    g.addColorStop(1, shade(base, 0.6));
    return g;
  }
  function seg(c, a, b, r1, r2, base) {
    capsule(c, a.x, a.y, b.x, b.y, r1, r2);
    c.fillStyle = limbGrad(c, a, b, Math.max(r1, r2), base);
    c.fill();
    c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
  }
  function blob(c, x, y, r, color, rnd, n) {
    c.fillStyle = color;
    c.beginPath();
    const k = n || 7;
    for (let i = 0; i <= k; i++) {
      const a = (i / k) * PI * 2, rr = r * (0.6 + rnd() * 0.6);
      if (i) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath(); c.fill();
  }

  function drawFoot(c, sp, lg, far) {
    const f = lg.foot;
    const toeDrop = lg.grounded ? 0 : 0.35 * lg.lift;
    c.save();
    c.translate(f.x, f.y);
    c.rotate(-toeDrop);
    if (sp.bare || sp.kind === 'bloat') {
      c.beginPath();
      c.moveTo(1.6, -2.2); c.quadraticCurveTo(2.4, 0.6, 0.5, 1.1); c.lineTo(-4.2, 1.1); c.quadraticCurveTo(-5, 0.2, -3.6, -0.6); c.lineTo(-0.6, -2.4); c.closePath();
      c.fillStyle = far ? shade(sp.skin, 0.65) : shade(sp.skin, 0.9); c.fill();
      c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
      c.strokeStyle = alpha('#000000', 0.4); c.lineWidth = 0.3;
      c.beginPath(); c.moveTo(-3.2, 1); c.lineTo(-3.3, 0); c.moveTo(-2.2, 1.1); c.lineTo(-2.3, 0.1); c.stroke();
    } else if (sp.kind === 'golem') {
      c.beginPath(); c.moveTo(3, -3); c.lineTo(3.4, 1.1); c.lineTo(-5.4, 1.1); c.lineTo(-4.6, -1.6); c.lineTo(-1, -3.4); c.closePath();
      c.fillStyle = far ? shade(sp.skin, 0.6) : shade(sp.skin, 0.85); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    } else {
      const sc = far ? shade(sp.shoes, 0.75) : sp.shoes;
      c.beginPath();
      c.moveTo(1.8, -2.4); c.lineTo(2.1, 1.1); c.lineTo(-4.4, 1.1); c.quadraticCurveTo(-5.2, -0.4, -3.4, -1.2); c.lineTo(-0.8, -2.6); c.closePath();
      c.fillStyle = sc; c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = shade(sp.shoes, 1.4); c.fillRect(-4.2, 0.4, 6.2, 0.7);
    }
    c.restore();
  }

  function drawLeg(c, sp, lg, far, rnd) {
    if (sp.kind === 'robe') return;
    const pc = far ? shade(sp.pants, 0.68) : sp.pants;
    seg(c, lg.hip, lg.knee, sp.thighW, sp.thighW * 0.82, pc);
    const torn = sp.tornShin && !far;
    const shinC = torn ? (far ? shade(sp.skin, 0.65) : sp.skin) : pc;
    seg(c, lg.knee, lg.foot, sp.shinW, sp.shinW * 0.75, shinC);
    if (torn) {
      // Рваная штанина
      const k = lg.knee, d = dir(lg.sh);
      c.fillStyle = pc;
      c.beginPath();
      const nx = -d.y, ny = d.x, w = sp.shinW * 1.15;
      c.moveTo(k.x + nx * w, k.y + ny * w);
      c.lineTo(k.x - nx * w, k.y - ny * w);
      for (let i = 0; i <= 4; i++) {
        const u = i / 4, l = 2.2 + (i % 2) * 1.6;
        c.lineTo(k.x - nx * w + nx * w * 2 * u + d.x * l, k.y - ny * w + ny * w * 2 * u + d.y * l);
      }
      c.closePath(); c.fill(); c.lineWidth = LWU * 0.8; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = alpha('#5a1010', 0.55);
      c.beginPath(); c.arc(mid(k, lg.foot, 0.55).x, mid(k, lg.foot, 0.55).y, sp.shinW * 0.5, 0, PI * 2); c.fill();
    }
    if (sp.kind === 'golem') rockChunks(c, lg.hip, lg.foot, sp.thighW, sp, rnd, far);
    // Колено/складки
    c.strokeStyle = alpha('#000000', 0.3); c.lineWidth = 0.35;
    c.beginPath(); c.arc(lg.knee.x, lg.knee.y, sp.thighW * 0.6, -0.5, 1.2); c.stroke();
    drawFoot(c, sp, lg, far);
  }

  function drawHand(c, sp, arm, far) {
    const h = arm.hand, d = dir(arm.F);
    const skin = sp.kind === 'robe' ? shade(sp.skin, far ? 0.6 : 0.95) : far ? shade(sp.skin, 0.68) : sp.skin;
    if (sp.kind === 'golem') { A.circle(c, h.x, h.y, sp.handR, shade(sp.skin, far ? 0.6 : 0.9), OUT, LWU); return; }
    // Пальцы (согнутые, свисающие)
    const fingers = sp.kind === 'robe' ? 4 : 3;
    const droop = arm.F > 1 ? 0.9 : 0.25;
    for (let i = 0; i < fingers; i++) {
      const a = arm.F + droop * 0.6 - 0.25 + i * 0.22;
      const len = sp.handR * (sp.kind === 'robe' ? 2.4 : 1.9);
      const m1 = add(add(h, d, sp.handR * 0.6), dir(a), len * 0.55);
      const e = add(m1, dir(a - droop), len * 0.5);
      c.lineCap = 'round';
      c.strokeStyle = OUT; c.lineWidth = sp.handR * 0.55 + 0.5;
      c.beginPath(); c.moveTo(h.x, h.y); c.lineTo(m1.x, m1.y); c.lineTo(e.x, e.y); c.stroke();
      c.strokeStyle = skin; c.lineWidth = sp.handR * 0.55;
      c.beginPath(); c.moveTo(h.x, h.y); c.lineTo(m1.x, m1.y); c.lineTo(e.x, e.y); c.stroke();
    }
    A.ellipse(c, h.x, h.y, sp.handR * 1.05, sp.handR * 0.85, arm.F, skin, OUT, LWU);
  }

  function drawArm(c, sp, arm, far, rnd) {
    const skinC = far ? shade(sp.skin, 0.68) : sp.skin;
    if (sp.kind === 'robe') {
      const robe = far ? shade(sp.shirt, 0.65) : sp.shirt;
      seg(c, arm.sh, arm.elbow, sp.upperW, sp.upperW, robe);
      // Широкий рукав
      const d = dir(arm.F), nx = -d.y, ny = d.x;
      const e = arm.elbow, w0 = sp.upperW, w1 = sp.upperW * 2.4;
      const end = add(e, d, sp.fore * 0.75);
      c.beginPath();
      c.moveTo(e.x + nx * w0, e.y + ny * w0);
      c.lineTo(end.x + nx * w1, end.y + ny * w1 + 1.2);
      c.lineTo(end.x - nx * w1 * 0.6, end.y - ny * w1 * 0.6 + 0.8);
      c.lineTo(e.x - nx * w0, e.y - ny * w0);
      c.closePath();
      c.fillStyle = limbGrad(c, e, end, w1, robe); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
      c.strokeStyle = alpha(sp.trim, 0.85); c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(end.x + nx * w1, end.y + ny * w1 + 1.2); c.lineTo(end.x - nx * w1 * 0.6, end.y - ny * w1 * 0.6 + 0.8); c.stroke();
      const wrist = add(e, d, sp.fore * 0.8);
      seg(c, wrist, arm.hand, sp.foreW * 0.45, sp.foreW * 0.4, shade(sp.skin, far ? 0.6 : 0.9));
      drawHand(c, sp, arm, far);
      return;
    }
    const sleeve = sp.shirt && sp.sleeve ? (far ? shade(sp.shirt, 0.68) : sp.shirt) : skinC;
    seg(c, arm.sh, arm.elbow, sp.upperW, sp.upperW * 0.85, sleeve);
    if (sp.shirt && sp.sleeve) {
      // Рваный край рукава
      const e = arm.elbow, d = dir(arm.U), nx = -d.y, ny = d.x, w = sp.upperW * 1.05;
      c.fillStyle = sleeve;
      c.beginPath();
      c.moveTo(e.x + nx * w - d.x * 2, e.y + ny * w - d.y * 2);
      c.lineTo(e.x + nx * w + d.x * 1.5, e.y + ny * w + d.y * 1.5);
      c.lineTo(e.x + d.x * 0.6, e.y + d.y * 0.6);
      c.lineTo(e.x - nx * w + d.x * 1.8, e.y - ny * w + d.y * 1.8);
      c.lineTo(e.x - nx * w - d.x * 2, e.y - ny * w - d.y * 2);
      c.closePath(); c.fill();
    }
    seg(c, arm.elbow, arm.hand, sp.foreW, sp.foreW * 0.8, skinC);
    if (sp.kind === 'golem') rockChunks(c, arm.sh, arm.hand, sp.upperW, sp, rnd, far);
    // Трупные пятна
    if (sp.kind === 'human') {
      const m = mid(arm.elbow, arm.hand, 0.45);
      c.fillStyle = alpha('#3a2a3a', 0.35); c.beginPath(); c.ellipse(m.x, m.y, sp.foreW * 0.55, sp.foreW * 0.35, arm.F, 0, PI * 2); c.fill();
    }
    if (sp.armor && !far) {
      // Наплечник с шипами
      const s = arm.sh;
      c.beginPath(); c.ellipse(s.x, s.y + 0.5, sp.upperW * 1.7, sp.upperW * 1.2, -0.2, PI * 0.95, PI * 2.05); c.closePath();
      c.fillStyle = A.lit(c, s.x, s.y, 4, '#7a7f88'); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
      for (let i = 0; i < 3; i++) {
        const a = PI * (1.15 + i * 0.32), bx = s.x + Math.cos(a) * sp.upperW * 1.4, by = s.y + Math.sin(a) * sp.upperW * 1.0;
        c.beginPath(); c.moveTo(bx - 0.7, by); c.lineTo(bx + Math.cos(a) * 2.6, by + Math.sin(a) * 2.6); c.lineTo(bx + 0.7, by); c.closePath();
        c.fillStyle = '#c8c8c8'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.3; c.stroke();
      }
    }
    if (sp.pauldron && !far) {
      const s = arm.sh;
      c.beginPath(); c.ellipse(s.x, s.y, 3.6, 2.6, -0.2, PI, PI * 2); c.closePath();
      c.fillStyle = A.lit(c, s.x, s.y, 4, '#c9a040'); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    }
    drawHand(c, sp, arm, far);
    if (sp.cleaver && !far) {
      const h = arm.hand, d = dir(arm.F);
      c.save(); c.translate(h.x, h.y); c.rotate(Math.atan2(d.y, d.x) - PI / 2);
      c.fillStyle = '#4a3020'; c.fillRect(-0.7, -1, 1.4, 4.5);
      c.beginPath(); c.moveTo(-1.2, 3.2); c.lineTo(5.8, 3.4); c.lineTo(6.2, 12.5); c.lineTo(-1.4, 12.5); c.closePath();
      const g = c.createLinearGradient(0, 3, 0, 12.5); g.addColorStop(0, '#d6dae2'); g.addColorStop(1, '#7c8088');
      c.fillStyle = g; c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = alpha('#7a1010', 0.8); c.fillRect(-1.3, 10.5, 7.4, 2); c.fillRect(2, 8, 1.4, 2.6);
      A.circle(c, 4.2, 5, 0.7, '#2a2a2a');
      c.restore();
    }
  }

  function rockChunks(c, a, b, r, sp, rnd, far) {
    const n = 3;
    for (let i = 0; i < n; i++) {
      const m = mid(a, b, (i + 0.5) / n);
      const col = far ? shade(sp.skin, 0.55 + rnd() * 0.1) : shade(sp.skin, 0.85 + rnd() * 0.3);
      c.beginPath();
      const k = 6;
      for (let j = 0; j < k; j++) {
        const an = (j / k) * PI * 2, rr = r * (0.75 + rnd() * 0.45);
        c.lineTo(m.x + Math.cos(an) * rr, m.y + Math.sin(an) * rr);
      }
      c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    }
    lava(c, a, b, rnd);
  }
  function lava(c, a, b, rnd) {
    c.save();
    c.shadowColor = '#ff8a2a'; c.shadowBlur = 3;
    c.strokeStyle = '#ffae4a'; c.lineWidth = 0.55;
    c.beginPath();
    let p = mid(a, b, 0.2);
    c.moveTo(p.x, p.y);
    for (let i = 1; i <= 4; i++) { p = mid(a, b, 0.2 + i * 0.15); c.lineTo(p.x + (rnd() - 0.5) * 2.4, p.y + (rnd() - 0.5) * 2.4); }
    c.stroke();
    c.restore();
  }

  // ---------------- Туловище ----------------
  function torsoPath(c, P, sp) {
    const { hip, sh, n, L } = P;
    const u = up(L);
    const at = (along, back) => ({ x: hip.x + u.x * sp.torso * along + n.x * back, y: hip.y + u.y * sp.torso * along + n.y * back });
    const hb = at(0, sp.waist * 0.5), hf = at(-0.02, -sp.waist * 0.45);
    const bel = at(0.32, -(sp.waist * 0.5 + sp.belly));
    const ch = at(0.72, -sp.chest * 0.52);
    const sf = at(0.97, -sp.chest * 0.3);
    const st = at(1.08, sp.chest * 0.12);
    const sb = at(0.94, sp.chest * 0.5 + sp.hunch * 0.4);
    const bk = at(0.55, sp.chest * 0.5 + sp.hunch);
    c.beginPath();
    c.moveTo(hb.x, hb.y);
    c.quadraticCurveTo(bk.x, bk.y, sb.x, sb.y);
    c.quadraticCurveTo(st.x + n.x * 1, st.y + n.y * 1 - 1, sf.x, sf.y);
    c.quadraticCurveTo(ch.x - n.x * 0.5, ch.y - n.y * 0.5, ch.x, ch.y + 1.5);
    c.quadraticCurveTo(bel.x, bel.y, hf.x, hf.y);
    c.closePath();
    return { at, hb, hf, ch, bk };
  }

  function drawTorso(c, sp, P, rnd) {
    const { hip, sh, L } = P;
    const u = up(L);
    const cx = (hip.x + sh.x) / 2, cy = (hip.y + sh.y) / 2;
    if (sp.kind === 'robe') return drawRobe(c, sp, P, rnd);
    const base = sp.shirt || sp.skin;
    const T = torsoPath(c, P, sp);
    c.fillStyle = A.lit(c, cx, cy, sp.torso * 0.75, base, 1.3, 0.55);
    c.fill();
    c.save();
    c.clip();
    if (!sp.shirt) {
      // Голый торс: рёбра, мышцы, швы
      if (sp.ribs) {
        c.strokeStyle = alpha('#2a2a1a', 0.5); c.lineWidth = 0.45;
        for (let i = 0; i < 5; i++) {
          const p = T.at(0.42 + i * 0.1, -sp.chest * 0.1);
          c.beginPath(); c.moveTo(p.x - 2.6, p.y + 0.8); c.quadraticCurveTo(p.x, p.y - 1, p.x + 2.4, p.y + 0.4); c.stroke();
        }
        // Позвонки
        for (let i = 0; i < 5; i++) { const p = T.at(0.35 + i * 0.12, sp.chest * 0.5 + sp.hunch * 0.75); A.circle(c, p.x, p.y, 0.5, alpha('#000000', 0.25)); }
      }
      if (sp.kind === 'human' && sp.chest > 14) {
        c.strokeStyle = alpha('#1a2210', 0.45); c.lineWidth = 0.5;
        const p = T.at(0.7, -sp.chest * 0.2);
        c.beginPath(); c.arc(p.x, p.y, 3.4, 0.2, PI * 0.9); c.stroke();
        const b = T.at(0.35, -sp.chest * 0.2);
        c.beginPath(); c.arc(b.x, b.y, 4.4, 0.3, PI * 0.8); c.stroke();
      }
      if (sp.kind === 'golem') {
        for (let i = 0; i < 9; i++) {
          const p = T.at(0.1 + rnd() * 0.9, (rnd() - 0.5) * sp.chest);
          c.beginPath();
          for (let j = 0; j < 6; j++) { const an = (j / 6) * PI * 2, rr = 2.4 + rnd() * 2.6; c.lineTo(p.x + Math.cos(an) * rr, p.y + Math.sin(an) * rr); }
          c.closePath(); c.fillStyle = shade(sp.skin, 0.8 + rnd() * 0.45); c.fill(); c.lineWidth = 0.4; c.strokeStyle = alpha('#000000', 0.5); c.stroke();
        }
        lava(c, T.at(0.15, 0), T.at(0.9, -2), rnd);
        lava(c, T.at(0.3, 4), T.at(0.7, -5), rnd);
        // Мох
        for (let i = 0; i < 5; i++) { const p = T.at(0.95, sp.chest * (0.1 + rnd() * 0.4)); A.circle(c, p.x, p.y, 1 + rnd(), alpha('#5a7a3a', 0.8)); }
      }
    } else {
      // Складки одежды
      c.strokeStyle = alpha('#000000', 0.28); c.lineWidth = 0.45;
      for (let i = 0; i < 4; i++) {
        const p = T.at(0.2 + i * 0.18, -sp.chest * 0.2 + i);
        c.beginPath(); c.moveTo(p.x - 2, p.y); c.quadraticCurveTo(p.x + 1, p.y + 1.6, p.x + 3.2, p.y + 0.4); c.stroke();
      }
      // Дыра в одежде с рёбрами
      const hole = T.at(0.5, -sp.chest * 0.18);
      blob(c, hole.x, hole.y, 2.6, shade(sp.skin, 0.65), rnd, 8);
      c.strokeStyle = alpha('#1a0a0a', 0.6); c.lineWidth = 0.4;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(hole.x - 1.8, hole.y - 1 + i); c.lineTo(hole.x + 1.6, hole.y - 1.4 + i); c.stroke(); }
      if (sp.armor) {
        // Кольчуга
        c.strokeStyle = alpha('#2a2a30', 0.6); c.lineWidth = 0.3;
        for (let yy = -30; yy < 2; yy += 1.3) for (let xx = -10; xx < 12; xx += 1.5) {
          c.beginPath(); c.arc(xx + ((yy / 1.3) % 2 ? 0.75 : 0), yy + hip.y + 20, 0.65, 0, PI); c.stroke();
        }
      }
    }
    // Кровь
    for (let i = 0; i < 3 + sp.blood * 4; i++) {
      const p = T.at(0.15 + rnd() * 0.8, (rnd() - 0.6) * sp.chest);
      blob(c, p.x, p.y, 0.8 + rnd() * 2 * sp.blood, alpha(rnd() < 0.5 ? '#5a0e0e' : '#3a0a0a', 0.55 + rnd() * 0.3), rnd, 6);
    }
    if (sp.stitches) {
      c.strokeStyle = '#2a1a14'; c.lineWidth = 0.4;
      const a = T.at(0.85, -sp.chest * 0.35), b = T.at(0.25, sp.chest * 0.1);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      for (let i = 0; i <= 6; i++) { const m = mid(a, b, i / 6); c.beginPath(); c.moveTo(m.x - 0.9, m.y - 0.6); c.lineTo(m.x + 0.9, m.y + 0.6); c.stroke(); }
    }
    c.restore();
    c.lineWidth = LWU; c.strokeStyle = OUT;
    torsoPath(c, P, sp); c.stroke();
    // Ремень
    if (sp.kind === 'human' && !sp.dress) {
      const a = T.at(0.05, sp.waist * 0.5), b = T.at(0.02, -sp.waist * 0.5 - sp.belly * 0.4);
      c.strokeStyle = sp.ropeBelt ? '#8a7448' : '#2a1d14'; c.lineWidth = sp.ropeBelt ? 1.2 : 1.4;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      if (!sp.ropeBelt) { const m = mid(a, b, 0.7); c.fillStyle = '#b8a060'; c.fillRect(m.x - 0.8, m.y - 0.9, 1.6, 1.8); }
    }
    // Рваный подол рубахи / платье
    if (sp.shirt && sp.kind === 'human') {
      const len = sp.dress ? 12 : 3.2;
      const a = T.hb, b = T.hf;
      c.beginPath();
      c.moveTo(a.x, a.y - 0.5);
      const N = sp.dress ? 7 : 6;
      for (let i = 0; i <= N; i++) {
        const m = mid(a, b, i / N);
        const l = len * (i % 2 ? 0.55 : 1) * (0.8 + rnd() * 0.4) + (sp.dress ? Math.sin(P.phi + i) * 0.8 : 0);
        c.lineTo(m.x + (sp.dress ? (i / N - 0.5) * 3 : 0), m.y + l);
      }
      c.lineTo(b.x, b.y - 0.5);
      c.closePath();
      c.fillStyle = A.lit(c, (a.x + b.x) / 2, a.y + len / 2, len, shade(base, 0.92));
      c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    }
    if (sp.apron) {
      const a = T.at(0.82, -sp.chest * 0.1), b = T.at(0.82, -sp.chest * 0.6);
      const bl = { x: b.x - 2.4, y: hip.y + 9 }, br = { x: a.x + 1, y: hip.y + 10 };
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.quadraticCurveTo(b.x - 5, hip.y - 4, bl.x, bl.y); c.lineTo(br.x, br.y); c.closePath();
      c.fillStyle = A.lit(c, a.x - 3, hip.y - 4, 10, '#d6cfbf'); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
      c.save(); c.clip();
      for (let i = 0; i < 9; i++) blob(c, a.x - 6 + rnd() * 8, hip.y - 10 + rnd() * 18, 1 + rnd() * 2.2, alpha('#7a1010', 0.55 + rnd() * 0.35), rnd, 6);
      c.strokeStyle = alpha('#7a1010', 0.6); c.lineWidth = 0.7;
      for (let i = 0; i < 3; i++) { const x = a.x - 4 + i * 2; c.beginPath(); c.moveTo(x, hip.y - 2); c.lineTo(x - 0.3, hip.y + 4 + rnd() * 4); c.stroke(); }
      c.restore();
      c.strokeStyle = '#4a3a2a'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(sh.x + 1, sh.y - 1.5); c.stroke();
    }
    // Раздутое брюхо
    if (sp.bloat) {
      const p = T.at(0.38, -sp.waist * 0.25 - sp.bloat * 0.35);
      const r = sp.bloat;
      const g = c.createRadialGradient(p.x - r * 0.1, p.y - r * 0.45, r * 0.1, p.x, p.y, r);
      g.addColorStop(0, shade(sp.skin, 1.35)); g.addColorStop(0.6, sp.skin); g.addColorStop(1, shade(sp.skin, 0.55));
      A.ellipse(c, p.x, p.y, r, r * 0.92, 0, g, OUT, LWU);
      c.strokeStyle = alpha('#2f4a14', 0.55); c.lineWidth = 0.4;
      for (let i = 0; i < 5; i++) {
        const a0 = rnd() * PI * 2;
        c.beginPath(); c.moveTo(p.x + Math.cos(a0) * r * 0.2, p.y + Math.sin(a0) * r * 0.2);
        c.quadraticCurveTo(p.x + Math.cos(a0 + 0.4) * r * 0.6, p.y + Math.sin(a0 + 0.4) * r * 0.6, p.x + Math.cos(a0 + 0.2) * r * 0.92, p.y + Math.sin(a0 + 0.2) * r * 0.92);
        c.stroke();
      }
      for (let i = 0; i < (sp.kind === 'bloat' ? 9 : 5); i++) {
        const a0 = rnd() * PI * 2, rr = r * (0.3 + rnd() * 0.6);
        const x = p.x + Math.cos(a0) * rr, y = p.y + Math.sin(a0) * rr * 0.9, pr = 0.8 + rnd() * (sp.kind === 'bloat' ? 1.8 : 1.2);
        c.save(); c.shadowColor = '#d8ff5a'; c.shadowBlur = 2.5;
        A.circle(c, x, y, pr, '#d4f05a', alpha('#3a4a10', 0.8), 0.3);
        c.restore();
        A.circle(c, x - pr * 0.3, y - pr * 0.3, pr * 0.3, alpha('#ffffff', 0.7));
      }
      A.ellipse(c, p.x - r * 0.15, p.y + r * 0.2, 0.8, 0.5, 0, alpha('#2a3010', 0.7));
    }
  }

  function drawRobe(c, sp, P, rnd) {
    const { hip, sh, L, phi, walking } = P;
    const sway = walking ? Math.sin(phi) * 1.6 : 0;
    const top0 = { x: sh.x - 4, y: sh.y + 1 }, top1 = { x: sh.x + 5, y: sh.y };
    const hemF = { x: -11 + sway, y: 0 }, hemB = { x: 11 + sway * 0.6, y: 0 };
    if (sp.cape) {
      c.beginPath();
      c.moveTo(sh.x + 3, sh.y - 1);
      c.quadraticCurveTo(sh.x + 14, hip.y, 17 + sway * 1.3, -1);
      for (let i = 0; i < 5; i++) c.lineTo(17 - i * 3 + sway * 1.2, -1 + (i % 2 ? -2.2 : 0));
      c.lineTo(sh.x + 1, sh.y + 4);
      c.closePath();
      c.fillStyle = A.lit(c, sh.x + 8, hip.y, 14, sp.cape, 1.2, 0.45); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    }
    c.beginPath();
    c.moveTo(top0.x, top0.y);
    c.quadraticCurveTo(hip.x - 7, hip.y, hemF.x, hemF.y);
    const N = 9;
    for (let i = 1; i < N; i++) {
      const u = i / N;
      c.lineTo(lerp(hemF.x, hemB.x, u), (i % 2 ? -2.4 : 0.2) + Math.sin(phi * 2 + i) * 0.5);
    }
    c.lineTo(hemB.x, hemB.y);
    c.quadraticCurveTo(hip.x + 8, hip.y, top1.x, top1.y);
    c.closePath();
    const g = c.createLinearGradient(hemB.x, sh.y, hemF.x, 0);
    g.addColorStop(0, shade(sp.shirt, 1.45)); g.addColorStop(0.5, sp.shirt); g.addColorStop(1, shade(sp.shirt, 0.55));
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    c.strokeStyle = alpha('#000000', 0.35); c.lineWidth = 0.6;
    for (let i = 0; i < 5; i++) {
      const x = -7 + i * 3.4 + sway * 0.5;
      c.beginPath(); c.moveTo(x * 0.4 + sh.x * 0.6, hip.y - 4); c.quadraticCurveTo(x + 1, hip.y + 8, x + sway * 0.4, 0); c.stroke();
    }
    // Кайма и руны
    c.strokeStyle = sp.trim; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(sh.x - 1, sh.y + 2); c.lineTo(hip.x - 2 + sway * 0.3, 0); c.stroke();
    c.globalAlpha = 0.8;
    for (let i = 0; i < 4; i++) { const y = hip.y + 2 + i * 4.5; A.circle(c, hip.x - 1.6 + sway * 0.1 * i, y, 0.6, sp.trim); }
    c.globalAlpha = 1;
    c.restore();
    c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    // Пояс с черепками / цепью
    c.strokeStyle = sp.crown ? '#c9a040' : '#5a4630'; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(hip.x - 6, hip.y + 1); c.lineTo(hip.x + 6, hip.y - 0.5); c.stroke();
    if (!sp.crown) { A.circle(c, hip.x - 3, hip.y + 3, 1.1, '#d8d4c0', OUT, 0.3); A.circle(c, hip.x - 3.5, hip.y + 2.8, 0.25, '#000'); }
  }

  // ---------------- Голова ----------------
  function drawHead(c, sp, P, rnd) {
    const { head, tilt, jaw } = P;
    const r = sp.headR;
    // Шея
    if (sp.kind !== 'bloat') {
      const nb = add(P.sh, up(P.L), -0.5);
      const neckC = sp.kind === 'robe' ? shade(sp.skin, 0.7) : shade(sp.skin, 0.85);
      seg(c, nb, { x: head.x + r * 0.15, y: head.y + r * 0.45 }, sp.kind === 'golem' ? 3 : r * 0.36, r * 0.32, neckC);
      if (sp.sac) {
        const s = { x: head.x - r * 0.1, y: head.y + r * 1.1 };
        c.save(); c.shadowColor = '#b6ff4a'; c.shadowBlur = 3;
        A.ellipse(c, s.x, s.y, r * 0.7, r * 0.55, -0.4, alpha('#a6e04a', 0.85), OUT, LWU);
        c.restore();
        c.strokeStyle = alpha('#2a4a10', 0.6); c.lineWidth = 0.3;
        c.beginPath(); c.moveTo(s.x - 2, s.y - 1); c.quadraticCurveTo(s.x, s.y + 1, s.x + 2, s.y - 1.2); c.stroke();
      }
    }
    c.save();
    c.translate(head.x, head.y);
    c.rotate(-tilt);
    const skin = sp.skin;
    if (sp.hood) {
      // Капюшон сзади
      c.beginPath();
      c.moveTo(-r * 1.25, -r * 0.3);
      c.bezierCurveTo(-r * 1.1, -r * 1.8, r * 1.4, -r * 1.7, r * 1.45, -r * 0.1);
      c.quadraticCurveTo(r * 1.5, r * 1.3, r * 0.7, r * 1.6);
      c.lineTo(-r * 0.6, r * 1.2);
      c.closePath();
      c.fillStyle = A.lit(c, 0, 0, r * 1.5, sp.shirt, 1.4, 0.5); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    }
    if (sp.hair === 'long') {
      c.beginPath();
      c.moveTo(-r * 0.2, -r * 1.0);
      c.bezierCurveTo(r * 1.4, -r * 1.1, r * 1.5, r * 0.8, r * 1.6, r * 2.4);
      c.lineTo(r * 0.6, r * 2.0); c.lineTo(r * 0.3, r * 0.6);
      c.closePath();
      c.fillStyle = sp.hairC; c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    }
    // Нижняя челюсть + рот
    const jawA = jaw;
    c.save();
    c.translate(r * 0.15, r * 0.42);
    c.rotate(-jawA * 0.6);
    c.beginPath();
    c.moveTo(r * 0.1, -r * 0.05); c.lineTo(-r * 1.05, r * 0.05); c.lineTo(-r * 1.02, r * 0.3); c.quadraticCurveTo(-r * 0.6, r * 0.6, r * 0.15, r * 0.35); c.closePath();
    c.fillStyle = sp.kind === 'robe' ? shade(skin, 0.85) : shade(skin, 0.8); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    // Нижние зубы
    c.fillStyle = '#d8d0b0';
    for (let i = 0; i < 4; i++) c.fillRect(-r * 0.95 + i * r * 0.2, -r * 0.08, r * 0.1, r * 0.14);
    c.restore();
    // Тёмная пасть
    c.fillStyle = '#2a0808';
    c.beginPath(); c.moveTo(-r * 1.0, r * 0.42); c.lineTo(-r * 0.2, r * 0.48); c.lineTo(-r * 0.9, r * 0.42 + jawA * r * 0.75); c.closePath(); c.fill();
    // Череп и лицо
    c.beginPath();
    c.moveTo(r * 0.55, r * 0.62);
    c.bezierCurveTo(r * 1.3, r * 0.4, r * 1.25, -r * 1.05, r * 0.1, -r * 1.05);
    c.bezierCurveTo(-r * 0.55, -r * 1.05, -r * 0.98, -r * 0.7, -r * 0.98, -r * 0.32);
    c.lineTo(-r * 0.86, -r * 0.1);
    c.lineTo(-r * 1.2, r * 0.16);
    c.lineTo(-r * 0.94, r * 0.28);
    c.lineTo(-r * 1.02, r * 0.44);
    c.lineTo(-r * 0.3, r * 0.52);
    c.closePath();
    const g = c.createRadialGradient(r * 0.35, -r * 0.55, r * 0.1, 0, 0, r * 1.35);
    g.addColorStop(0, shade(skin, sp.kind === 'robe' ? 1.25 : 1.3)); g.addColorStop(0.55, skin); g.addColorStop(1, shade(skin, 0.55));
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    // Пятна и раны
    if (sp.kind !== 'robe' && sp.kind !== 'golem') {
      for (let i = 0; i < 3; i++) blob(c, (rnd() - 0.3) * r, (rnd() - 0.6) * r, r * (0.15 + rnd() * 0.15), alpha('#3a3a2a', 0.35), rnd, 6);
    }
    if (sp.wound) {
      blob(c, r * 0.35, -r * 0.6, r * 0.35, '#d8cfb8', rnd, 7);
      c.strokeStyle = '#6a1010'; c.lineWidth = 0.5; c.beginPath(); c.arc(r * 0.35, -r * 0.6, r * 0.38, 0, PI * 2); c.stroke();
    }
    if (sp.kind === 'golem') {
      c.strokeStyle = alpha('#000000', 0.45); c.lineWidth = 0.4;
      c.beginPath(); c.moveTo(-r * 0.2, -r); c.lineTo(r * 0.1, -r * 0.2); c.lineTo(r * 0.6, 0); c.stroke();
    }
    if (sp.stitches) {
      c.strokeStyle = '#2a1a14'; c.lineWidth = 0.35;
      c.beginPath(); c.moveTo(-r * 0.4, -r * 0.95); c.quadraticCurveTo(r * 0.3, -r * 0.4, r * 0.9, -r * 0.6); c.stroke();
      for (let i = 0; i < 5; i++) { const x = -r * 0.3 + i * r * 0.25, y = -r * 0.85 + i * r * 0.07; c.beginPath(); c.moveTo(x - 0.4, y - 0.6); c.lineTo(x + 0.4, y + 0.6); c.stroke(); }
    }
    // Ухо
    A.ellipse(c, r * 0.32, r * 0.02, r * 0.17, r * 0.27, 0.2, shade(skin, 0.75), alpha('#000000', 0.4), 0.3);
    c.restore();
    c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    // Верхние зубы
    c.fillStyle = '#e0d8b8';
    for (let i = 0; i < 4; i++) {
      c.beginPath(); const x = -r * 0.98 + i * r * 0.19; c.moveTo(x, r * 0.43); c.lineTo(x + r * 0.13, r * 0.44); c.lineTo(x + r * 0.06, r * 0.6); c.closePath(); c.fill();
    }
    // Глазница и глаз
    A.ellipse(c, -r * 0.58, -r * 0.12, r * 0.27, r * 0.21, 0.15, sp.kind === 'robe' ? '#050308' : alpha('#1a0606', 0.85));
    c.save(); c.shadowColor = sp.eye; c.shadowBlur = sp.kind === 'robe' || sp.kind === 'golem' || sp.armor ? 4 : 2;
    A.circle(c, -r * 0.64, -r * 0.1, r * 0.11, sp.eye);
    c.restore();
    A.circle(c, -r * 0.64, -r * 0.1, r * 0.04, '#ffffff');
    // Брови/надбровье
    c.strokeStyle = alpha('#000000', 0.5); c.lineWidth = 0.45;
    c.beginPath(); c.moveTo(-r * 0.92, -r * 0.36); c.lineTo(-r * 0.36, -r * 0.3); c.stroke();
    if (sp.kind === 'robe') {
      // Скуловые провалы черепа
      c.fillStyle = alpha('#000000', 0.5); c.beginPath(); c.moveTo(-r * 1.05, r * 0.12); c.lineTo(-r * 0.86, r * 0.02); c.lineTo(-r * 0.9, r * 0.25); c.fill();
      c.strokeStyle = alpha('#000000', 0.45); c.lineWidth = 0.4;
      c.beginPath(); c.moveTo(-r * 0.4, r * 0.1); c.quadraticCurveTo(-r * 0.2, r * 0.35, r * 0.1, r * 0.3); c.stroke();
    }
    // Волосы
    if (sp.hair === 'messy') {
      c.strokeStyle = sp.hairC; c.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const a0 = -PI * 0.85 + i * 0.2;
        const x0 = Math.cos(a0) * r * 0.85 + r * 0.15, y0 = Math.sin(a0) * r * 0.85 - r * 0.15;
        c.lineWidth = 0.6 + rnd() * 0.5;
        c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + r * 0.4, y0 - r * 0.15, x0 + r * (0.5 + rnd() * 0.4), y0 + r * (0.2 + rnd() * 0.4)); c.stroke();
      }
    } else if (sp.hair === 'long') {
      c.fillStyle = sp.hairC;
      c.beginPath(); c.moveTo(-r * 0.9, -r * 0.5); c.bezierCurveTo(-r * 0.6, -r * 1.3, r * 1.0, -r * 1.3, r * 1.2, -r * 0.2); c.quadraticCurveTo(r * 0.3, -r * 0.7, -r * 0.9, -r * 0.5); c.fill();
    }
    if (sp.armor) {
      // Ржавый шлем
      c.beginPath(); c.moveTo(-r * 1.15, -r * 0.25); c.bezierCurveTo(-r * 1.1, -r * 1.45, r * 1.35, -r * 1.45, r * 1.3, -r * 0.05); c.lineTo(r * 1.15, r * 0.5); c.lineTo(r * 0.5, r * 0.35); c.lineTo(r * 0.4, -r * 0.2); c.lineTo(-r * 1.15, -r * 0.25); c.closePath();
      c.fillStyle = A.lit(c, 0, -r * 0.5, r * 1.2, '#6e737c', 1.35, 0.5); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
      c.save(); c.clip();
      for (let i = 0; i < 6; i++) blob(c, (rnd() - 0.4) * r * 2, -r * 0.7 + rnd() * r * 0.6, r * 0.2, alpha('#8a4a2a', 0.6), rnd, 5);
      c.restore();
      c.strokeStyle = alpha('#2a2a2a', 0.8); c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(-r * 0.1, -r * 1.25); c.lineTo(-r * 0.15, -r * 0.25); c.stroke();
      for (let i = 0; i < 4; i++) A.circle(c, -r * 1.0 + i * r * 0.6, -r * 0.3, 0.3, '#ccc');
    }
    if (sp.hood) {
      // Передний край капюшона — тень на лице
      c.beginPath();
      c.moveTo(-r * 1.3, -r * 0.2); c.bezierCurveTo(-r * 1.0, -r * 1.75, r * 0.6, -r * 1.65, r * 0.9, -r * 0.9);
      c.quadraticCurveTo(-r * 0.4, -r * 1.15, -r * 0.95, -r * 0.1); c.closePath();
      c.fillStyle = shade(sp.shirt, 1.25); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    }
    if (sp.crown) {
      c.beginPath();
      const y0 = -r * 0.7;
      c.moveTo(-r * 0.95, y0); c.lineTo(-r * 1.05, y0 - r * 0.9); c.lineTo(-r * 0.6, y0 - r * 0.45); c.lineTo(-r * 0.25, y0 - r * 1.25); c.lineTo(r * 0.1, y0 - r * 0.5);
      c.lineTo(r * 0.5, y0 - r * 1.15); c.lineTo(r * 0.75, y0 - r * 0.35); c.lineTo(r * 1.15, y0 - r * 0.8); c.lineTo(r * 1.05, y0 + r * 0.15); c.closePath();
      c.fillStyle = A.lit(c, 0, y0 - r * 0.5, r, '#e2b84a', 1.4, 0.55); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
      c.save(); c.shadowColor = '#5ad2ff'; c.shadowBlur = 3;
      A.circle(c, -r * 0.25, y0 - r * 0.15, r * 0.14, '#5ad2ff'); A.circle(c, r * 0.5, y0 - r * 0.1, r * 0.11, '#ff3a5a');
      c.restore();
    }
    c.restore();
  }

  function drawStaff(c, sp, P) {
    const h = P.arms[1].hand;
    const top = { x: h.x - 0.6, y: h.y - 22 }, bot = { x: h.x + 0.5, y: h.y + 13 };
    c.lineCap = 'round';
    c.strokeStyle = OUT; c.lineWidth = 2.1;
    c.beginPath(); c.moveTo(bot.x, bot.y); c.quadraticCurveTo(h.x + 1.2, h.y - 8, top.x, top.y); c.stroke();
    c.strokeStyle = sp.staff === 'crystal' ? '#3a2a4a' : '#5a3e24'; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(bot.x, bot.y); c.quadraticCurveTo(h.x + 1.2, h.y - 8, top.x, top.y); c.stroke();
    if (sp.staff === 'skull') {
      A.circle(c, top.x, top.y - 1.5, 2.2, '#d8d4c0', OUT, LWU);
      A.circle(c, top.x - 0.9, top.y - 1.7, 0.55, '#000'); A.circle(c, top.x + 0.5, top.y - 1.7, 0.45, '#000');
      c.save(); c.shadowColor = '#7dff6a'; c.shadowBlur = 5;
      A.circle(c, top.x, top.y - 5.2, 1.8, '#a6ff8a');
      c.restore();
      c.strokeStyle = '#5a3e24'; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(top.x - 2, top.y - 2.5); c.quadraticCurveTo(top.x - 2.8, top.y - 5, top.x - 1, top.y - 6.6); c.moveTo(top.x + 2, top.y - 2.5); c.quadraticCurveTo(top.x + 2.8, top.y - 5, top.x + 1, top.y - 6.6); c.stroke();
    } else {
      c.save(); c.shadowColor = '#5ad2ff'; c.shadowBlur = 6;
      c.beginPath(); c.moveTo(top.x, top.y - 8); c.lineTo(top.x + 2, top.y - 3.5); c.lineTo(top.x, top.y + 0.5); c.lineTo(top.x - 2, top.y - 3.5); c.closePath();
      c.fillStyle = '#9ae4ff'; c.fill();
      c.restore();
      c.strokeStyle = OUT; c.lineWidth = 0.4; c.stroke();
      c.strokeStyle = '#e2b84a'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(top.x - 2.4, top.y - 1); c.quadraticCurveTo(top.x, top.y + 1.5, top.x + 2.4, top.y - 1); c.stroke();
    }
  }

  // ---------------- Сборка фигуры ----------------
  function drawFigure(c, type, variant, anim, f) {
    const list = SPECS[type] || SPECS.walker;
    const sp = list[variant % list.length];
    const P = pose(sp, anim, f);
    const rnd = A.seeded(type.length * 131 + variant * 17 + 7);
    const R = () => rnd();
    // Порядок: дальняя рука, дальняя нога, туловище, ближняя нога, голова, ближняя рука
    if (sp.kind === 'robe') {
      drawArm(c, sp, P.arms[0], true, R);
      drawTorso(c, sp, P, A.seeded(type.length * 13 + 1));
      drawHead(c, sp, P, A.seeded(type.length * 7 + variant));
      drawStaff(c, sp, P);
      drawArm(c, sp, P.arms[1], false, R);
      return;
    }
    drawArm(c, sp, P.arms[0], true, A.seeded(3));
    drawLeg(c, sp, P.legs[0], true, A.seeded(5));
    if (sp.kind === 'bloat') drawLeg(c, sp, P.legs[1], false, A.seeded(6));
    drawTorso(c, sp, P, A.seeded(type.length * 13 + variant * 3 + 1));
    if (sp.kind !== 'bloat') drawLeg(c, sp, P.legs[1], false, A.seeded(6));
    drawHead(c, sp, P, A.seeded(type.length * 7 + variant));
    drawArm(c, sp, P.arms[1], false, A.seeded(4));
  }

  // ---------------- Кеш спрайтов ----------------
  const cache = new Map();
  const restCache = new Map();
  const ZArt = {
    R: 2,
    BX0, BY0, BW, BH,
    setRes(R) {
      R = Math.round(R * 4) / 4;
      if (R !== this.R) { this.R = R; cache.clear(); }
    },
    variants(type) { return (SPECS[type] || SPECS.walker).length; },
    stride(type) { return ((SPECS[type] || SPECS.walker)[0]).stride; },
    // Поза «лёжа»: на сколько повернуть спрайт вокруг ступней и опустить, чтобы тело легло на землю
    deathRest(type, variant) {
      const key = type + '|' + variant;
      if (restCache.has(key)) return restCache.get(key);
      const list = SPECS[type] || SPECS.walker;
      const sp = list[variant % list.length];
      const P = pose(sp, 'death', FRAMES.death - 1);
      const c = Math.cos(DEATH_ROT), s = Math.sin(DEATH_ROT);
      let maxY = -1e9;
      for (const [pt, r] of [[P.hip, sp.waist * 0.5], [P.sh, sp.chest * 0.45], [P.head, sp.headR]]) maxY = Math.max(maxY, pt.x * s + pt.y * c + r);
      const rest = { rot: DEATH_ROT, dy: Math.max(0, -maxY) };
      restCache.set(key, rest);
      return rest;
    },
    frame(z) {
      if (z.state === 'dead') return { anim: 'death', f: Math.min(FRAMES.death - 1, Math.floor((z.deadT / 0.6) * (FRAMES.death - 1))) };
      if (z.state === 'attack') {
        if (z.type === 'spitter') return { anim: 'spit', f: Math.min(5, Math.floor(clamp(z.atkAnim / 0.9, 0, 0.999) * 6)) };
        return { anim: 'attack', f: Math.floor(clamp(z.atkAnim / 0.75, 0, 0.999) * 8) };
      }
      const st = this.stride(z.type);
      const cyc = (z.t * z.speed) / st + z.seed * 7;
      const frac = cyc - Math.floor(cyc);
      return { anim: 'walk', f: Math.floor(frac * 12) % 12 };
    },
    sprite(type, variant, anim, f, tint, size) {
      const key = type + '|' + variant + '|' + anim + '|' + f + '|' + (tint || '');
      let s = cache.get(key);
      if (s) return s;
      const R = this.R * (size || 1);
      const w = Math.ceil(BW * R), h = Math.ceil(BH * R);
      if (tint) {
        const base = this.sprite(type, variant, anim, f, null, size);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const x = cv.getContext('2d');
        x.drawImage(base.img, 0, 0);
        x.globalCompositeOperation = 'source-atop';
        x.fillStyle = tint === 'flash' ? 'rgba(255,240,230,0.55)' : 'rgba(255,120,30,0.35)';
        x.fillRect(0, 0, w, h);
        s = { img: cv };
      } else {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const x = cv.getContext('2d');
        x.setTransform(R, 0, 0, R, -BX0 * R, -BY0 * R);
        x.lineJoin = 'round';
        drawFigure(x, type, variant, anim, f);
        s = { img: cv };
      }
      cache.set(key, s);
      return s;
    },
    draw: drawFigure,
  };
  TD.ZArt = ZArt;
})();
