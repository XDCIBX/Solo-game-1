/* Последний Бастион — игровая логика (без DOM, работает и в node для симуляции баланса) */
(function () {
  const TD = globalThis.TD || (globalThis.TD = {});
  const W = TD.WORLD;
  const S = TD.S;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const BOSS_BY_TYPE = {};
  for (const k in TD.BOSSES) BOSS_BY_TYPE[TD.BOSSES[k].type] = TD.BOSSES[k];
  TD.BOSS_BY_TYPE = BOSS_BY_TYPE;

  TD.TOWER_Z = [200, 62, 338];
  TD.CATAPULT_Z = [200, 115, 290];
  TD.TREB_Z = [40, 362];
  TD.CAULDRON_Z = [130, 268, 22];
  TD.ARCHER_X = 494;
  // Свободные участки стены между башнями (надвратная башня 168..232, башни баллист ±28)
  TD.WALL_FREE = [[6, 32], [92, 166], [234, 308], [368, 396]];
  TD.archerSlots = function (n) {
    const segs = TD.WALL_FREE, total = segs.reduce((s, g) => s + g[1] - g[0], 0);
    const out = [];
    for (let i = 0; i < n; i++) {
      let d = ((i + 0.5) / n) * total;
      for (const [a, b] of segs) { if (d <= b - a) { out.push(a + d); break; } d -= b - a; }
    }
    return out;
  };
  TD.towerTop = (i, H) => H + (i === 0 ? 28 : 22);
  TD.CATAPULT_X = 420;
  TD.TREB_X = 345;
  const MAX_PARTICLES = 1600;

  class Game {
    constructor(opts = {}) {
      this.headless = !!opts.headless;
      this.listeners = {};
      this.autoStart = true;
      this.time = 0;
      this.newGame();
    }

    on(ev, fn) { (this.listeners[ev] || (this.listeners[ev] = [])).push(fn); }
    emit(ev, data) { const l = this.listeners[ev]; if (l) for (const fn of l) fn(data); }

    newGame() {
      this.levels = {};
      for (const id in TD.ITEMS) this.levels[id] = TD.ITEMS[id].start || 0;
      this.gold = TD.START_GOLD;
      this.wave = 1;
      this.stats = { kills: 0, gold: 0, bosses: 0, defeats: 0 };
      this.phase = 'menu';
      this.archers = []; this.ballistas = []; this.catapults = []; this.trebs = []; this.cauldrons = [];
      this.wallMax = 0;
      this.resetField();
      this.refresh();
      this.wallHp = this.wallMax;
    }

    resetField() {
      this.zombies = [];
      this.projectiles = [];
      this.particles = [];
      this.decals = [];
      this.pools = [];
      this.texts = [];
      this.queue = [];
      this.qi = 0;
      this.waveTime = 0;
      this.shake = 0;
      this.boss = null;
      this.nextId = 1;
      this.waveGold = 0;
      this.waveKills = 0;
      this.wallHitT = 0;
    }

    toJSON() {
      return { v: 1, wave: this.wave, gold: this.gold, levels: this.levels, stats: this.stats, autoStart: this.autoStart };
    }

    load(d) {
      this.newGame();
      if (!d || d.v !== 1) return false;
      this.wave = clamp(d.wave | 0, 1, TD.MAX_WAVE);
      this.gold = Math.max(0, d.gold | 0);
      for (const id in this.levels) {
        if (d.levels && typeof d.levels[id] === 'number') this.levels[id] = clamp(d.levels[id] | 0, TD.ITEMS[id].start || 0, TD.ITEMS[id].max);
      }
      Object.assign(this.stats, d.stats || {});
      if (typeof d.autoStart === 'boolean') this.autoStart = d.autoStart;
      this.refresh();
      this.wallHp = this.wallMax;
      return true;
    }

    // ---------- Улучшения ----------
    costOf(id) {
      const it = TD.ITEMS[id];
      const l = this.levels[id];
      return l >= it.max ? Infinity : TD.cost(it, l);
    }

    canUpgrade(id) { return this.gold >= this.costOf(id); }

    upgrade(id) {
      const c = this.costOf(id);
      if (!isFinite(c) || this.gold < c) return false;
      this.gold -= c;
      this.levels[id]++;
      this.refresh();
      this.emit('upgrade', id);
      return true;
    }

    refresh() {
      const L = this.levels;
      const m = (this.mods = TD.calcMods(L));
      const oldMax = this.wallMax;
      this.wallMax = S.wallHp(L.wall, m);
      if (oldMax && this.wallHp != null) this.wallHp = Math.min(this.wallMax, this.wallHp + Math.max(0, this.wallMax - oldMax));
      this.wallTier = L.wall < 4 ? 0 : L.wall < 9 ? 1 : 2;
      this.wallH = [60, 76, 90][this.wallTier];

      const sync = (arr, n, make) => {
        while (arr.length > n) arr.pop();
        for (let i = arr.length; i < n; i++) arr.push(make(i));
        return arr;
      };
      const na = S.archerCount(L.archers);
      sync(this.archers, na, () => ({ cd: rnd(0, 1), anim: 9, aim: -0.35, target: null }));
      const slots = TD.archerSlots(na);
      this.archers.forEach((a, i) => { a.x = TD.ARCHER_X; a.z = slots[i]; a.v = i; });
      sync(this.ballistas, S.ballistaCount(L.ballista), (i) => ({ x: 500, z: TD.TOWER_Z[i], cd: rnd(0.5, 1.5), anim: 9, aim: 0, built: 0 }));
      sync(this.catapults, S.catapultCount(L.catapult), (i) => ({ x: TD.CATAPULT_X, z: TD.CATAPULT_Z[i], cd: rnd(0.5, 2), anim: 9, shot: null, built: 0 }));
      sync(this.trebs, S.trebCount(L.trebuchet), (i) => ({ x: TD.TREB_X, z: TD.TREB_Z[i], cd: rnd(1, 3), anim: 9, shot: null, built: 0 }));
      sync(this.cauldrons, S.oilCount(L.oil), (i) => ({ x: 508, z: TD.CAULDRON_Z[i], cd: 1, pour: 9, built: 0 }));
    }

    // ---------- Фазы ----------
    startGame() {
      this.phase = 'prep';
      this.prepTimer = TD.PREP_TIME;
      this.emit('prep', this.wave);
    }

    startWave() {
      if (this.phase !== 'prep') return;
      this.resetField();
      this.wallHp = this.wallMax;
      this.queue = TD.buildWave(this.wave);
      this.qi = 0;
      this.phase = 'battle';
      this.emit('waveStart', this.wave);
    }

    goPrep() {
      this.phase = 'prep';
      this.prepTimer = TD.PREP_TIME;
      this.wallHp = this.wallMax;
      this.projectiles.length = 0;
      this.pools.length = 0;
      this.emit('prep', this.wave);
    }

    retryWave() {
      this.resetField();
      this.wallHp = this.wallMax;
      this.goPrep();
    }

    get remaining() {
      let alive = 0;
      for (const z of this.zombies) if (z.state !== 'dead') alive++;
      return alive + (this.queue.length - this.qi);
    }

    // ---------- Главный цикл ----------
    update(dt) {
      this.time += dt;
      if (this.phase === 'prep' && this.autoStart) {
        this.prepTimer -= dt;
        if (this.prepTimer <= 0) this.startWave();
      }
      if (this.phase === 'battle') this.battle(dt);
      else if (this.phase === 'cleared') {
        this.clearTimer -= dt;
        if (this.clearTimer <= 0) {
          if (this.wave >= TD.MAX_WAVE) { this.phase = 'victory'; this.emit('victory'); }
          else { this.wave++; this.goPrep(); }
        }
      }
      if (this.phase !== 'battle') this.idleUnits(dt);
      this.updateZombieVisuals(dt);
      this.updateFx(dt);
    }

    battle(dt) {
      this.waveTime += dt;
      while (this.qi < this.queue.length && this.queue[this.qi].t <= this.waveTime) {
        const q = this.queue[this.qi++];
        this.spawn(q.type, {});
      }
      this.wallHp = Math.min(this.wallMax, this.wallHp + this.wallMax * this.mods.regen * dt);
      this.updateZombies(dt);
      this.updateUnits(dt);
      this.updateProjectiles(dt);
      this.updatePools(dt);
      if (this.phase !== 'battle') return;
      if (this.wallHp <= 0) {
        this.wallHp = 0;
        this.phase = 'defeat';
        this.stats.defeats++;
        this.shake = 14;
        this.burst('debris', W.WALL_FRONT, 200, 40, 60, { spread: 200, color: '#6d6458' });
        this.burst('dust', W.WALL_FRONT, 200, 30, 40, { spread: 200 });
        this.emit('defeat', this.wave);
        return;
      }
      if (this.qi >= this.queue.length && this.remaining === 0) {
        const reward = Math.round(TD.waveReward(this.wave) * this.mods.gold);
        this.gold += reward;
        this.stats.gold += reward;
        this.phase = 'cleared';
        this.clearTimer = 3.2;
        this.emit('waveCleared', { wave: this.wave, reward, killGold: this.waveGold, kills: this.waveKills });
      }
    }

    // ---------- Зомби ----------
    spawn(type, o) {
      const boss = BOSS_BY_TYPE[type];
      const base = boss || TD.ZOMBIES[type];
      const w = this.wave;
      const hp = base.hp * TD.hpMul(w) * (o.hpScale || 1);
      const size = boss ? base.size : base.size * rnd(0.93, 1.07);
      const z = {
        id: this.nextId++, type, boss: !!boss, name: base.name,
        x: o.x != null ? o.x : W.SPAWN_X + rnd(0, 70),
        z: o.z != null ? clamp(o.z, 10, 390) : boss ? rnd(150, 250) : rnd(12, 388),
        hp, maxHp: hp,
        speed: base.speed * (boss ? 1 : rnd(0.88, 1.12)),
        dps: (base.dps || 0) * TD.dmgMul(w),
        blast: (base.blast || 0) * TD.dmgMul(w),
        spit: (base.spit || 0) * TD.dmgMul(w),
        gold: base.gold * TD.killGoldMul(w),
        size,
        armor: base.armor || 0,
        state: o.rise ? 'rise' : 'walk',
        t: rnd(0, 10), stateT: 0, deadT: 0,
        burn: 0, burnDps: 0, flash: 0, pending: 0,
        atkCd: rnd(0.2, 1.0), atkAnim: 9,
        summonCd: base.summon ? base.summon.every * 0.6 : 0,
        seed: Math.random(),
        drift: rnd(-1, 1),
      };
      z.stopX = type === 'spitter' ? W.WALL_FRONT + base.range + rnd(-25, 25) : W.WALL_FRONT + 6 + rnd(0, 20) * size;
      this.zombies.push(z);
      if (boss) { this.boss = z; this.emit('boss', z); this.shake = Math.max(this.shake, 5); }
      if (o.rise) this.burst('dust', z.x, z.z, 0, 6, { spread: 14, color: '#4a3d33' });
      return z;
    }

    updateZombies(dt) {
      const zs = this.zombies;
      for (let i = 0; i < zs.length; i++) {
        const z = zs[i];
        if (z.state === 'dead') continue;
        if (z.burn > 0) {
          z.burn -= dt;
          this.hurt(z, z.burnDps * dt, 'fire', true);
          if (z.state === 'dead') continue;
        }
        if (z.state === 'rise') {
          if (z.stateT > 1.0) { z.state = 'walk'; z.stateT = 0; }
          continue;
        }
        if (z.state === 'walk') {
          z.x -= z.speed * dt;
          z.z = clamp(z.z + Math.sin(z.t * 0.6 + z.seed * 9) * 4 * dt + z.drift * dt * 1.5, 10, 390);
          if (z.x <= z.stopX) {
            z.x = z.stopX;
            z.state = z.type === 'exploder' ? 'swell' : 'attack';
            z.stateT = 0;
          }
        } else if (z.state === 'attack') {
          z.atkCd -= dt;
          if (z.atkCd <= 0) {
            if (z.type === 'spitter') {
              z.atkCd = 2.2;
              z.atkAnim = 0;
              this.projectiles.push({
                kind: 'glob', x0: z.x - 10, z0: z.z, h0: 38 * z.size, x1: W.WALL_FRONT + 2, z1: z.z + rnd(-10, 10), h1: this.wallH * rnd(0.3, 0.8),
                t: 0, T: 0.9, arc: 60, dmg: z.spit, x: z.x, z: z.z, h: 38,
              });
            } else {
              z.atkCd = rnd(0.85, 1.15);
              z.atkAnim = 0;
              this.wallDamage(z.dps, z);
            }
          }
        } else if (z.state === 'swell') {
          if (z.stateT > 0.8) {
            this.wallDamage(z.blast, z);
            this.burst('glob', z.x, z.z, 25, 26, { spread: 60, up: 140 });
            this.burst('dust', z.x, z.z, 10, 8, { spread: 40, color: '#5f7a2c' });
            this.decal('goo', z.x, z.z, 30);
            this.shake = Math.max(this.shake, 4);
            this.emit('sfx', 'blast');
            this.kill(z, true, true);
            continue;
          }
        }
        // Призыв (некромант, король мёртвых)
        const bb = BOSS_BY_TYPE[z.type];
        if (bb && bb.summon) {
          z.summonCd -= dt;
          if (z.summonCd <= 0) {
            z.summonCd = bb.summon.every;
            z.casting = 1;
            for (let k = 0; k < bb.summon.n; k++) {
              this.spawn(bb.summon.type, { x: z.x + rnd(-30, 70), z: z.z + rnd(-70, 70), rise: true, hpScale: 0.6 });
            }
            this.burst('magic', z.x, z.z, 60, 20, { spread: 40 });
            this.emit('sfx', 'summon');
          }
        }
      }
    }

    updateZombieVisuals(dt) {
      const zs = this.zombies;
      let j = 0;
      for (let i = 0; i < zs.length; i++) {
        const z = zs[i];
        z.t += dt; z.stateT += dt; z.atkAnim += dt;
        if (z.flash > 0) z.flash -= dt;
        if (z.casting > 0) z.casting -= dt;
        if (z.state === 'dead') {
          z.deadT += dt;
          if (z.deadT > (z.gone ? 0 : 7)) continue;
        } else if (!this.headless && z.burn > 0 && Math.random() < dt * 14) {
          this.particle('fire', z.x + rnd(-8, 8) * z.size, z.z, rnd(10, 40) * z.size, { vh: rnd(30, 60), life: rnd(0.4, 0.7), size: rnd(4, 8) * z.size });
        }
        zs[j++] = z;
      }
      zs.length = j;
    }

    hurt(z, dmg, src, quiet) {
      if (z.state === 'dead') return;
      if (z.armor && (src === 'arrow' || src === 'bolt')) dmg *= 1 - z.armor;
      z.hp -= dmg;
      if (!quiet) z.flash = 0.07;
      if (z.hp <= 0) this.kill(z);
      else if (z.boss) this.checkSplit(z);
    }

    checkSplit(z) {
      const bb = BOSS_BY_TYPE[z.type];
      if (!bb || !bb.split) return;
      const frac = z.hp / z.maxHp;
      z.splits = z.splits || 0;
      const thresholds = [0.66, 0.33];
      while (z.splits < thresholds.length && frac < thresholds[z.splits]) {
        z.splits++;
        for (let k = 0; k < bb.split.n / 2; k++) this.spawn(bb.split.type, { x: z.x + rnd(-20, 50), z: z.z + rnd(-50, 50), rise: true, hpScale: 0.7 });
        this.burst('glob', z.x, z.z, 50, 30, { spread: 50, up: 120 });
      }
    }

    kill(z, noGold, gone) {
      if (z.state === 'dead') return;
      z.state = 'dead';
      z.deadT = 0;
      z.hp = 0;
      z.burn = 0;
      z.gone = !!gone;
      this.waveKills++;
      this.stats.kills++;
      if (!noGold) {
        const g = Math.max(1, Math.round(z.gold * this.mods.gold));
        this.gold += g;
        this.waveGold += g;
        this.stats.gold += g;
        this.text('+' + g, z.x, z.z, 50 * z.size, z.boss ? '#ffd54a' : '#ffe082', z.boss ? 26 : 15);
      }
      if (z.boss) {
        this.stats.bosses++;
        this.boss = null;
        this.shake = Math.max(this.shake, 10);
        this.burst('blood', z.x, z.z, 40, 40, { spread: 50, up: 160, color: '#5a1010' });
        this.emit('bossDown', z);
        const bb = BOSS_BY_TYPE[z.type];
        if (bb.split) for (let k = 0; k < bb.split.n; k++) this.spawn(bb.split.type, { x: z.x + rnd(-30, 60), z: z.z + rnd(-60, 60), rise: true, hpScale: 0.6 });
      } else if (!gone) {
        this.burst('blood', z.x, z.z, 30 * z.size, 7, { spread: 12, up: 80, color: z.type === 'exploder' ? '#7a9b2a' : '#4d1212' });
        if (z.type === 'exploder') { this.burst('glob', z.x, z.z, 25, 14, { spread: 30, up: 100 }); this.emit('sfx', 'pop'); }
      }
      if (!gone) this.decal('blood', z.x, z.z, 10 + 12 * z.size);
    }

    wallDamage(d, z) {
      if (this.phase !== 'battle') return;
      this.wallHp -= d;
      this.wallHitT = 0.15;
      if (!this.headless && Math.random() < 0.6) {
        this.burst('debris', W.WALL_FRONT + 2, z ? z.z : rnd(0, 400), this.wallH * rnd(0.2, 0.7), 3, { spread: 6, color: this.wallTier === 0 ? '#7b5a36' : '#7d776e', out: 1 });
      }
    }

    ignite(z, dps, dur) {
      if (z.state === 'dead') return;
      z.burn = Math.max(z.burn, dur);
      z.burnDps = z.burn > 0 && z.burnDps > dps ? z.burnDps : dps;
    }

    // ---------- Защитники ----------
    idleUnits(dt) {
      for (const a of this.archers) a.anim += dt;
      for (const b of this.ballistas) { b.anim += dt; b.built += dt; }
      for (const c of this.catapults) { c.anim += dt; c.built += dt; }
      for (const t of this.trebs) { t.anim += dt; t.built += dt; }
      for (const c of this.cauldrons) { c.pour += dt; c.built += dt; }
    }

    alive(z) { return z && z.state !== 'dead' && z.state !== 'rise'; }

    pickArcherTarget(a) {
      const maxX = W.WALL_FRONT + S.archerRange;
      let best = null, bs = Infinity;
      for (const z of this.zombies) {
        if (!this.alive(z) || z.x > maxX || z.x > W.SPAWN_X - 5 || z.pending >= z.hp) continue;
        const s = z.x + Math.abs(z.z - a.z) * 0.6 + Math.random() * 70 - (z.boss ? 40 : 0);
        if (s < bs) { bs = s; best = z; }
      }
      return best;
    }

    pickCluster(minX, maxX, radius, preferBoss) {
      const c = [];
      for (const z of this.zombies) if (this.alive(z) && z.x >= minX && z.x <= maxX) c.push(z);
      if (!c.length) return null;
      let best = null, bs = -1;
      const samples = Math.min(c.length, 14);
      const r2 = radius * radius;
      for (let k = 0; k < samples; k++) {
        const z = c[(Math.random() * c.length) | 0];
        let n = 0;
        for (const o of c) {
          const dx = o.x - z.x, dz = o.z - z.z;
          if (dx * dx + dz * dz < r2) n += o.boss ? 4 : o.maxHp > z.maxHp * 2 ? 2 : 1;
        }
        if (preferBoss && z.boss) n += 6;
        if (n > bs) { bs = n; best = z; }
      }
      return best;
    }

    lead(z, T) {
      if (z.state !== 'walk') return { x: z.x, z: z.z };
      return { x: Math.max(z.stopX, z.x - z.speed * T), z: z.z };
    }

    updateUnits(dt) {
      const L = this.levels, m = this.mods;
      // Лучники
      const aDmg = S.archerDmg(L.archers, m), aInt = S.archerInterval(L.archers, m);
      for (const a of this.archers) {
        a.anim += dt;
        a.cd -= dt;
        if (a.cd <= 0) {
          const t = this.pickArcherTarget(a);
          if (!t) { a.cd = 0.25; continue; }
          const crit = Math.random() < m.crit;
          const dmg = aDmg * (crit ? 2 : 1);
          const fire = Math.random() < m.fireArrow;
          const h0 = this.wallH + 22;
          const d = Math.hypot(t.x - a.x, t.z - a.z);
          t.pending += dmg;
          this.projectiles.push({
            kind: 'arrow', x0: a.x + 6, z0: a.z, h0, x1: t.x, z1: t.z, h1: 26 * t.size,
            t: 0, T: 0.3 + d / 950, arc: 25 + d * 0.13, target: t, dmg, crit, fire, x: a.x, z: a.z, h: h0,
          });
          a.cd = aInt * rnd(0.85, 1.15);
          a.anim = 0;
          a.target = t;
          this.emit('sfx', 'bow');
        }
      }
      // Баллисты
      const bDmg = S.ballistaDmg(L.ballista, m), bInt = S.ballistaInterval(L.ballista, m), pierce = S.ballistaPierce(L.ballista);
      for (const b of this.ballistas) {
        b.anim += dt; b.built += dt;
        b.cd -= dt;
        if (b.cd <= 0) {
          let best = null, bs = Infinity;
          for (const z of this.zombies) {
            if (!this.alive(z) || z.x > W.WALL_FRONT + 800 || z.x > W.SPAWN_X - 5) continue;
            const s = z.x + Math.abs(z.z - b.z) * 1.4 - (z.boss ? 120 : 0) - z.maxHp * 0.002;
            if (s < bs) { bs = s; best = z; }
          }
          if (!best) { b.cd = 0.3; continue; }
          const h0 = this.wallH + 44;
          const p = this.lead(best, Math.hypot(best.x - b.x, best.z - b.z) / 900);
          const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz) || 1;
          const v = 900;
          const th = 22 * best.size;
          this.projectiles.push({
            kind: 'bolt', x: b.x + 10, z: b.z, h: h0, vx: (dx / d) * v, vz: (dz / d) * v, vh: (-(h0 - th) / d) * v,
            dmg: bDmg, pierce, hit: new Set(), life: 2.5, t: 0,
          });
          b.aim = Math.atan2(dz, dx);
          b.cd = bInt * rnd(0.95, 1.05);
          b.anim = 0;
          this.emit('sfx', 'ballista');
        }
      }
      // Катапульты
      const cDmg = S.catapultDmg(L.catapult, m), cR = S.catapultRadius(L.catapult, m), cInt = S.catapultInterval(L.catapult, m);
      for (const c of this.catapults) {
        c.anim += dt; c.built += dt;
        c.cd -= dt;
        if (c.shot) {
          c.shot.delay -= dt;
          if (c.shot.delay <= 0) {
            const t = c.shot.target;
            const d0 = Math.hypot(t.x - c.x, t.z - c.z);
            const T = 1.1 + d0 / 1300;
            const p = this.alive(t) ? this.lead(t, T) : { x: t.x, z: t.z };
            const h0 = 70;
            this.projectiles.push({
              kind: 'rock', x0: c.x + 8, z0: c.z, h0, x1: p.x, z1: p.z, h1: 0, t: 0, T, arc: 140 + d0 * 0.28,
              dmg: cDmg, radius: cR, fire: m.fireRocks, x: c.x, z: c.z, h: h0, rot: 0,
            });
            c.shot = null;
          }
        } else if (c.cd <= 0) {
          const t = this.pickCluster(W.WALL_FRONT + 40, W.WALL_FRONT + 820, cR, false);
          if (!t) { c.cd = 0.3; continue; }
          c.shot = { target: t, delay: 0.22 };
          c.cd = cInt * rnd(0.95, 1.05);
          c.anim = 0;
          this.emit('sfx', 'catapult');
        }
      }
      // Требушеты
      const tDmg = S.trebDmg(L.trebuchet, m), tR = S.trebRadius(L.trebuchet, m), tInt = S.trebInterval(L.trebuchet, m);
      for (const tr of this.trebs) {
        tr.anim += dt; tr.built += dt;
        tr.cd -= dt;
        if (tr.shot) {
          tr.shot.delay -= dt;
          if (tr.shot.delay <= 0) {
            const t = tr.shot.target;
            const d0 = Math.hypot(t.x - tr.x, t.z - tr.z);
            const T = 1.9 + d0 / 1800;
            const p = this.alive(t) ? this.lead(t, T) : { x: t.x, z: t.z };
            const h0 = 150;
            this.projectiles.push({
              kind: 'boulder', x0: tr.x + 30, z0: tr.z, h0, x1: p.x, z1: p.z, h1: 0, t: 0, T, arc: 300 + d0 * 0.2,
              dmg: tDmg, radius: tR, fire: m.fireRocks, x: tr.x, z: tr.z, h: h0, rot: 0,
            });
            tr.shot = null;
          }
        } else if (tr.cd <= 0) {
          const t = this.pickCluster(W.WALL_FRONT + 170, W.SPAWN_X - 10, tR, true);
          if (!t) { tr.cd = 0.4; continue; }
          tr.shot = { target: t, delay: 0.75 };
          tr.cd = tInt * rnd(0.95, 1.05);
          tr.anim = 0;
          this.emit('sfx', 'trebuchet');
        }
      }
      // Котлы с горящим воском
      const oDps = S.oilDps(L.oil, m), oCd = S.oilCooldown(L.oil);
      for (const c of this.cauldrons) {
        c.pour += dt; c.built += dt;
        c.cd -= dt;
        if (c.pending != null) {
          c.pending -= dt;
          if (c.pending <= 0) {
            c.pending = null;
            this.pools.push({ x: W.WALL_FRONT + 40, z: c.z, rx: 62, rz: 52, t: 0, life: 4.5, dps: oDps });
            this.burst('splash', W.WALL_FRONT + 20, c.z, 4, 20, { spread: 40, up: 70 });
            this.emit('sfx', 'fire');
          }
        } else if (c.cd <= 0) {
          let n = 0;
          for (const z of this.zombies) if (this.alive(z) && z.x < W.WALL_FRONT + 75 && Math.abs(z.z - c.z) < 55) n += z.boss ? 5 : 1;
          if (n >= 2) { c.pour = 0; c.pending = 0.55; c.cd = oCd; }
          else c.cd = 0.25;
        }
      }
    }

    updatePools(dt) {
      const ps = this.pools;
      let j = 0;
      for (const p of ps) {
        p.t += dt;
        if (p.t > p.life) continue;
        for (const z of this.zombies) {
          if (!this.alive(z)) continue;
          const dx = (z.x - p.x) / p.rx, dz = (z.z - p.z) / p.rz;
          if (dx * dx + dz * dz < 1) {
            this.hurt(z, p.dps * dt, 'fire', true);
            this.ignite(z, p.dps * 0.3, 2.5);
          }
        }
        if (!this.headless && Math.random() < dt * 22 * (1 - p.t / p.life)) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
          this.particle('fire', p.x + Math.cos(a) * p.rx * r, p.z + Math.sin(a) * p.rz * r, 0, { vh: rnd(40, 90), life: rnd(0.4, 0.9), size: rnd(6, 13) });
        }
        ps[j++] = p;
      }
      ps.length = j;
    }

    // ---------- Снаряды ----------
    updateProjectiles(dt) {
      const ps = this.projectiles;
      let j = 0;
      for (const p of ps) {
        if (this.stepProjectile(p, dt)) ps[j++] = p;
      }
      ps.length = j;
    }

    stepProjectile(p, dt) {
      if (p.kind === 'bolt') {
        p.t += dt;
        p.life -= dt;
        p.x += p.vx * dt; p.z += p.vz * dt; p.h += p.vh * dt;
        for (const z of this.zombies) {
          if (!this.alive(z) || p.hit.has(z.id)) continue;
          const r = 13 * z.size;
          if (Math.abs(z.x - p.x) < r && Math.abs(z.z - p.z) < r * 0.9 && p.h < 50 * z.size) {
            p.hit.add(z.id);
            this.hurt(z, p.dmg, 'bolt');
            this.burst('blood', z.x, z.z, 30 * z.size, 4, { spread: 6, up: 60, color: '#4d1212' });
            if (--p.pierce <= 0) return false;
          }
        }
        if (p.h <= 0) {
          this.decal('bolt', p.x, p.z, 1, Math.atan2(p.vz, p.vx));
          this.burst('dust', p.x, p.z, 0, 3, { spread: 6 });
          return false;
        }
        return p.life > 0 && p.x < W.SPAWN_X + 200;
      }
      p.t += dt;
      if (p.kind === 'arrow' && p.target && p.target.state !== 'dead') {
        p.x1 = p.target.x; p.z1 = p.target.z;
      }
      const k = Math.min(1, p.t / p.T);
      p.x = p.x0 + (p.x1 - p.x0) * k;
      p.z = p.z0 + (p.z1 - p.z0) * k;
      p.h = p.h0 + (p.h1 - p.h0) * k + p.arc * 4 * k * (1 - k);
      if (p.rot != null) p.rot += dt * (p.kind === 'boulder' ? 3 : 6);
      if (!this.headless) {
        if ((p.kind === 'rock' || p.kind === 'boulder') && p.fire && Math.random() < dt * 40) {
          this.particle('fire', p.x, p.z, p.h, { vh: 10, life: 0.4, size: p.kind === 'boulder' ? 12 : 8 });
        }
        if (p.kind === 'boulder' && Math.random() < dt * 20) this.particle('smoke', p.x, p.z, p.h, { vh: 0, life: 0.8, size: 8 });
      }
      if (k < 1) return true;
      this.impact(p);
      return false;
    }

    impact(p) {
      if (p.kind === 'arrow') {
        const t = p.target;
        t.pending = Math.max(0, t.pending - p.dmg);
        if (t.state !== 'dead' && t.state !== 'rise') {
          this.hurt(t, p.dmg, 'arrow');
          if (p.fire) this.ignite(t, p.dmg * 0.4, 3);
          this.burst('blood', t.x, t.z, 28 * t.size, 3, { spread: 5, up: 50, color: t.type === 'exploder' ? '#7a9b2a' : '#4d1212' });
          if (p.crit) this.text('КРИТ!', t.x, t.z, 55 * t.size, '#ff8a65', 12);
        } else {
          this.decal('arrow', p.x + rnd(-6, 6), p.z + rnd(-6, 6), 1, rnd(-0.3, 0.3));
        }
      } else if (p.kind === 'glob') {
        this.wallDamage(p.dmg, null);
        this.burst('glob', p.x, p.z, p.h, 10, { spread: 8, up: 40, out: 1 });
      } else {
        const big = p.kind === 'boulder';
        const R = p.radius, R2 = R * R;
        for (const z of this.zombies) {
          if (!this.alive(z)) continue;
          const dx = z.x - p.x, dz = z.z - p.z, d2 = dx * dx + dz * dz;
          if (d2 < R2) {
            const f = d2 < R2 * 0.16 ? 1 : 1 - 0.5 * Math.sqrt(d2) / R;
            this.hurt(z, p.dmg * f, big ? 'boulder' : 'rock');
            if (p.fire) this.ignite(z, p.dmg * 0.12, 3);
          }
        }
        if (p.fire) this.pools.push({ x: p.x, z: p.z, rx: R * 0.55, rz: R * 0.45, t: 0, life: big ? 3.5 : 2, dps: p.dmg * 0.15 });
        this.shake = Math.max(this.shake, big ? 9 : 3.5);
        this.decal('crater', p.x, p.z, R * 0.32);
        this.burst('debris', p.x, p.z, 4, big ? 26 : 12, { spread: R * 0.3, up: big ? 260 : 170, color: '#5b4a3a' });
        this.burst('dust', p.x, p.z, 4, big ? 18 : 9, { spread: R * 0.5, color: '#8a7865', size: big ? 26 : 16 });
        this.burst('spark', p.x, p.z, 8, big ? 14 : 6, { spread: 10, up: 200 });
        if (p.fire) this.burst('fire', p.x, p.z, 6, big ? 18 : 8, { spread: R * 0.4, up: 90 });
        this.emit('sfx', big ? 'boom' : 'thud');
      }
    }

    // ---------- Эффекты ----------
    particle(kind, x, z, h, o) {
      if (this.headless || this.particles.length > MAX_PARTICLES) return;
      this.particles.push({
        kind, x, z, h,
        vx: o.vx || 0, vz: o.vz || 0, vh: o.vh || 0,
        t: 0, life: o.life || 1, size: o.size || 4, color: o.color, rot: Math.random() * 6, vr: rnd(-8, 8),
      });
    }

    burst(kind, x, z, h, n, o = {}) {
      if (this.headless) return;
      const sp = o.spread || 10, up = o.up != null ? o.up : 80;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random();
        let vx = Math.cos(a) * sp * rnd(1, 3) * r, vz = Math.sin(a) * sp * rnd(1, 3) * r;
        if (o.out) vx = Math.abs(vx) + 30;
        const life = kind === 'dust' ? rnd(0.8, 1.6) : kind === 'smoke' ? rnd(1, 2) : kind === 'fire' ? rnd(0.4, 0.9) : kind === 'magic' ? rnd(0.6, 1.2) : rnd(0.5, 1.1);
        const size = o.size ? o.size * rnd(0.6, 1.2) : kind === 'debris' ? rnd(2, 5) : kind === 'dust' ? rnd(8, 16) : kind === 'spark' ? rnd(1.5, 3) : rnd(2, 4.5);
        this.particle(kind, x + Math.cos(a) * sp * r * 0.5, z + Math.sin(a) * sp * r * 0.5, h, {
          vx, vz, vh: kind === 'dust' ? rnd(5, 25) : rnd(up * 0.4, up), life, size, color: o.color,
        });
      }
    }

    decal(kind, x, z, size, rot) {
      if (this.headless) return;
      if (this.decals.length > 220) this.decals.shift();
      this.decals.push({ kind, x, z, size, rot: rot != null ? rot : Math.random() * 6, t: 0, life: kind === 'crater' ? 14 : kind === 'arrow' || kind === 'bolt' ? 8 : 10, seed: Math.random() });
    }

    text(s, x, z, h, color, size) {
      if (this.headless) return;
      this.texts.push({ s, x, z, h, color, size: size || 14, t: 0, life: 1.2 });
    }

    updateFx(dt) {
      this.shake = Math.max(0, this.shake - dt * 25);
      if (this.wallHitT > 0) this.wallHitT -= dt;
      if (this.headless) return;
      const ps = this.particles;
      let j = 0;
      for (const p of ps) {
        p.t += dt;
        if (p.t >= p.life) continue;
        p.x += p.vx * dt; p.z += p.vz * dt; p.h += p.vh * dt;
        p.rot += p.vr * dt;
        switch (p.kind) {
          case 'fire': case 'magic': p.vh += 20 * dt; p.vx *= 0.96; p.vz *= 0.96; break;
          case 'smoke': p.vh = Math.min(p.vh + 10 * dt, 30); p.vx += 8 * dt; break;
          case 'dust': p.vx *= 0.94; p.vz *= 0.94; p.vh *= 0.95; break;
          default:
            p.vh -= 520 * dt;
            if (p.h < 0) { p.h = 0; p.vh = -p.vh * 0.25; p.vx *= 0.5; p.vz *= 0.5; }
        }
        ps[j++] = p;
      }
      ps.length = j;
      let k = 0;
      for (const d of this.decals) { d.t += dt; if (d.t < d.life) this.decals[k++] = d; }
      this.decals.length = k;
      k = 0;
      for (const t of this.texts) { t.t += dt; t.h += dt * 35; if (t.t < t.life) this.texts[k++] = t; }
      this.texts.length = k;
    }
  }

  TD.Game = Game;
})();
