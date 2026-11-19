// WebAudio synthesis: engine, siren, rotor, guns, skids, horn, city bed and three radio stations.
const STATIONS = [
  { name: 'COBALTO 104.7', track: 'Noche Azul', root: 220, scale: [0, 3, 5, 7, 10], bpm: 92 },
  { name: 'RADIO MAREA 98.1', track: 'Sal y Sol', root: 196, scale: [0, 2, 4, 7, 9], bpm: 108 },
  { name: 'SOMBRA FM 91.9', track: 'Costa Oscura', root: 146.8, scale: [0, 1, 5, 7, 8], bpm: 76 },
];

export class Audio {
  constructor() {
    this.ctx = null; this.started = false; this.station = 0; this.engineOn = false;
    this.sirenOn = false; this.rotorOn = false; this.musicT = 0; this.skidOn = false;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.7;
    this.comp = ctx.createDynamicsCompressor(); this.master.connect(this.comp); this.comp.connect(ctx.destination);
    // engine
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 420;
    this.engOsc = ctx.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 60;
    this.engOsc.connect(this.engFilter); this.engFilter.connect(this.engGain); this.engGain.connect(this.master); this.engOsc.start();
    // siren
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc = ctx.createOscillator(); this.sirenOsc.type = 'square'; this.sirenOsc.frequency.value = 720;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master); this.sirenOsc.start();
    // rotor
    this.rotGain = ctx.createGain(); this.rotGain.gain.value = 0;
    this.rotOsc = ctx.createOscillator(); this.rotOsc.type = 'triangle'; this.rotOsc.frequency.value = 38;
    this.rotLfo = ctx.createOscillator(); this.rotLfo.frequency.value = 14;
    this.rotLfoGain = ctx.createGain(); this.rotLfoGain.gain.value = 0.5;
    this.rotLfo.connect(this.rotLfoGain); this.rotLfoGain.connect(this.rotGain.gain);
    this.rotOsc.connect(this.rotGain); this.rotGain.connect(this.master); this.rotOsc.start(); this.rotLfo.start();
    // city bed
    this.bedGain = ctx.createGain(); this.bedGain.gain.value = 0.02;
    const nb = this.noiseBuffer(2);
    const bed = ctx.createBufferSource(); bed.buffer = nb; bed.loop = true;
    const bf = ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 320;
    bed.connect(bf); bf.connect(this.bedGain); this.bedGain.connect(this.master); bed.start();
    // skid
    this.skidGain = ctx.createGain(); this.skidGain.gain.value = 0;
    const sk = ctx.createBufferSource(); sk.buffer = this.noiseBuffer(1); sk.loop = true;
    const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1400; sf.Q.value = 1.2;
    sk.connect(sf); sf.connect(this.skidGain); this.skidGain.connect(this.master); sk.start();
    this.started = true;
    this.radio();
  }
  noiseBuffer(sec) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  setVolume(v) { if (this.master) this.master.gain.value = v; }
  setEngine(speed, throttle, on) {
    if (!this.ctx) return;
    this.engineOn = on;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(on ? 0.035 + Math.abs(speed) * 0.0012 : 0, t, 0.08);
    this.engOsc.frequency.setTargetAtTime(45 + Math.abs(speed) * 2.2 + throttle * 22, t, 0.06);
    this.engFilter.frequency.setTargetAtTime(300 + Math.abs(speed) * 30, t, 0.08);
  }
  setSiren(on) {
    if (!this.ctx) return;
    this.sirenOn = on;
    this.sirenGain.gain.setTargetAtTime(on ? 0.018 : 0, this.ctx.currentTime, 0.12);
    if (on) this.sirenOsc.frequency.setValueAtTime(Math.sin(this.ctx.currentTime * 7) > 0 ? 760 : 560, this.ctx.currentTime);
  }
  startRotor() { if (this.ctx) this.rotGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.3); this.rotorOn = true; }
  stopRotor() { if (this.ctx) this.rotGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4); this.rotorOn = false; }
  setSkid(on) { if (this.ctx) this.skidGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.08); }
  shot(player) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(player ? 0.5 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = player ? 2400 : 1400;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
    const og = ctx.createGain(); og.gain.setValueAtTime(player ? 0.35 : 0.12, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.13);
  }
  crash(v) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(0.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.2 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  boom() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(24, t + 0.8);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 1);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(0.7);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.35, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    src.connect(ng); ng.connect(this.master); src.start(t);
  }
  horn() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const f of [330, 415]) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.035, t); g.gain.setValueAtTime(0.035, t + 0.22); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.31);
    }
  }
  ui() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 880;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.08);
  }
  step() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(0.05);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.025, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  setStation(i) { this.station = (i + STATIONS.length) % STATIONS.length; this.musicT = 0; this.radio(); }
  radio() {
    if (!this.ctx) return;
    const st = STATIONS[this.station];
    if (this.radioGain) { try { this.radioGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); } catch {} }
    const g = this.ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.018, this.ctx.currentTime + 0.15, 0.6);
    this.radioGain = g; g.connect(this.master);
    this.radioOscs = [];
    for (let i = 0; i < 3; i++) {
      const o = this.ctx.createOscillator(); o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = st.root * (i === 0 ? 1 : i === 1 ? 1.5 : 2);
      o.connect(g); o.start(); this.radioOscs.push(o);
    }
  }
  tick(dt, t) {
    if (!this.ctx) return;
    if (this.sirenOn) this.sirenOsc.frequency.setTargetAtTime(Math.sin(t * 8) > 0 ? 760 : 540, this.ctx.currentTime, 0.02);
    const st = STATIONS[this.station];
    this.musicT += dt;
    if (this.musicT > 60 / st.bpm / 2 && this.radioOscs) {
      this.musicT = 0;
      const n = st.scale[Math.floor(Math.random() * st.scale.length)];
      const f = st.root * Math.pow(2, n / 12) * (Math.random() < 0.3 ? 2 : 1);
      const o = this.radioOscs[Math.floor(Math.random() * this.radioOscs.length)];
      o.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.02);
    }
  }
  stationName() { return STATIONS[this.station].name + ' — ' + STATIONS[this.station].track; }
}
