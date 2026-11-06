/* Последний Бастион — интерфейс (HTML-панели, HUD, меню) */
(function () {
  const TD = globalThis.TD;
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => Math.floor(n).toLocaleString('ru-RU');

  const NEW_ENEMY = {
    3: 'Новый враг: Бегуны — быстрые, но хилые.',
    6: 'Новый враг: Громилы — толстокожие и бьют сильно.',
    8: 'Новый враг: Раздутые — взрываются у стены.',
    11: 'Новый враг: Плевуны — плюются кислотой издалека.',
  };

  class UI {
    constructor(game, renderer, sfx, hooks) {
      this.g = game;
      this.r = renderer;
      this.sfx = sfx;
      this.hooks = hooks;
      this.tab = 'building';
      this.cards = {};
      this.lastGold = -1;
      this.buildCards();
      this.bind();
    }

    buildCards() {
      const root = $('#cards');
      root.innerHTML = '';
      const add = (it) => {
        const el = document.createElement('div');
        el.className = 'card';
        el.dataset.id = it.id;
        el.dataset.kind = it.kind;
        el.innerHTML = `
          <div class="card-head">
            <span class="card-ico">${it.icon}</span>
            <div class="card-title"><div class="card-name">${it.name}</div><div class="card-lvl"></div></div>
          </div>
          <div class="card-desc">${it.desc}</div>
          <div class="card-fx"></div>
          <button class="btn upg"></button>`;
        el.querySelector('.upg').addEventListener('click', (e) => { e.stopPropagation(); this.buy(it.id); });
        el.addEventListener('click', () => this.select(it.id, false));
        root.appendChild(el);
        this.cards[it.id] = { el, lvlEl: el.querySelector('.card-lvl'), fxEl: el.querySelector('.card-fx'), btn: el.querySelector('.upg'), level: -1 };
      };
      TD.BUILDINGS.forEach(add);
      TD.DEFENSES.forEach(add);
      this.showTab(this.tab);
    }

    showTab(tab) {
      this.tab = tab;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
      for (const id in this.cards) this.cards[id].el.style.display = TD.ITEMS[id].kind === tab ? '' : 'none';
    }

    select(id, fromCanvas) {
      const it = TD.ITEMS[id];
      if (!it) return;
      if (it.kind !== this.tab) this.showTab(it.kind);
      this.r.selected = id;
      clearTimeout(this.selT);
      this.selT = setTimeout(() => { if (this.r.selected === id) this.r.selected = null; }, 2500);
      for (const k in this.cards) this.cards[k].el.classList.toggle('selected', k === id);
      if (fromCanvas) {
        const el = this.cards[id].el;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
      }
    }

    buy(id) {
      this.sfx.init();
      const it = TD.ITEMS[id];
      const wasLvl = this.g.levels[id];
      if (this.g.upgrade(id)) {
        this.sfx.play('upgrade');
        this.r.flashUp[id] = 1;
        this.toast(`${it.icon} ${it.name}: ${wasLvl === 0 && it.kind === 'defense' ? 'построено!' : 'уровень ' + this.g.levels[id]}`);
        this.hooks.save();
      } else {
        const c = this.cards[id];
        c.btn.classList.remove('shake'); void c.btn.offsetWidth; c.btn.classList.add('shake');
      }
    }

    fxHtml(id) {
      const it = TD.ITEMS[id];
      const g = this.g;
      const l = g.levels[id];
      const now = it.fx(l, g.mods);
      if (l >= it.max) return now.map((s) => `<div class="fx-line">${s}</div>`).join('') + '<div class="fx-max">Максимальный уровень</div>';
      const nextLevels = Object.assign({}, g.levels, { [id]: l + 1 });
      const next = it.fx(l + 1, TD.calcMods(nextLevels));
      const split = (s) => { const i = s.indexOf(': '); return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 2)]; };
      const same = now.length === next.length && now.every((s, i) => split(s)[0] === split(next[i])[0]);
      if (same) {
        return now.map((s, i) => {
          const [lab, v] = split(s), v2 = split(next[i])[1];
          return `<div class="fx-line">${lab}: <b>${v}</b>${v2 !== v ? ` <span class="arrow">→</span> <span class="nxt">${v2}</span>` : ''}</div>`;
        }).join('');
      }
      return `<div class="fx-line muted">${now.join(' · ')}</div>` + next.map((s) => `<div class="fx-line nxt">→ ${s}</div>`).join('');
    }

    refreshCard(id) {
      const c = this.cards[id];
      const it = TD.ITEMS[id];
      const l = this.g.levels[id];
      c.level = l;
      c.lvlEl.textContent = it.kind === 'defense' && l === 0 ? 'Не построено' : `Ур. ${l} / ${it.max}`;
      c.fxEl.innerHTML = this.fxHtml(id);
      c.el.classList.toggle('maxed', l >= it.max);
      c.el.classList.toggle('unbuilt', it.kind === 'defense' && l === 0);
      c.modsKey = JSON.stringify(this.g.mods);
    }

    update() {
      const g = this.g;
      const modsKey = JSON.stringify(g.mods);
      for (const id in this.cards) {
        const c = this.cards[id];
        if (c.level !== g.levels[id] || c.modsKey !== modsKey) this.refreshCard(id);
        const cost = g.costOf(id);
        const max = !isFinite(cost);
        const can = !max && g.gold >= cost;
        const label = max ? 'Максимум' : `${g.levels[id] === 0 && TD.ITEMS[id].kind === 'defense' ? 'Построить' : 'Улучшить'} · 🪙 ${fmt(cost)}`;
        if (c.btn.textContent !== label) c.btn.textContent = label;
        c.btn.disabled = max;
        c.btn.classList.toggle('cant', !can && !max);
        c.el.classList.toggle('can', can);
      }
      // Метки на вкладках
      const countCan = (kind) => Object.keys(this.cards).filter((id) => TD.ITEMS[id].kind === kind && g.canUpgrade(id)).length;
      document.querySelectorAll('.tab').forEach((t) => {
        const n = countCan(t.dataset.tab);
        const b = t.querySelector('.badge');
        b.textContent = n || '';
        b.style.display = n ? '' : 'none';
      });
      // HUD
      if (g.gold !== this.lastGold) {
        $('#gold').textContent = fmt(g.gold);
        if (g.gold > this.lastGold && this.lastGold >= 0) { const e = $('#goldPill'); e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
        this.lastGold = g.gold;
      }
      $('#wave').textContent = g.wave;
      const f = Math.max(0, g.wallHp / g.wallMax);
      $('#wallFill').style.width = (f * 100).toFixed(1) + '%';
      $('#wallFill').className = f < 0.3 ? 'low' : f < 0.6 ? 'mid' : '';
      $('#wallText').textContent = `${fmt(Math.max(0, g.wallHp))} / ${fmt(g.wallMax)}`;
      $('#enemies').textContent = g.phase === 'battle' ? g.remaining : '—';
      // Подготовка
      const prep = $('#prep');
      const showPrep = g.phase === 'prep';
      prep.classList.toggle('hidden', !showPrep);
      if (showPrep) {
        if (this.prepWave !== g.wave) {
          this.prepWave = g.wave;
          $('#prepWave').textContent = g.wave;
          $('#prepInfo').innerHTML = this.waveInfo(g.wave);
        }
        $('#chkAuto').checked = g.autoStart;
        $('#prepTimer').textContent = g.autoStart ? `(${Math.ceil(Math.max(0, g.prepTimer))} с)` : '';
      }
    }

    waveInfo(w) {
      const n = Math.round(7 + w * 2.4 + w * w * 0.16);
      const parts = [`Ожидается ≈${n} зомби`];
      if (NEW_ENEMY[w]) parts.push(`<span class="warn">${NEW_ENEMY[w]}</span>`);
      if (TD.BOSSES[w]) parts.push(`<span class="danger">☠ Босс: ${TD.BOSSES[w].name}</span>`);
      if (TD.ELITE_WAVES.includes(w)) parts.push('<span class="warn">Вожаки стаи — живучие громилы</span>');
      if (w === TD.MAX_WAVE) parts.push('<span class="danger">Последняя волна!</span>');
      return parts.join('<br>');
    }

    bind() {
      document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => this.showTab(t.dataset.tab)));
      $('#btnStart').addEventListener('click', () => { this.sfx.init(); this.g.startWave(); });
      $('#chkAuto').addEventListener('change', (e) => { this.g.autoStart = e.target.checked; this.g.prepTimer = TD.PREP_TIME; this.hooks.save(); });
      const cv = this.r.canvas;
      cv.addEventListener('mousemove', (e) => {
        const p = this.r.toLogical(e.clientX, e.clientY);
        const id = this.r.hitTest(p.x, p.y);
        this.r.hover = id;
        cv.style.cursor = id ? 'pointer' : 'default';
      });
      cv.addEventListener('mouseleave', () => { this.r.hover = null; });
      cv.addEventListener('click', (e) => {
        this.sfx.init();
        const p = this.r.toLogical(e.clientX, e.clientY);
        const id = this.r.hitTest(p.x, p.y);
        if (id) this.select(id, true);
      });
    }

    toast(msg) {
      const t = document.createElement('div');
      t.className = 'toast-item';
      t.textContent = msg;
      $('#toast').appendChild(t);
      setTimeout(() => t.classList.add('out'), 1800);
      setTimeout(() => t.remove(), 2400);
    }

    modal(html, buttons) {
      const o = $('#overlay');
      const m = $('#modal');
      m.innerHTML = html + '<div class="modal-btns"></div>';
      const row = m.querySelector('.modal-btns');
      for (const b of buttons) {
        const el = document.createElement('button');
        el.className = 'btn ' + (b.cls || '');
        el.textContent = b.text;
        el.addEventListener('click', () => { this.sfx.init(); if (!b.keep) this.closeModal(); b.fn && b.fn(); });
        row.appendChild(el);
      }
      o.classList.remove('hidden');
    }

    closeModal() { $('#overlay').classList.add('hidden'); }
    get modalOpen() { return !$('#overlay').classList.contains('hidden'); }
  }

  TD.UI = UI;
})();
