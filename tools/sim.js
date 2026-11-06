// Headless-симуляция баланса: node tools/sim.js [runs] [strategy]
// Прогоняет все 25 волн с жадной стратегией покупки улучшений.
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const ctx = { console, Math, Set, Map, Object, Array, JSON, Infinity, isFinite, globalThis: null };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['config.js', 'engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}
const TD = ctx.TD;

const WEIGHTS = {
  balanced: { townhall: 1.2, forge: 1.2, range: 0.9, workshop: 0.8, masonry: 0.7, alchemy: 0.7, wall: 1.0, archers: 1.3, oil: 0.8, ballista: 0.9, catapult: 1.0, trebuchet: 0.9 },
  lazy: { townhall: 0.3, forge: 0.6, range: 0.3, workshop: 0.3, masonry: 0.3, alchemy: 0.3, wall: 1.0, archers: 1.4, oil: 0.4, ballista: 0.5, catapult: 0.6, trebuchet: 0.3 },
};

function shop(g, w) {
  for (;;) {
    let best = null, bs = Infinity;
    for (const id in w) {
      const c = g.costOf(id);
      if (!isFinite(c)) continue;
      const s = c / w[id];
      if (s < bs) { bs = s; best = id; }
    }
    if (!best || !g.upgrade(best)) break;
  }
}

function run(strategy, verbose) {
  const g = new TD.Game({ headless: true });
  g.autoStart = false;
  g.startGame();
  const w = WEIGHTS[strategy];
  const log = [];
  let retries = 0;
  const dt = 1 / 30;
  while (g.phase !== 'victory') {
    shop(g, w);
    g.startWave();
    let t = 0;
    while (g.phase === 'battle' && t < 600) { g.update(dt); t += dt; }
    if (g.phase === 'defeat') {
      retries++;
      log.push({ wave: g.wave, result: 'DEFEAT', t: t.toFixed(0), gold: g.gold, L: Object.values(g.levels).join(',') });
      if (retries > 40) break;
      g.retryWave();
      continue;
    }
    const hpPct = Math.round((g.wallHp / g.wallMax) * 100);
    log.push({ wave: g.wave, result: 'ok', t: t.toFixed(0), wall: hpPct + '%', gold: g.gold });
    while (g.phase === 'cleared') g.update(dt);
  }
  if (verbose) {
    for (const l of log) console.log(JSON.stringify(l));
    console.log('levels', JSON.stringify(g.levels));
  }
  return { retries, won: g.phase === 'victory', log };
}

const runs = +process.argv[2] || 1;
const strategy = process.argv[3] || 'balanced';
let won = 0, totalRetries = 0;
const defeatsByWave = {};
for (let i = 0; i < runs; i++) {
  const r = run(strategy, i === 0);
  if (r.won) won++;
  totalRetries += r.retries;
  for (const l of r.log) if (l.result === 'DEFEAT') defeatsByWave[l.wave] = (defeatsByWave[l.wave] || 0) + 1;
}
console.log(`strategy=${strategy} runs=${runs} won=${won} avgRetries=${(totalRetries / runs).toFixed(2)}`);
console.log('defeats by wave', JSON.stringify(defeatsByWave));
