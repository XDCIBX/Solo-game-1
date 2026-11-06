/* Защитники и орудия: детализированные фигуры в локальных координатах (смотрят вправо) */
(function () {
  const TD = globalThis.TD;
  const A = TD.Art;
  const { PI, shade, alpha, OUT, circle, ellipse, line, capsule } = A;
  const LWU = 0.45;

  // Деревянный брус с текстурой: от (x1,y1) до (x2,y2), толщина w
  function beam(c, x1, y1, x2, y2, w, col, bands) {
    const a = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1);
    c.save();
    c.translate(x1, y1); c.rotate(a);
    const g = c.createLinearGradient(0, -w / 2, 0, w / 2);
    g.addColorStop(0, shade(col, 1.3)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, 0.6));
    c.fillStyle = g;
    c.fillRect(0, -w / 2, L, w);
    c.strokeStyle = alpha('#1a0e06', 0.35); c.lineWidth = 0.25;
    c.beginPath();
    for (let i = 1; i < 3; i++) { const y = -w / 2 + (w * i) / 3; c.moveTo(1, y); c.lineTo(L - 1, y + (i % 2 ? 0.2 : -0.2)); }
    c.stroke();
    if (bands) {
      for (const u of bands) {
        c.fillStyle = '#3a3a40'; c.fillRect(L * u - 0.8, -w / 2 - 0.2, 1.6, w + 0.4);
        c.fillStyle = '#9a9aa0'; c.fillRect(L * u - 0.3, -w / 2 + 0.3, 0.5, 0.5); c.fillRect(L * u - 0.3, w / 2 - 0.8, 0.5, 0.5);
      }
    }
    c.strokeStyle = OUT; c.lineWidth = LWU; c.strokeRect(0, -w / 2, L, w);
    c.restore();
  }

  function wheel(c, x, y, r, col, rot) {
    circle(c, x, y, r, '#2a2018', OUT, LWU);
    circle(c, x, y, r * 0.86, shade(col, 0.85));
    c.strokeStyle = '#5a5a60'; c.lineWidth = r * 0.16; c.beginPath(); c.arc(x, y, r * 0.93, 0, PI * 2); c.stroke();
    c.strokeStyle = shade(col, 1.1); c.lineWidth = r * 0.14;
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = rot + (i / 8) * PI * 2; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82); }
    c.stroke();
    circle(c, x, y, r * 0.28, '#3a3a40', OUT, LWU * 0.7);
    circle(c, x - r * 0.06, y - r * 0.06, r * 0.1, '#9a9aa0');
  }

  function rope(c, x1, y1, x2, y2, sag, w) {
    c.strokeStyle = '#6a5636'; c.lineWidth = w || 0.6;
    c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + (sag || 0), x2, y2); c.stroke();
    c.strokeStyle = alpha('#d8c49a', 0.6); c.lineWidth = (w || 0.6) * 0.4; c.setLineDash([0.6, 0.6]);
    c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + (sag || 0), x2, y2); c.stroke();
    c.setLineDash([]);
  }

  // ---------------- Лучник ----------------
  const ATIERS = [
    { tunic: '#5c4a30', cloak: '#4a5a34', hood: '#3e5a2e', pants: '#4a3a2a', bow: '#8a5a2b', trim: null, helm: 'hood' },
    { tunic: '#7c2a2a', cloak: '#5a2424', hood: '#8f969e', pants: '#3a3632', bow: '#7a4e26', trim: '#c9a040', helm: 'kettle', mail: true },
    { tunic: '#2c4a8a', cloak: '#1f3366', hood: '#b8c0cc', pants: '#2a2a34', bow: '#d6b25a', trim: '#e8c060', helm: 'sallet', mail: true },
  ];

  function drawArcher(c, o) {
    const T = ATIERS[o.tier || 0];
    const t = o.time || 0;
    const v = o.variant || 0;
    const wind = Math.sin(t * 2.2 + v) * 1.2;
    // Плащ
    c.beginPath();
    c.moveTo(-1.5, -21); c.quadraticCurveTo(-7 + wind * 0.4, -12, -7.5 + wind, -3);
    for (let i = 0; i < 4; i++) c.lineTo(-7.5 + wind + i * 1.8, -3 + (i % 2 ? -1.2 : 0));
    c.lineTo(-1, -9); c.closePath();
    c.fillStyle = A.lit(c, -4, -12, 9, T.cloak, 1.25, 0.5); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    // Ноги
    for (const [x, col] of [[-1.8, shade(T.pants, 0.7)], [2.2, T.pants]]) {
      capsule(c, x * 0.5, -11, x, -2.5, 1.5, 1.2); c.fillStyle = col; c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(x - 1.4, -3.6); c.lineTo(x + 1.3, -3.6); c.lineTo(x + 3, 0); c.lineTo(x - 1.6, 0); c.closePath();
      c.fillStyle = '#3a2618'; c.fill(); c.stroke();
    }
    // Колчан
    c.save(); c.translate(-3.6, -16); c.rotate(-0.35);
    c.fillStyle = A.lit(c, 0, 0, 5, '#6a4426'); c.fillRect(-1.6, -6, 3.2, 11); c.strokeStyle = OUT; c.lineWidth = LWU; c.strokeRect(-1.6, -6, 3.2, 11);
    c.fillStyle = '#3a2618'; c.fillRect(-1.7, -6, 3.4, 1.1);
    const fl = ['#e8e0d0', '#c33', '#e8e0d0', '#2a6a3a'];
    for (let i = 0; i < 4; i++) {
      line(c, -1 + i * 0.7, -6, -1.3 + i * 0.7, -8.5 - (i % 2), '#7a5a3a', 0.35);
      c.fillStyle = fl[i]; c.beginPath(); c.moveTo(-1.3 + i * 0.7, -8.5 - (i % 2)); c.lineTo(-0.9 + i * 0.7, -10.2 - (i % 2)); c.lineTo(-1.8 + i * 0.7, -9.8 - (i % 2)); c.fill();
    }
    c.restore();
    // Туловище
    c.beginPath();
    c.moveTo(-3.4, -21.5); c.lineTo(3.2, -21.5); c.quadraticCurveTo(4.4, -16, 3.8, -11); c.lineTo(5, -8.5); c.lineTo(-4.8, -8.5); c.lineTo(-3.8, -11); c.quadraticCurveTo(-4.4, -16, -3.4, -21.5);
    c.closePath();
    c.fillStyle = A.lit(c, 0, -15, 8, T.mail ? '#7d828a' : T.tunic, 1.3, 0.55); c.fill();
    c.save(); c.clip();
    if (T.mail) {
      c.strokeStyle = alpha('#2a2a30', 0.55); c.lineWidth = 0.22;
      for (let y = -22; y < -8; y += 0.9) for (let x = -5; x < 5; x += 1) { c.beginPath(); c.arc(x + ((y * 10) % 2 ? 0.5 : 0), y, 0.45, 0, PI); c.stroke(); }
      // Табард
      c.fillStyle = A.lit(c, 0, -15, 6, T.tunic, 1.25, 0.6);
      c.beginPath(); c.moveTo(-2.2, -21.5); c.lineTo(2.4, -21.5); c.lineTo(2.8, -8.5); c.lineTo(-2.6, -8.5); c.closePath(); c.fill();
      if (T.trim) { c.strokeStyle = T.trim; c.lineWidth = 0.4; c.stroke(); circle(c, 0.2, -15.5, 1, T.trim); }
    } else {
      c.strokeStyle = alpha('#000000', 0.3); c.lineWidth = 0.3;
      c.beginPath(); c.moveTo(-1, -21); c.lineTo(-1.5, -12); c.moveTo(1.6, -20); c.lineTo(2, -12); c.stroke();
    }
    c.restore();
    c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = '#2a1a10'; c.fillRect(-4, -12.2, 8.4, 1.3);
    c.fillStyle = '#c9a040'; c.fillRect(0.6, -12.3, 1.3, 1.5);
    // Голова
    const hx = 0.6, hy = -25;
    circle(c, hx, hy + 2.6, 1.3, '#c49072');
    c.beginPath(); c.arc(hx, hy, 3.3, 0, PI * 2);
    c.fillStyle = A.lit(c, hx, hy, 3.3, '#d6a88a', 1.2, 0.7); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = '#c49072'; c.beginPath(); c.moveTo(hx + 3, hy - 0.6); c.lineTo(hx + 4.4, hy + 0.8); c.lineTo(hx + 3.1, hy + 1); c.fill();
    circle(c, hx + 1.9, hy - 0.5, 0.4, '#1a1a1a');
    if (v % 3 === 1) { c.fillStyle = '#5a3a20'; c.beginPath(); c.moveTo(hx - 1, hy + 1.2); c.quadraticCurveTo(hx + 1.5, hy + 4.6, hx + 3.3, hy + 1.6); c.lineTo(hx + 1, hy + 1.8); c.closePath(); c.fill(); }
    if (T.helm === 'hood') {
      c.beginPath(); c.moveTo(hx + 2.9, hy - 1.6); c.bezierCurveTo(hx + 2, hy - 5.4, hx - 4.6, hy - 5, hx - 4.6, hy); c.lineTo(hx - 3, hy + 3.4); c.lineTo(hx - 1, hy + 1.5); c.quadraticCurveTo(hx - 1.2, hy - 2.8, hx + 2.9, hy - 1.6); c.closePath();
      c.fillStyle = A.lit(c, hx - 1, hy - 2, 4, T.hood, 1.3, 0.55); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    } else if (T.helm === 'kettle') {
      c.beginPath(); c.arc(hx, hy - 0.6, 3.6, PI * 1.02, PI * 1.98); c.closePath();
      c.fillStyle = A.lit(c, hx, hy - 2, 4, T.hood, 1.4, 0.55); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
      ellipse(c, hx, hy - 0.8, 5.2, 0.9, 0, shade(T.hood, 0.85), OUT, LWU);
    } else {
      c.beginPath(); c.moveTo(hx + 3.6, hy - 0.4); c.bezierCurveTo(hx + 3, hy - 5, hx - 4, hy - 5, hx - 5.2, hy + 0.6); c.lineTo(hx - 3, hy + 0.2); c.lineTo(hx + 3.6, hy - 0.4); c.closePath();
      c.fillStyle = A.lit(c, hx, hy - 2, 4, T.hood, 1.45, 0.55); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
      line(c, hx + 3.4, hy - 1.5, hx - 1, hy - 1.2, '#2a2a30', 0.5);
      c.fillStyle = '#3a6ad8'; c.beginPath(); c.moveTo(hx - 1, hy - 4.2); c.quadraticCurveTo(hx - 5, hy - 8 + wind * 0.3, hx - 7, hy - 3.5 + wind * 0.4); c.quadraticCurveTo(hx - 4, hy - 4.5, hx - 1, hy - 4.2); c.fill();
    }
    // Руки и лук (вращение к цели)
    c.save();
    c.translate(0.8, -19);
    c.rotate(o.aim);
    const pull = o.pull || 0, snap = o.snap || 0;
    const bowX = 10;
    const bend = 0.95 + pull * 0.22;
    const R = 9.5;
    const cxb = bowX - R * Math.cos(bend) * 0.0 - R * 0.62;
    // Дальняя рука (натягивает тетиву)
    const hand = bowX - 2.2 - pull * 9 + snap * 1.2;
    capsule(c, 0, 0.6, hand * 0.55, 1.6, 1.15, 1.0); c.fillStyle = shade(T.mail ? '#7d828a' : T.tunic, 0.75); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    capsule(c, hand * 0.55, 1.6, hand, 0.4, 1.0, 0.85); c.fillStyle = '#b88a6a'; c.fill(); c.stroke();
    // Лук: рекурсивная дуга
    const tip = (sgn) => ({ x: cxb + Math.cos(bend) * R, y: sgn * Math.sin(bend) * R });
    c.lineCap = 'round';
    for (const [w, col] of [[2.0, OUT], [1.3, T.bow]]) {
      c.strokeStyle = col; c.lineWidth = w;
      c.beginPath(); c.arc(cxb, 0, R, -bend, bend); c.stroke();
      c.beginPath();
      const t1 = tip(-1), t2 = tip(1);
      c.moveTo(t1.x, t1.y); c.lineTo(t1.x - 1.2, t1.y - 0.9);
      c.moveTo(t2.x, t2.y); c.lineTo(t2.x - 1.2, t2.y + 0.9);
      c.stroke();
    }
    c.fillStyle = '#3a2618'; c.fillRect(cxb + R - 0.9, -1.4, 1.8, 2.8);
    const t1 = tip(-1), t2 = tip(1);
    c.strokeStyle = '#efe6d0'; c.lineWidth = 0.35;
    c.beginPath(); c.moveTo(t1.x - 1.2, t1.y - 0.9); c.lineTo(hand - 0.5, 0); c.lineTo(t2.x - 1.2, t2.y + 0.9); c.stroke();
    // Стрела
    if (o.nocked) {
      line(c, hand - 1, 0, hand + 17, 0, '#d8c09a', 0.55);
      c.fillStyle = '#b8b8c0'; c.beginPath(); c.moveTo(hand + 19, 0); c.lineTo(hand + 16.5, -1.1); c.lineTo(hand + 16.5, 1.1); c.fill();
      c.fillStyle = '#e8e0d0'; c.beginPath(); c.moveTo(hand - 1, 0); c.lineTo(hand + 1.6, -1.2); c.lineTo(hand + 2.2, 0); c.lineTo(hand + 1.6, 1.2); c.closePath(); c.fill();
      if (o.fire) { c.save(); c.shadowColor = '#ff8a2a'; c.shadowBlur = 4; circle(c, hand + 18.5, 0, 1.2, '#ffb34a'); c.restore(); }
    }
    // Ближняя рука (держит лук)
    capsule(c, 0, -0.4, bowX * 0.55, -0.6, 1.2, 1.05); c.fillStyle = T.mail ? '#8d929a' : T.tunic; c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    capsule(c, bowX * 0.55, -0.6, cxb + R - 0.2, 0, 1.05, 0.9); c.fillStyle = '#c69a7a'; c.fill(); c.stroke();
    c.fillStyle = '#5a3a20'; c.fillRect(bowX * 0.6, -1.5, 2.2, 2.2);
    circle(c, cxb + R, 0, 1.1, '#d6a88a', OUT, LWU * 0.8);
    c.restore();
  }

  // ---------------- Баллиста ----------------
  function drawBallista(c, o) {
    const gold = o.tier >= 2;
    const wood = '#7a5432', dark = '#4b3220';
    // Опора-тренога
    beam(c, -1, 0, -9, 8, 1.6, dark);
    beam(c, 1, 0, 9, 8, 1.6, dark);
    beam(c, 0, 0, 0, 9, 1.8, wood);
    ellipse(c, 0, 0, 5, 1.8, 0, '#3a3a40', OUT, LWU);
    c.save();
    c.rotate(o.aim);
    c.translate(-(o.recoil || 0), 0);
    // Ложе
    beam(c, -15, 0, 18, 0, 3.6, wood, [0.15, 0.85]);
    line(c, -12, -0.6, 17, -0.6, alpha('#1a0e06', 0.6), 0.6);
    // Ворот сзади
    wheel(c, -14, 2.6, 3, dark, (o.crank || 0));
    // Торсионные пружины
    for (const s of [-1, 1]) {
      c.fillStyle = A.lit(c, 10, s * 4, 4, '#5a4a3a'); c.fillRect(8.5, s > 0 ? 1.5 : -6.5, 3.6, 5); c.strokeStyle = OUT; c.lineWidth = LWU; c.strokeRect(8.5, s > 0 ? 1.5 : -6.5, 3.6, 5);
      c.strokeStyle = '#b89a6a'; c.lineWidth = 0.35;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(8.7, (s > 0 ? 2 : -6) + i * 1.2); c.lineTo(11.9, (s > 0 ? 2.5 : -5.5) + i * 1.2); c.stroke(); }
      if (gold) { c.fillStyle = '#d6b25a'; c.fillRect(8.3, s > 0 ? 6.2 : -6.8, 4, 0.7); }
    }
    // Плечи
    const pb = o.pull != null ? o.pull : 1;
    const armCol = gold ? '#b8944a' : '#5a3a20';
    for (const s of [-1, 1]) {
      c.lineCap = 'round';
      c.strokeStyle = OUT; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(10.3, s * 4); c.quadraticCurveTo(7 - pb * 3, s * 11, 2 - pb * 4, s * 15); c.stroke();
      c.strokeStyle = armCol; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(10.3, s * 4); c.quadraticCurveTo(7 - pb * 3, s * 11, 2 - pb * 4, s * 15); c.stroke();
    }
    const sx = 9 - pb * 19;
    c.strokeStyle = '#e8dcbc'; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(2 - pb * 4, -15); c.lineTo(sx, 0); c.lineTo(2 - pb * 4, 15); c.stroke();
    if (o.loaded) {
      beam(c, sx, 0, sx + 26, 0, 1.4, '#4a3220');
      c.fillStyle = '#c8ccd4'; c.beginPath(); c.moveTo(sx + 31, 0); c.lineTo(sx + 25.5, -2.2); c.lineTo(sx + 26.5, 0); c.lineTo(sx + 25.5, 2.2); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.3; c.stroke();
      c.fillStyle = '#aa2222'; c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx + 4, -2.4); c.lineTo(sx + 5, 0); c.lineTo(sx + 4, 2.4); c.closePath(); c.fill();
    }
    c.restore();
  }

  // ---------------- Солдат-расчёт ----------------
  function drawCrew(c, o) {
    const ph = o.phase || 0, pose = o.pose || 'stand';
    const tunic = o.tunic || '#6a3a2a';
    for (const [x, col] of [[-1.4, '#2e2620'], [1.6, '#3a3028']]) {
      capsule(c, x * 0.5, -10, x + (pose === 'crank' ? Math.sin(ph) * 0.6 : 0), -2, 1.3, 1.1); c.fillStyle = col; c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = '#2a1a10'; c.fillRect(x - 1.3, -2.4, 3.2, 2.4);
    }
    c.beginPath(); c.moveTo(-3, -19.5); c.lineTo(3, -19.5); c.lineTo(3.8, -8.5); c.lineTo(-3.8, -8.5); c.closePath();
    c.fillStyle = A.lit(c, 0, -14, 6, tunic); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = '#2a1a10'; c.fillRect(-3.6, -11.5, 7.2, 1.1);
    circle(c, 0.4, -22.6, 2.9, '#d0a080', OUT, LWU);
    c.fillStyle = '#7a7f88'; c.beginPath(); c.arc(0.4, -23.2, 3.2, PI, 0); c.fill(); c.stroke();
    c.fillStyle = '#c49072'; c.beginPath(); c.moveTo(3, -23); c.lineTo(4.1, -21.8); c.lineTo(3, -21.6); c.fill();
    const hx = pose === 'crank' ? 6 + Math.cos(ph) * 2.5 : 5, hy = pose === 'crank' ? -13 + Math.sin(ph) * 2.5 : -12;
    capsule(c, 0.5, -18, hx, hy, 1.1, 0.9); c.fillStyle = shade(tunic, 0.85); c.fill(); c.stroke();
    circle(c, hx, hy, 0.9, '#d0a080');
  }

  // ---------------- Катапульта ----------------
  function drawCatapult(c, o) {
    const wood = '#80583a', dark = '#4e3420';
    const fdx = o.fdx || 0, fdy = o.fdy || 0;
    // Дальняя рама
    c.save(); c.translate(fdx, fdy);
    catFrame(c, dark, true, o.rot || 0);
    c.restore();
    // Поперечины между рамами
    for (const x of [-20, 14]) {
      c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath(); c.moveTo(x, -6); c.lineTo(x + fdx, -6 + fdy); c.stroke();
      c.strokeStyle = shade(dark, 1.1); c.lineWidth = 1.8; c.beginPath(); c.moveTo(x, -6); c.lineTo(x + fdx, -6 + fdy); c.stroke();
    }
    // Торсионный жгут
    const pv = { x: -6 + fdx / 2, y: -10 + fdy / 2 };
    ellipse(c, pv.x, pv.y, 2.6, 4.8, -0.6, '#8a7048', OUT, LWU);
    c.strokeStyle = '#5a4630'; c.lineWidth = 0.35;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(pv.x - 2 + i * 0.3, pv.y + i * 1.2 - 1.5); c.lineTo(pv.x + 2 + i * 0.3, pv.y + i * 1.2 + 0.5); c.stroke(); }
    // Рычаг
    const L = 40, th = o.arm;
    const tip = { x: pv.x + Math.cos(th) * L, y: pv.y - Math.sin(th) * L };
    // Верёвка к вороту, пока взведено
    if (o.cocked) rope(c, tip.x + Math.cos(th) * -4, tip.y - Math.sin(th) * -4, -24 + fdx / 2, -9 + fdy / 2, 2, 0.7);
    beam(c, pv.x, pv.y, tip.x, tip.y, 3.4, wood, [0.12, 0.55, 0.9]);
    // Чаша-ложка
    c.save(); c.translate(tip.x, tip.y); c.rotate(-th + PI / 2);
    c.beginPath(); c.moveTo(-4.6, -1); c.quadraticCurveTo(0, 5.4, 4.6, -1); c.lineTo(3.4, -2); c.quadraticCurveTo(0, 2.6, -3.4, -2); c.closePath();
    c.fillStyle = A.lit(c, 0, 1, 4, dark); c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    if (o.loaded) {
      c.beginPath();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; const r = 3.4 * (0.85 + ((i * 37) % 10) / 40); c.lineTo(Math.cos(a) * r, -2.2 + Math.sin(a) * r); }
      c.closePath();
      c.fillStyle = o.fire ? '#9a4a1e' : A.lit(c, 0, -2, 3.4, '#7a736a'); c.fill(); c.strokeStyle = OUT; c.stroke();
      if (o.fire) { c.save(); c.shadowColor = '#ff8a2a'; c.shadowBlur = 5; circle(c, 0, -2.6, 2, '#ffb34a'); c.restore(); }
    }
    c.restore();
    // Ближняя рама
    catFrame(c, wood, false, o.rot || 0);
    // Ворот сзади
    circle(c, -24, -9, 3, '#5a3e26', OUT, LWU);
    for (let i = 0; i < 4; i++) { const a = (o.crank || 0) + (i * PI) / 2; line(c, -24, -9, -24 + Math.cos(a) * 5, -9 + Math.sin(a) * 5, '#4a3020', 1.1); }
    rope(c, -24, -11.5, -24 + fdx, -11.5 + fdy, 0, 1.6);
  }
  function catFrame(c, col, far, rot) {
    beam(c, -28, -6, 22, -6, 3.6, col, [0.08, 0.92]);
    beam(c, -4, -6, 4, -32, 2.6, col);
    beam(c, 12, -6, 4, -32, 2.6, col);
    beam(c, -2, -20, 10, -20, 1.8, col);
    // Упор с подушкой
    c.fillStyle = far ? '#3a2a1a' : '#8a3a2a';
    c.fillRect(1.5, -34.5, 5.5, 3.2); c.strokeStyle = OUT; c.lineWidth = LWU; c.strokeRect(1.5, -34.5, 5.5, 3.2);
    wheel(c, -19, -3.5, 5.5, col, rot);
    wheel(c, 14, -3.5, 5.5, col, rot);
  }

  // ---------------- Требушет ----------------
  function drawTrebuchet(c, o) {
    const wood = '#856040', dark = '#4b3220';
    const fdx = o.fdx || 0, fdy = o.fdy || 0;
    c.save(); c.translate(fdx, fdy); trebFrame(c, dark, true); c.restore();
    for (const x of [-38, 0, 38]) {
      c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(x, -4); c.lineTo(x + fdx, -4 + fdy); c.stroke();
      c.strokeStyle = shade(dark, 1.15); c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, -4); c.lineTo(x + fdx, -4 + fdy); c.stroke();
    }
    // Жёлоб для пращи
    beam(c, 6 + fdx / 2, -6 + fdy / 2, 44 + fdx / 2, -6 + fdy / 2, 2.2, '#6a4a2c');
    const pv = { x: fdx / 2, y: -64 + fdy / 2 };
    const th = o.arm;
    const Ll = 72, Ls = 20;
    const tip = { x: pv.x + Math.cos(th) * Ll, y: pv.y - Math.sin(th) * Ll };
    const cw = { x: pv.x - Math.cos(th) * Ls, y: pv.y + Math.sin(th) * Ls };
    // Противовес (висит вертикально)
    const sw = o.cwSwing || 0;
    c.save(); c.translate(cw.x, cw.y); c.rotate(sw);
    line(c, -3, 0, -6, 9, '#3a3a40', 0.9); line(c, 3, 0, 6, 9, '#3a3a40', 0.9);
    c.fillStyle = A.lit(c, 0, 17, 10, '#5a4430'); c.fillRect(-10, 9, 20, 17);
    c.strokeStyle = alpha('#1a0e06', 0.5); c.lineWidth = 0.35;
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-10, 9 + i * 4.25); c.lineTo(10, 9 + i * 4.25); c.stroke(); }
    c.fillStyle = '#3a3a40'; for (const [x, y] of [[-10, 9], [8.4, 9], [-10, 24.4], [8.4, 24.4]]) c.fillRect(x, y, 1.6, 1.6);
    for (let i = 0; i < 5; i++) circle(c, -7 + i * 3.5, 8.6, 1.6 + (i % 2) * 0.4, shade('#7a746a', 0.85 + (i % 3) * 0.12), OUT, 0.3);
    c.strokeStyle = OUT; c.lineWidth = LWU; c.strokeRect(-10, 9, 20, 17);
    c.restore();
    // Рычаг
    beam(c, cw.x, cw.y, tip.x, tip.y, 4.6, wood, [0.06, 0.24, 0.5, 0.8]);
    circle(c, pv.x, pv.y, 2.6, '#3a3a40', OUT, LWU);
    circle(c, pv.x - 0.6, pv.y - 0.6, 0.8, '#9a9aa0');
    // Праща
    const SL = 26;
    let bx = tip.x + Math.cos(o.sling) * SL, by = tip.y - Math.sin(o.sling) * SL;
    if (by > -4) by = -4;
    rope(c, tip.x, tip.y, bx - 1.5, by, 0, 0.6);
    rope(c, tip.x, tip.y, bx + 1.5, by + 0.5, 0, 0.6);
    if (o.loaded) {
      circle(c, bx, by, 6.6, o.fire ? '#9a4a1e' : A.lit(c, bx, by, 6.6, '#726c64'), OUT, LWU);
      c.strokeStyle = alpha('#000000', 0.35); c.lineWidth = 0.4; c.beginPath(); c.arc(bx + 1, by + 1, 3.5, 0.5, 2.5); c.stroke();
      if (o.fire) { c.save(); c.shadowColor = '#ff8a2a'; c.shadowBlur = 6; circle(c, bx, by - 1, 3.5, '#ffb34a'); c.restore(); }
    }
    ellipse(c, bx, by + 2.5, 4.4, 1.6, 0, '#7a5a38', OUT, 0.3);
    trebFrame(c, wood, false);
  }
  function trebFrame(c, col, far) {
    beam(c, -44, -4, 44, -4, 4.4, col, [0.05, 0.5, 0.95]);
    beam(c, -28, -4, -1, -64, 3.6, col, [0.5]);
    beam(c, 28, -4, 1, -64, 3.6, col, [0.5]);
    beam(c, -15, -34, 15, -34, 2.4, col);
    beam(c, -21, -18, 21, -18, 2.2, col);
    beam(c, -15, -34, 11, -18, 1.4, shade(col, 0.9));
    beam(c, 15, -34, -11, -18, 1.4, shade(col, 0.9));
    wheel(c, -34, -2.5, 4.5, col, 0);
    wheel(c, 34, -2.5, 4.5, col, 0);
    if (!far) { c.fillStyle = '#3a3a40'; c.fillRect(-2.5, -67, 5, 5); c.strokeStyle = OUT; c.lineWidth = LWU; c.strokeRect(-2.5, -67, 5, 5); }
  }

  // ---------------- Котёл с воском ----------------
  function drawCauldron(c, o) {
    const t = o.time || 0;
    // Дрова и огонь
    for (const [a, col] of [[0.3, '#5a3a20'], [-0.3, '#4a2e1a']]) { c.save(); c.translate(0, -1); c.rotate(a); c.fillStyle = col; c.fillRect(-6, -1, 12, 2); c.strokeStyle = OUT; c.lineWidth = 0.35; c.strokeRect(-6, -1, 12, 2); c.restore(); }
    const fl = Math.sin(t * 20 + (o.seed || 0)) * 1.2;
    c.save(); c.shadowColor = '#ff8a2a'; c.shadowBlur = 5;
    c.fillStyle = '#ff7a1a'; c.beginPath(); c.moveTo(-5, -1.5); c.quadraticCurveTo(-2, -12 - fl, 0, -6); c.quadraticCurveTo(2, -13 + fl, 5, -1.5); c.fill();
    c.fillStyle = '#ffd86a'; c.beginPath(); c.moveTo(-2.6, -1.5); c.quadraticCurveTo(0, -8 - fl, 2.6, -1.5); c.fill();
    c.restore();
    // Рама-опора
    beam(c, -11, 0, -10, -19, 1.8, '#4e3420');
    beam(c, 11, 0, 10, -19, 1.8, '#4e3420');
    beam(c, -11.5, -19, 11.5, -19, 1.4, '#3a2a1a');
    // Котёл
    c.save();
    c.translate(0, -15);
    c.rotate(o.tilt || 0);
    c.beginPath(); c.moveTo(-9, -4); c.lineTo(9, -4); c.quadraticCurveTo(10, 8, 0, 9.5); c.quadraticCurveTo(-10, 8, -9, -4); c.closePath();
    const g = c.createLinearGradient(-9, -4, 9, 8); g.addColorStop(0, '#5a5a62'); g.addColorStop(0.4, '#2c2c32'); g.addColorStop(1, '#141418');
    c.fillStyle = g; c.fill(); c.lineWidth = LWU; c.strokeStyle = OUT; c.stroke();
    for (let i = 0; i < 4; i++) circle(c, -6 + i * 4, -1.6, 0.5, '#8a8a92');
    c.fillStyle = '#3a3a42'; c.fillRect(-10.2, -5.6, 20.4, 2.2); c.strokeRect(-10.2, -5.6, 20.4, 2.2);
    c.beginPath(); c.moveTo(9.5, -5.6); c.lineTo(13, -6.4); c.lineTo(10, -3.4); c.closePath(); c.fillStyle = '#3a3a42'; c.fill(); c.stroke();
    if (o.full) {
      c.save(); c.shadowColor = '#ffb34a'; c.shadowBlur = 4;
      ellipse(c, 0, -5.3, 8.6, 1.6, 0, '#ffb63a');
      c.restore();
      const bub = (Math.sin(t * 7) + 1) * 0.5;
      circle(c, -3 + bub * 2, -5.6, 0.8 + bub * 0.5, '#fff0a0');
      circle(c, 3 - bub, -5.4, 0.6, '#ffe07a');
    }
    c.restore();
  }

  // ---------------- Иконка стены ----------------
  function drawWallIcon(c, tier) {
    if (tier === 0) {
      for (let i = 0; i < 9; i++) {
        const x = -26 + i * 6.2, h = 34 + ((i * 7) % 5);
        const g = c.createLinearGradient(x - 3, 0, x + 3, 0); g.addColorStop(0, '#9a7448'); g.addColorStop(0.5, '#7a5634'); g.addColorStop(1, '#4a3420');
        c.fillStyle = g; c.beginPath(); c.moveTo(x - 3, 0); c.lineTo(x - 3, -h); c.lineTo(x, -h - 6); c.lineTo(x + 3, -h); c.lineTo(x + 3, 0); c.closePath(); c.fill();
        c.strokeStyle = OUT; c.lineWidth = LWU; c.stroke();
        c.fillStyle = '#c8a070'; c.beginPath(); c.moveTo(x - 1.2, -h - 3); c.lineTo(x, -h - 6); c.lineTo(x + 1.2, -h - 3); c.closePath(); c.fill();
      }
      for (const y of [-10, -26]) { beam(c, -30, y, 30, y, 3, '#5a3e24'); }
      return;
    }
    const base = tier === 1 ? '#8a857c' : '#6e6a72';
    const rnd = A.seeded(tier * 9);
    c.fillStyle = shade(base, 0.6); c.fillRect(-32, -40, 64, 40);
    for (let row = 0; row < 6; row++) {
      for (let x = -32 + (row % 2) * 5; x < 32; x += 10) {
        const w = Math.min(10, 32 - x) - 0.8;
        if (w <= 0) continue;
        c.fillStyle = A.lit(c, x + w / 2, -row * 6.6 - 3, 6, shade(base, 0.85 + rnd() * 0.3));
        c.fillRect(Math.max(-32, x), -row * 6.6 - 6.2, w, 5.8);
      }
    }
    for (let i = 0; i < 4; i++) {
      const x = -32 + i * 18;
      c.fillStyle = A.lit(c, x + 5, -45, 6, base); c.fillRect(x, -48, 10, 8); c.strokeStyle = OUT; c.lineWidth = LWU; c.strokeRect(x, -48, 10, 8);
    }
    c.strokeStyle = OUT; c.lineWidth = LWU; c.strokeRect(-32, -40, 64, 40);
    if (tier === 2) {
      c.fillStyle = '#8a1e22'; c.beginPath(); c.moveTo(-6, -38); c.lineTo(6, -38); c.lineTo(6, -16); c.lineTo(0, -12); c.lineTo(-6, -16); c.closePath(); c.fill();
      c.strokeStyle = '#d4a64a'; c.lineWidth = 0.8; c.stroke();
      c.fillStyle = '#e8c060'; c.font = 'bold 10px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('♜', 0, -26);
    }
  }

  TD.UArt = { beam, wheel, rope, drawArcher, drawBallista, drawCrew, drawCatapult, drawTrebuchet, drawCauldron, drawWallIcon };
})();
