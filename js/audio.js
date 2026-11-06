/* Последний Бастион — синтезированные звуки (WebAudio, без файлов) */
(function () {
  const TD = globalThis.TD;

  const GAP = { bow: 0.07, ballista: 0.1, catapult: 0.15, trebuchet: 0.3, thud: 0.08, boom: 0.15, fire: 0.25, pop: 0.06, blast: 0.12, summon: 0.5, coin: 0.05, upgrade: 0.05, horn: 1, boss: 1, win: 1, lose: 1 };

  class Sfx {
    constructor() {
      this.on = true;
      this.ctx = null;
      this.last = {};
    }

    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.32;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { this.ctx = null; }
    }

    env(g, t, a, peak, dec) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    }

    tone(type, f0, f1, dur, peak, delay) {
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      this.env(g, t, 0.005, peak, dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
    }

    hiss(filterType, f0, f1, dur, peak, q, delay) {
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const s = c.createBufferSource();
      s.buffer = this.noise;
      s.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = c.createBiquadFilter();
      f.type = filterType; f.Q.value = q || 1;
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = c.createGain();
      this.env(g, t, 0.01, peak, dur);
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    }

    play(name) {
      if (!this.on || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      if (now - (this.last[name] || 0) < (GAP[name] || 0.05)) return;
      this.last[name] = now;
      switch (name) {
        case 'bow': this.hiss('bandpass', 2600, 900, 0.09, 0.07, 2); this.tone('triangle', 320, 160, 0.08, 0.05); break;
        case 'ballista': this.tone('triangle', 190, 55, 0.25, 0.22); this.hiss('lowpass', 1500, 200, 0.15, 0.12); break;
        case 'catapult': this.tone('sine', 110, 40, 0.3, 0.25); this.hiss('lowpass', 900, 150, 0.25, 0.1); break;
        case 'trebuchet': this.hiss('bandpass', 300, 1400, 0.7, 0.12, 0.8); this.tone('sine', 70, 35, 0.5, 0.2, 0.05); break;
        case 'thud': this.hiss('lowpass', 700, 80, 0.35, 0.3); this.tone('sine', 85, 30, 0.3, 0.3); break;
        case 'boom': this.hiss('lowpass', 500, 40, 0.9, 0.55); this.tone('sine', 60, 22, 0.7, 0.5); break;
        case 'fire': this.hiss('bandpass', 600, 2400, 0.6, 0.18, 0.7); break;
        case 'pop': this.tone('sine', 420, 90, 0.15, 0.15); this.hiss('lowpass', 1500, 300, 0.12, 0.08); break;
        case 'blast': this.hiss('lowpass', 1200, 60, 0.6, 0.4); this.tone('sine', 90, 30, 0.45, 0.35); break;
        case 'summon': this.tone('sawtooth', 82, 62, 0.9, 0.06); this.tone('sawtooth', 87, 58, 0.9, 0.06); this.hiss('bandpass', 300, 1200, 0.8, 0.06, 4); break;
        case 'coin': this.tone('square', 1320, 1320, 0.07, 0.04); this.tone('square', 1760, 1760, 0.12, 0.04, 0.07); break;
        case 'upgrade': [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.12, i * 0.06)); break;
        case 'horn': this.tone('sawtooth', 110, 104, 1.3, 0.09); this.tone('sawtooth', 165, 160, 1.3, 0.07); this.tone('sine', 55, 55, 1.3, 0.12); break;
        case 'boss': this.tone('sawtooth', 73, 60, 1.6, 0.12); this.tone('sawtooth', 77, 58, 1.6, 0.1); this.hiss('lowpass', 400, 60, 1.2, 0.3); break;
        case 'win': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.13, i * 0.12)); break;
        case 'lose': [330, 262, 220, 165].forEach((f, i) => this.tone('sawtooth', f, f * 0.98, 0.45, 0.07, i * 0.22)); break;
      }
    }
  }

  TD.Sfx = Sfx;
})();
