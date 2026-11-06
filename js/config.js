/* Последний Бастион — игровые данные и формулы баланса */
(function () {
  const TD = globalThis.TD || (globalThis.TD = {});

  TD.WORLD = {
    WALL_FRONT: 520,   // x лицевой стороны стены (сюда приходят зомби)
    WALL_BACK: 478,    // x тыльной стороны стены
    Z_MAX: 400,        // глубина поля (0 — дальний край, 400 — ближний)
    SPAWN_X: 1330,     // где появляются зомби
    VPX: 640,          // точка схода по X
    GY0: 335,          // экранный Y земли на дальнем краю
    GY1: 700,          // экранный Y земли на ближнем краю
    S0: 0.72,          // масштаб на дальнем краю
    S1: 1.0,           // масштаб на ближнем краю
    XOFF: 100,         // сдвиг мира по X на экране
    SHEAR: 0.5,        // косой сдвиг по глубине (даёт 2.5D-ракурс)
  };

  TD.MAX_WAVE = 25;
  TD.START_GOLD = 120;
  TD.PREP_TIME = 12;

  TD.cost = function (item, level) {
    return Math.round(item.base * Math.pow(item.growth, level - (item.start || 0)));
  };

  // Модификаторы от зданий поселения
  TD.calcMods = function (L) {
    return {
      gold: 1 + 0.12 * L.townhall,
      dmg: 1 + 0.10 * L.forge,
      archerRate: 1 + 0.10 * L.range,
      crit: 0.05 + 0.025 * L.range,
      siegeRate: 1 + 0.07 * L.workshop,
      splash: 1 + 0.06 * L.workshop,
      wallHp: 1 + 0.12 * L.masonry,
      regen: 0.001 * L.masonry,
      oil: 1 + 0.2 * L.alchemy,
      fireArrow: 0.04 * L.alchemy,
      fireRocks: L.alchemy >= 3,
    };
  };

  // Характеристики обороны
  const S = (TD.S = {
    wallHp: (l, m) => Math.round(450 * Math.pow(1.3, l - 1) * m.wallHp),
    archerCount: (l) => Math.min(12, 2 + Math.floor(l * 0.75)),
    archerDmg: (l, m) => 7 * Math.pow(1.15, l - 1) * m.dmg,
    archerInterval: (l, m) => 1.25 / m.archerRate,
    archerRange: 720,
    ballistaCount: (l) => (l <= 0 ? 0 : l < 5 ? 1 : l < 9 ? 2 : 3),
    ballistaDmg: (l, m) => 34 * Math.pow(1.17, l - 1) * m.dmg,
    ballistaPierce: (l) => 3 + Math.floor(l / 3),
    ballistaInterval: (l, m) => 2.8 / m.siegeRate,
    catapultCount: (l) => (l <= 0 ? 0 : l < 5 ? 1 : l < 9 ? 2 : 3),
    catapultDmg: (l, m) => 50 * Math.pow(1.17, l - 1) * m.dmg,
    catapultRadius: (l, m) => 52 * m.splash,
    catapultInterval: (l, m) => 4.6 / m.siegeRate,
    trebCount: (l) => (l <= 0 ? 0 : l < 6 ? 1 : 2),
    trebDmg: (l, m) => 170 * Math.pow(1.18, l - 1) * m.dmg,
    trebRadius: (l, m) => 88 * m.splash,
    trebInterval: (l, m) => 9 / m.siegeRate,
    oilCount: (l) => (l <= 0 ? 0 : l < 5 ? 1 : l < 9 ? 2 : 3),
    oilDps: (l, m) => 30 * Math.pow(1.2, l - 1) * m.oil * m.dmg,
    oilCooldown: (l) => 11 - l * 0.4,
  });

  const pct = (v) => Math.round(v * 100) + '%';
  const n0 = (v) => Math.round(v).toLocaleString('ru-RU');
  const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString('ru-RU');

  // Здания поселения
  TD.BUILDINGS = [
    {
      id: 'townhall', name: 'Ратуша', icon: '🏛️', max: 10, base: 90, growth: 1.5,
      desc: 'Сборщики налогов приносят больше золота за убийства и пройденные волны.',
      fx: (l) => [`Золото: +${l * 12}%`],
      pos: { x: 115, z: 195, w: 125, d: 95, h: 72, badge: 205 },
    },
    {
      id: 'forge', name: 'Кузница', icon: '⚒️', max: 10, base: 110, growth: 1.5,
      desc: 'Закалённые наконечники, ядра и болты — урон всей обороны выше.',
      fx: (l) => [`Урон всей обороны: +${l * 10}%`],
      pos: { x: 60, z: 55, w: 95, d: 62, h: 48 },
    },
    {
      id: 'range', name: 'Стрельбище', icon: '🎯', max: 10, base: 100, growth: 1.5,
      desc: 'Тренировки лучников: быстрее стреляют и чаще попадают в уязвимые места.',
      fx: (l, m) => [`Скорострельность: +${l * 10}%`, `Шанс крита (x2): ${pct(m.crit)}`],
      pos: { x: 215, z: 45, w: 100, d: 58, h: 42 },
    },
    {
      id: 'workshop', name: 'Мастерская', icon: '🛠️', max: 10, base: 140, growth: 1.5,
      desc: 'Инженеры ускоряют перезарядку баллист, катапульт и требушетов и увеличивают радиус взрыва.',
      fx: (l) => [`Скорость осадных орудий: +${l * 7}%`, `Радиус взрыва: +${l * 6}%`],
      pos: { x: 235, z: 345, w: 105, d: 62, h: 48 },
    },
    {
      id: 'masonry', name: 'Каменотёсы', icon: '⛏️', max: 10, base: 100, growth: 1.5,
      desc: 'Укрепляют кладку: прочность стены выше, а в бою её постоянно латают.',
      fx: (l) => [`Прочность стены: +${l * 12}%`, `Ремонт в бою: ${n1(l * 0.1)}%/с`],
      pos: { x: 65, z: 345, w: 95, d: 62, h: 46 },
    },
    {
      id: 'alchemy', name: 'Алхимик', icon: '⚗️', max: 10, base: 130, growth: 1.5,
      desc: 'Горючие смеси: сильнее горящий воск, огненные стрелы, а с 3 ур. — пылающие снаряды катапульт и требушетов.',
      fx: (l, m) => [`Урон горящего воска: +${l * 20}%`, `Огненные стрелы: ${pct(m.fireArrow)}`, l >= 3 ? 'Пылающие снаряды: да' : 'Пылающие снаряды: с 3 ур.'],
      pos: { x: 240, z: 195, w: 78, d: 72, h: 54 },
    },
  ];

  // Оборона
  TD.DEFENSES = [
    {
      id: 'wall', name: 'Стены', icon: '🧱', start: 1, max: 15, base: 70, growth: 1.4,
      desc: 'Частокол → каменная стена → крепость. Если стена падёт — волна проиграна.',
      fx: (l, m) => [`Прочность: ${n0(S.wallHp(l, m))}`],
    },
    {
      id: 'archers', name: 'Лучники', icon: '🏹', start: 1, max: 15, base: 55, growth: 1.38,
      desc: 'Стреляют со стены по ближайшим зомби. Больше лучников и сильнее луки.',
      fx: (l, m) => [`Лучников: ${S.archerCount(l)}`, `Урон стрелы: ${n0(S.archerDmg(l, m))}`],
    },
    {
      id: 'oil', name: 'Горящий воск', icon: '🔥', start: 0, max: 10, base: 170, growth: 1.45,
      desc: 'Котлы на стене опрокидывают пылающий воск на зомби у подножия стены.',
      fx: (l, m) => l <= 0 ? ['Не построено'] : [`Котлов: ${S.oilCount(l)}`, `Урон огня: ${n0(S.oilDps(l, m))}/с`, `Перезарядка: ${n1(S.oilCooldown(l))} с`],
    },
    {
      id: 'ballista', name: 'Баллисты', icon: '🔱', start: 0, max: 12, base: 140, growth: 1.4,
      desc: 'Башни с баллистами. Тяжёлый болт пробивает несколько зомби подряд.',
      fx: (l, m) => l <= 0 ? ['Не построено'] : [`Баллист: ${S.ballistaCount(l)}`, `Урон: ${n0(S.ballistaDmg(l, m))}`, `Пробивает: ${S.ballistaPierce(l)}`],
    },
    {
      id: 'catapult', name: 'Катапульты', icon: '☄️', start: 0, max: 12, base: 260, growth: 1.4,
      desc: 'Швыряют камни в гущу зомби — урон по площади.',
      fx: (l, m) => l <= 0 ? ['Не построено'] : [`Катапульт: ${S.catapultCount(l)}`, `Урон: ${n0(S.catapultDmg(l, m))}`, `Радиус: ${n0(S.catapultRadius(l, m))}`],
    },
    {
      id: 'trebuchet', name: 'Требушет', icon: '⚖️', start: 0, max: 10, base: 650, growth: 1.45,
      desc: 'Огромный противовесный требушет. Медленный, но сносит толпы и боссов издалека.',
      fx: (l, m) => l <= 0 ? ['Не построено'] : [`Требушетов: ${S.trebCount(l)}`, `Урон: ${n0(S.trebDmg(l, m))}`, `Радиус: ${n0(S.trebRadius(l, m))}`],
    },
  ];

  TD.ITEMS = {};
  for (const it of TD.BUILDINGS) { it.kind = 'building'; TD.ITEMS[it.id] = it; }
  for (const it of TD.DEFENSES) { it.kind = 'defense'; TD.ITEMS[it.id] = it; }

  // Зомби
  TD.ZOMBIES = {
    walker: { name: 'Зомби', hp: 32, speed: 26, dps: 6, gold: 2, size: 1.0 },
    runner: { name: 'Бегун', hp: 20, speed: 54, dps: 4, gold: 2, size: 0.92 },
    brute: { name: 'Громила', hp: 170, speed: 17, dps: 18, gold: 7, size: 1.45 },
    exploder: { name: 'Раздутый', hp: 60, speed: 21, dps: 0, blast: 90, gold: 4, size: 1.15 },
    spitter: { name: 'Плевун', hp: 48, speed: 24, dps: 0, spit: 14, range: 190, gold: 5, size: 1.0 },
    elite: { name: 'Вожак', hp: 700, speed: 16, dps: 30, gold: 40, size: 1.9 },
  };

  TD.BOSSES = {
    5: { type: 'butcher', name: 'Мясник', hp: 600, speed: 15, dps: 28, gold: 120, size: 2.1 },
    10: { type: 'necro', name: 'Некромант', hp: 700, speed: 13, dps: 20, gold: 220, size: 2.0, summon: { type: 'walker', n: 3, every: 8 } },
    15: { type: 'colossus', name: 'Каменный Колосс', hp: 1200, speed: 11, dps: 45, gold: 400, size: 2.7, armor: 0.4 },
    20: { type: 'titan', name: 'Чумной Титан', hp: 1700, speed: 12, dps: 45, gold: 650, size: 2.6, split: { type: 'exploder', n: 6 } },
    25: { type: 'lich', name: 'Король Мёртвых', hp: 2000, speed: 12, dps: 60, gold: 1500, size: 2.5, summon: { type: 'runner', n: 4, every: 5 }, armor: 0.3 },
  };
  TD.ELITE_WAVES = [13, 17, 22, 24];

  TD.hpMul = (w) => Math.pow(1.14, w - 1);
  TD.dmgMul = (w) => 1 + 0.08 * (w - 1);
  TD.killGoldMul = (w) => 1 + 0.06 * (w - 1);
  TD.waveReward = (w) => 40 + 16 * w;

  // Состав волны: список {t, type, boss}
  TD.buildWave = function (w) {
    const n = Math.round(7 + w * 2.4 + w * w * 0.16);
    const weights = [
      ['walker', 10],
      ['runner', w >= 3 ? 2 + w * 0.25 : 0],
      ['brute', w >= 6 ? 1 + w * 0.12 : 0],
      ['exploder', w >= 8 ? 1 + w * 0.08 : 0],
      ['spitter', w >= 11 ? 1 + w * 0.08 : 0],
    ];
    const total = weights.reduce((s, x) => s + x[1], 0);
    const pick = () => {
      let r = Math.random() * total;
      for (const [t, wt] of weights) { r -= wt; if (r <= 0) return t; }
      return 'walker';
    };
    const D = 16 + w * 1.6;
    const groups = 3 + Math.floor(w / 4);
    const list = [];
    for (let i = 0; i < n; i++) {
      const g = Math.floor((i / n) * groups);
      const gStart = (g / groups) * D;
      const t = gStart + Math.random() * (D / groups) * 0.8;
      list.push({ t, type: pick() });
    }
    if (TD.BOSSES[w]) list.push({ t: D * 0.5, type: TD.BOSSES[w].type, boss: true });
    if (TD.ELITE_WAVES.includes(w)) {
      list.push({ t: D * 0.35, type: 'elite' });
      if (w >= 22) list.push({ t: D * 0.75, type: 'elite' });
    }
    list.sort((a, b) => a.t - b.t);
    return list;
  };
})();
