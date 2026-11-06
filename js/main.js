/* Последний Бастион — запуск и игровой цикл */
(function () {
  const TD = globalThis.TD;
  const SAVE_KEY = 'lastBastion.save.v1';
  const $ = (s) => document.querySelector(s);

  const store = {
    load() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
    save(d) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { /* хранилище недоступно */ } },
    clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } },
  };

  const game = new TD.Game();
  const canvas = $('#game');
  const renderer = new TD.Renderer(canvas, game);
  const sfx = new TD.Sfx();
  let speed = 1, paused = false;
  const save = () => { if (game.phase !== 'menu' && game.phase !== 'victory') store.save(game.toJSON()); };
  const ui = new TD.UI(game, renderer, sfx, { save });

  try { sfx.on = localStorage.getItem('lastBastion.sound') !== 'off'; } catch (e) { /* ignore */ }
  const setSoundBtn = () => { $('#btnSound').innerHTML = TD.icon(sfx.on ? 'sound' : 'mute'); };
  setSoundBtn();

  // ---------- События игры ----------
  game.on('sfx', (n) => sfx.play(n));
  game.on('waveStart', (w) => {
    const b = TD.BOSSES[w];
    renderer.showBanner(`ВОЛНА ${w}`, w === TD.MAX_WAVE ? 'Последний рубеж!' : b ? 'Приближается нечто огромное...' : 'Мертвецы идут!');
    sfx.play('horn');
  });
  game.on('boss', (z) => {
    renderer.showBanner(z.name, 'Босс вышел на поле боя', '#ff6a4a');
    sfx.play('boss');
  });
  game.on('bossDown', (z) => { ui.toast(`☠ <b>${z.name}</b> повержен!`); sfx.play('win'); });
  game.on('waveCleared', (d) => {
    renderer.showBanner('ВОЛНА ОТБИТА!', `Награда +${d.reward} золота   ·   за убийства +${d.killGold}`, '#9cff7a');
    sfx.play('coin');
    setTimeout(() => sfx.play('coin'), 150);
  });
  game.on('prep', () => save());
  game.on('defeat', (w) => {
    sfx.play('lose');
    save();
    setTimeout(() => {
      if (game.phase !== 'defeat') return;
      ui.modal(
        `<h2 class="bad">Стена пала!</h2>
         <p>Мертвецы прорвались на <b>волне ${w}</b>.</p>
         <p>Золото, заработанное в бою, остаётся у вас. Усильте оборону и попробуйте снова — стена будет отстроена.</p>`,
        [{ text: '<i class="ico" data-icon="shield"></i> Повторить волну', cls: 'primary', fn: () => { game.retryWave(); save(); } }],
      );
    }, 1600);
  });
  game.on('victory', () => {
    sfx.play('win');
    store.clear();
    const s = game.stats;
    ui.modal(
      `<h2 class="good">Победа!</h2>
       <p>Поселение выстояло все ${TD.MAX_WAVE} волн. Король Мёртвых повержен, а над стенами встаёт рассвет.</p>
       <div class="stats">
         <div><span>Убито зомби</span><b>${s.kills.toLocaleString('ru-RU')}</b></div>
         <div><span>Боссов повержено</span><b>${s.bosses}</b></div>
         <div><span>Добыто золота</span><b>${s.gold.toLocaleString('ru-RU')}</b></div>
         <div><span>Падений стены</span><b>${s.defeats}</b></div>
       </div>`,
      [{ text: 'Новая игра', cls: 'primary', fn: () => newGame() }],
    );
  });

  // ---------- Меню ----------
  const HOWTO = `
    <ul class="howto">
      <li>Бой идёт <b>сам</b>: лучники, баллисты, катапульты, требушеты и котлы с горящим воском стреляют автоматически.</li>
      <li>Ваша задача — <b>улучшать</b>. Кликайте по зданиям поселения или карточкам справа.</li>
      <li>Золото дают за каждого зомби и за каждую отбитую волну.</li>
      <li>Если стена падёт — волну можно переиграть, золото из боя сохраняется.</li>
      <li>Переживите <b>25 волн</b> и пятерых боссов.</li>
    </ul>`;

  function mainMenu() {
    const sv = store.load();
    const btns = [];
    if (sv && sv.wave) btns.push({ text: `<i class="ico" data-icon="play"></i> Продолжить · волна ${sv.wave}`, cls: 'primary', fn: () => { game.load(sv); begin(); } });
    btns.push({ text: sv ? 'Новая игра' : '<i class="ico" data-icon="swords"></i> Начать оборону', cls: sv ? '' : 'primary', fn: () => newGame() });
    ui.modal(
      `<div class="logo">♜</div>
       <h1>Последний Бастион</h1>
       <p class="sub">Отстройте поселение и удержите стены против 25 волн мертвецов</p>
       ${HOWTO}`,
      btns,
    );
  }

  function newGame() {
    store.clear();
    game.newGame();
    begin();
  }

  function begin() {
    sfx.init();
    renderer.decor = null;
    game.startGame();
    paused = false;
    setPauseBtn();
    save();
  }

  function pauseMenu() {
    paused = true;
    setPauseBtn();
    ui.modal(
      `<h2>Пауза</h2>${HOWTO}`,
      [
        { text: '<i class="ico" data-icon="play"></i> Продолжить', cls: 'primary', fn: () => { paused = false; setPauseBtn(); } },
        {
          text: 'Новая игра', keep: true, fn: () => ui.modal('<h2>Начать заново?</h2><p>Весь прогресс будет потерян.</p>', [
            { text: 'Да, заново', cls: 'danger', fn: () => newGame() },
            { text: 'Отмена', fn: () => { paused = false; setPauseBtn(); } },
          ]),
        },
      ],
    );
  }

  function setPauseBtn() { $('#btnPause').innerHTML = TD.icon(paused ? 'play' : 'pause'); $('#btnPause').classList.toggle('on', paused); }

  $('#btnPause').addEventListener('click', () => {
    if (game.phase === 'menu' || ui.modalOpen) return;
    paused = !paused;
    setPauseBtn();
  });
  $('#btnSpeed').addEventListener('click', () => {
    speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
    $('#btnSpeed').innerHTML = '<b>x' + speed + '</b>';
    $('#btnSpeed').classList.toggle('on', speed > 1);
  });
  $('#btnSound').addEventListener('click', () => {
    sfx.on = !sfx.on;
    sfx.init();
    setSoundBtn();
    try { localStorage.setItem('lastBastion.sound', sfx.on ? 'on' : 'off'); } catch (e) { /* ignore */ }
  });
  $('#btnMenu').addEventListener('click', () => { if (game.phase !== 'menu' && !ui.modalOpen) pauseMenu(); });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && game.phase === 'prep' && !ui.modalOpen) { e.preventDefault(); game.startWave(); }
    if (e.code === 'KeyP' && game.phase !== 'menu' && !ui.modalOpen) { paused = !paused; setPauseBtn(); }
  });

  // ---------- Размеры ----------
  const onResize = () => renderer.resize();
  window.addEventListener('resize', onResize);
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(canvas);

  // ---------- Цикл ----------
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const id in renderer.flashUp) renderer.flashUp[id] = Math.max(0, renderer.flashUp[id] - dt * 1.5);
    const blocked = paused || (ui.modalOpen && game.phase !== 'menu' && game.phase !== 'defeat' && game.phase !== 'victory');
    if (!blocked) for (let i = 0; i < speed; i++) game.update(dt);
    renderer.render(blocked ? 0 : dt * speed);
    ui.update();
    requestAnimationFrame(frame);
  }
  ui.update();
  mainMenu();
  requestAnimationFrame(frame);

  // Для отладки из консоли
  TD.app = { game, renderer, ui, sfx };
})();
