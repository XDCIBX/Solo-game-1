/* Последний Бастион — интерфейс: HUD, панель улучшений, окна */
(function () {
  const TD = globalThis.TD;
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => Math.floor(n).toLocaleString('ru-RU');

  // SVG-иконки (24×24)
  const I = {
    shield: '<path d="M12 2l8 3v6c0 5-3.5 9.3-8 11-4.5-1.7-8-6-8-11V5z" fill="currentColor"/><path d="M12 5v14" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>',
    skull: '<path fill="currentColor" d="M12 2C7 2 3.5 5.5 3.5 10c0 2.6 1.2 4.6 3 5.8V19a1 1 0 001 1h2v-2h1.2v2h2.6v-2H14.5v2h2a1 1 0 001-1v-3.2c1.8-1.2 3-3.2 3-5.8C20.5 5.5 17 2 12 2zM8.5 13.2a2.1 2.1 0 110-4.2 2.1 2.1 0 010 4.2zm7 0a2.1 2.1 0 110-4.2 2.1 2.1 0 010 4.2zM12 14.5l-1.2 2h2.4z"/>',
    tower: '<path fill="currentColor" d="M5 2h2.5v2h2V2h2.2v2h2V2h2.2v2h2V2H20v6l-2 2v12H6V10L4 8V2zm6 14v6h2v-6a1 1 0 00-2 0z" transform="translate(0 0)"/>',
    pause: '<path fill="currentColor" d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
    play: '<path fill="currentColor" d="M7 4l13 8-13 8z"/>',
    sound: '<path fill="currentColor" d="M3 9h4l5-4v14l-5-4H3z"/><path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    mute: '<path fill="currentColor" d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    swords: '<path d="M4 4l10 10M20 4L10 14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 16l-4 4M12 16l4 4M7 13l4 4M17 13l-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    house: '<path fill="currentColor" d="M3 11.5L12 3l9 8.5V21h-6v-6H9v6H3z"/>',
    up: '<path fill="currentColor" d="M12 4l7 8h-4v8H9v-8H5z"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
  TD.icon = icon;
  function applyIcons(root) { (root || document).querySelectorAll('i.ico[data-icon]').forEach((e) => { e.innerHTML = icon(e.dataset.icon); }); }

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
      applyIcons();
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
        el.innerHTML = `
          <div class="card-art"><div class="art-frame"></div><span class="lvl-gem"></span></div>
          <div class="card-main">
            <div class="card-name">${it.name}</div>
            <div class="pips"></div>
            <div class="card-desc">${it.desc}</div>
          </div>
          <div class="card-fx"></div>
          <button class="upg"><span class="upg-label"></span><span class="price"><i class="coin"></i><b></b></span></button>`;
        el.querySelector('.upg').addEventListener('click', (e) => { e.stopPropagation(); this.buy(it.id); });
        el.addEventListener('click', () => this.select(it.id, false));
        root.appendChild(el);
        this.cards[it.id] = {
          el, art: el.querySelector('.art-frame'), gem: el.querySelector('.lvl-gem'), pips: el.querySelector('.pips'),
          fxEl: el.querySelector('.card-fx'), btn: el.querySelector('.upg'), label: el.querySelector('.upg-label'), price: el.querySelector('.price b'),
          level: -1, thumbKey: null,
        };
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
        this.toast(`<b>${it.name}</b> — ${wasLvl === 0 && it.kind === 'defense' ? 'построено!' : 'уровень ' + this.g.levels[id]}`);
        const c = this.cards[id];
        c.el.classList.remove('upgraded'); void c.el.offsetWidth; c.el.classList.add('upgraded');
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
      const split = (s) => { const i = s.indexOf(': '); return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 2)]; };
      const row = (lab, v, nx) => `<div class="fx-row"><span class="fx-lab">${lab}</span><span class="fx-dots"></span><span class="fx-val">${v}${nx != null && nx !== v ? `<span class="fx-arrow">▸</span><span class="fx-next">${nx}</span>` : ''}</span></div>`;
      if (l >= it.max) return now.map((s) => row(...split(s))).join('') + '<div class="fx-max">✦ Максимальный уровень ✦</div>';
      const next = it.fx(l + 1, TD.calcMods(Object.assign({}, g.levels, { [id]: l + 1 })));
      const same = now.length === next.length && now.every((s, i) => split(s)[0] === split(next[i])[0]);
      if (same) return now.map((s, i) => { const [lab, v] = split(s); return row(lab, v, split(next[i])[1]); }).join('');
      return `<div class="fx-note">После постройки:</div>` + next.map((s) => { const [lab, v] = split(s); return row(lab, `<span class="fx-next">${v}</span>`); }).join('');
    }

    thumbKey(id, l) {
      const it = TD.ITEMS[id];
      if (it.kind === 'building') return TD.Bld.tier(l);
      if (id === 'wall') return l < 4 ? 0 : l < 9 ? 1 : 2;
      if (id === 'archers') return l >= 11 ? 2 : l >= 6 ? 1 : 0;
      if (id === 'ballista') return l >= 9 ? 1 : 0;
      return 0;
    }

    refreshCard(id) {
      const c = this.cards[id];
      const it = TD.ITEMS[id];
      const l = this.g.levels[id];
      c.level = l;
      const tk = this.thumbKey(id, l);
      if (c.thumbKey !== tk) {
        c.thumbKey = tk;
        try {
          const cv = this.r.thumb(id, Math.max(l, it.kind === 'defense' ? 1 : 0));
          cv.className = 'thumb';
          c.art.innerHTML = '';
          c.art.appendChild(cv);
        } catch (e) { /* иконка не критична */ }
      }
      c.gem.textContent = l >= it.max ? '★' : String(l);
      const n = it.max;
      let pips = '';
      for (let i = 1; i <= n; i++) pips += `<i class="pip${i <= l ? ' on' : ''}"></i>`;
      c.pips.innerHTML = pips;
      c.pips.classList.toggle('dense', n > 12);
      c.fxEl.innerHTML = this.fxHtml(id);
      c.el.classList.toggle('maxed', l >= it.max);
      c.el.classList.toggle('unbuilt', it.kind === 'defense' && l === 0);
      c.modsKey = this.modsKey;
    }

    update() {
      const g = this.g;
      this.modsKey = JSON.stringify(g.mods);
      for (const id in this.cards) {
        const c = this.cards[id];
        if (c.level !== g.levels[id] || c.modsKey !== this.modsKey) this.refreshCard(id);
        const cost = g.costOf(id);
        const max = !isFinite(cost);
        const can = !max && g.gold >= cost;
        const label = max ? 'Максимум' : g.levels[id] === 0 && TD.ITEMS[id].kind === 'defense' ? 'Построить' : 'Улучшить';
        if (c.label.textContent !== label) c.label.textContent = label;
        const pr = max ? '' : fmt(cost);
        if (c.price.textContent !== pr) c.price.textContent = pr;
        c.btn.disabled = max;
        c.btn.classList.toggle('cant', !can && !max);
        c.el.classList.toggle('can', can);
      }
      document.querySelectorAll('.tab').forEach((t) => {
        let n = 0;
        for (const id in this.cards) if (TD.ITEMS[id].kind === t.dataset.tab && g.canUpgrade(id)) n++;
        const b = t.querySelector('.badge');
        b.textContent = n || '';
        b.style.display = n ? '' : 'none';
      });
      if (g.gold !== this.lastGold) {
        $('#gold').textContent = fmt(g.gold);
        $('#panelGold').textContent = fmt(g.gold);
        if (g.gold > this.lastGold && this.lastGold >= 0) for (const e of [$('#goldPill'), $('.ph-gold')]) { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
        this.lastGold = g.gold;
      }
      $('#wave').textContent = g.wave;
      const f = Math.max(0, g.wallHp / g.wallMax);
      const wf = $('#wallFill');
      wf.style.width = (f * 100).toFixed(1) + '%';
      wf.className = f < 0.3 ? 'low' : f < 0.6 ? 'mid' : '';
      $('#wallText').textContent = `${fmt(Math.max(0, g.wallHp))} / ${fmt(g.wallMax)}`;
      $('#enemies').textContent = g.phase === 'battle' ? g.remaining : '—';
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

    toast(html) {
      const t = document.createElement('div');
      t.className = 'toast-item';
      t.innerHTML = html;
      $('#toast').appendChild(t);
      setTimeout(() => t.classList.add('out'), 1800);
      setTimeout(() => t.remove(), 2400);
    }

    modal(html, buttons) {
      const o = $('#overlay');
      const m = $('#modal');
      m.innerHTML = '<span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>' + html + '<div class="modal-btns"></div>';
      const row = m.querySelector('.modal-btns');
      for (const b of buttons) {
        const el = document.createElement('button');
        el.className = 'btn ' + (b.cls || '');
        el.innerHTML = b.text;
        el.addEventListener('click', () => { this.sfx.init(); if (!b.keep) this.closeModal(); b.fn && b.fn(); });
        row.appendChild(el);
      }
      applyIcons(m);
      o.classList.remove('hidden');
    }

    closeModal() { $('#overlay').classList.add('hidden'); }
    get modalOpen() { return !$('#overlay').classList.contains('hidden'); }
  }

  TD.UI = UI;
  TD.applyIcons = applyIcons;
})();
