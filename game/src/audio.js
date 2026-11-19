// audio.js — every sound is synthesised with WebAudio: engine, tyres, horn, four guns, reload,
// footsteps, the two-tone siren, the helicopter rotor, UI clicks and three little radio stations.
// Nothing is loaded from disk and nothing starts before the first user gesture.
export function createAudio() {
  let ac = null;
  let master = null;
  let engine = null;
  let siren = null;
  let rotor = null;
  let bed = null;
  let started = false;
  let volume = 0.7;
  let stepTimer = 0;
  let radioTimer = 0;
  let radioStep = 0;
  let radioStation = 0;
  let radioOn = true;

  const now = () => (ac ? ac.currentTime : 0);

  const noiseBuffer = (seconds = 1) => {
    const len = Math.max(1, Math.floor(ac.sampleRate * seconds));
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  };
  let noise = null;

  const start = () => {
    if (started) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    noise = noiseBuffer(1.2);
    master = ac.createGain();
    master.gain.value = volume;
    master.connect(ac.destination);

    // city bed: low filtered noise
    const bedSrc = ac.createBufferSource();
    bedSrc.buffer = noise;
    bedSrc.loop = true;
    const bedFilter = ac.createBiquadFilter();
    bedFilter.type = 'lowpass';
    bedFilter.frequency.value = 400;
    const bedGain = ac.createGain();
    bedGain.gain.value = 0.018;
    bedSrc.connect(bedFilter).connect(bedGain).connect(master);
    bedSrc.start();
    bed = { src: bedSrc, gain: bedGain };

    // engine: saw through a lowpass, pitch follows speed
    const eOsc = ac.createOscillator();
    eOsc.type = 'sawtooth';
    eOsc.frequency.value = 55;
    const e2 = ac.createOscillator();
    e2.type = 'square';
    e2.frequency.value = 27;
    const eFilter = ac.createBiquadFilter();
    eFilter.type = 'lowpass';
    eFilter.frequency.value = 380;
    const eGain = ac.createGain();
    eGain.gain.value = 0;
    eOsc.connect(eFilter);
    e2.connect(eFilter);
    eFilter.connect(eGain).connect(master);
    eOsc.start(); e2.start();
    engine = { osc: eOsc, sub: e2, filter: eFilter, gain: eGain };

    // siren: two squares, alternating
    const s1 = ac.createOscillator();
    s1.type = 'square';
    s1.frequency.value = 620;
    const s2 = ac.createOscillator();
    s2.type = 'square';
    s2.frequency.value = 780;
    const sGain = ac.createGain();
    sGain.gain.value = 0;
    s1.connect(sGain); s2.connect(sGain);
    sGain.connect(master);
    s1.start(); s2.start();
    siren = { a: s1, b: s2, gain: sGain, phase: 0 };

    // rotor: filtered noise with a slow chop
    const rSrc = ac.createBufferSource();
    rSrc.buffer = noise;
    rSrc.loop = true;
    const rFilter = ac.createBiquadFilter();
    rFilter.type = 'bandpass';
    rFilter.frequency.value = 160;
    const rGain = ac.createGain();
    rGain.gain.value = 0;
    rSrc.connect(rFilter).connect(rGain).connect(master);
    rSrc.start();
    rotor = { gain: rGain, filter: rFilter };

    started = true;
  };

  const setVolume = (v) => {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = volume;
  };

  const burst = (freq, duration, gain = 0.2, type = 'noise') => {
    if (!ac || !started) return;
    const t = now();
    if (type === 'noise') {
      const src = ac.createBufferSource();
      src.buffer = noise;
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const g = ac.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      src.connect(filter).connect(g).connect(master);
      src.start(t);
      src.stop(t + duration + 0.02);
    } else {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.5), t + duration);
      const g = ac.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + duration + 0.02);
    }
  };

  const shot = (type = 'pistol') => {
    if (!ac) return;
    if (type === 'pistol') { burst(1700, 0.12, 0.22); burst(240, 0.1, 0.16, 'triangle'); }
    else if (type === 'smg') { burst(2200, 0.07, 0.15); burst(300, 0.06, 0.1, 'square'); }
    else if (type === 'shotgun') { burst(900, 0.28, 0.3); burst(120, 0.22, 0.22, 'triangle'); }
    else { burst(300, 0.06, 0.08, 'square'); }
  };

  const ui = () => burst(900, 0.03, 0.04, 'sine');
  const reload = () => { burst(500, 0.04, 0.05, 'square'); setTimeout(() => burst(700, 0.05, 0.05, 'square'), 90); };
  const horn = () => {
    if (!ac) return;
    const t = now();
    for (const f of [392, 494]) {
      const o = ac.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.setValueAtTime(0.06, t + 0.22);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + 0.32);
    }
  };

  const footstep = () => burst(280, 0.04, 0.025, 'triangle');
  const skid = () => burst(900, 0.18, 0.035);

  const radio = (station) => { radioStation = station; };

  const radioTick = () => {
    if (!ac || !started || !radioOn) return;
    const scales = [
      [220, 261.6, 293.7, 329.6, 392, 329.6, 293.7, 261.6],
      [246.9, 311.1, 370, 415.3, 493.9, 415.3, 370, 311.1],
      [196, 233.1, 261.6, 311.1, 349.2, 311.1, 261.6, 233.1],
    ];
    const scale = scales[radioStation % scales.length];
    const step = radioStep % scale.length;
    radioStep += 1;
    const f = scale[step] * (radioStation === 0 ? 1 : 1);
    const t = now();
    const o = ac.createOscillator();
    o.type = radioStation === 2 ? 'triangle' : 'sine';
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.012, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.24);
    if (step % 4 === 0) {
      const b = ac.createOscillator();
      b.type = 'sine';
      b.frequency.value = f / 2;
      const bg = ac.createGain();
      bg.gain.setValueAtTime(0.01, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      b.connect(bg).connect(master);
      b.start(t); b.stop(t + 0.42);
    }
  };

  const update = (dt, view) => {
    if (!ac || !started) return;
    const v = view?.vehicle;
    if (engine) {
      const sp = v ? Math.abs(v.speed) : 0;
      engine.osc.frequency.setTargetAtTime(52 + sp * 2.4, now(), 0.08);
      engine.sub.frequency.setTargetAtTime(26 + sp * 1.1, now(), 0.08);
      engine.filter.frequency.setTargetAtTime(300 + sp * 16, now(), 0.1);
      engine.gain.gain.setTargetAtTime(v ? 0.035 + Math.min(0.05, sp * 0.0012) : 0, now(), 0.15);
    }
    if (siren) {
      const on = view?.police?.level > 0 && view?.police?.near;
      siren.phase += dt * 6.5;
      const hz = Math.sin(siren.phase) > 0 ? 690 : 560;
      siren.a.frequency.setTargetAtTime(hz, now(), 0.03);
      siren.b.frequency.setTargetAtTime(hz * 1.2, now(), 0.03);
      siren.gain.gain.setTargetAtTime(on ? 0.022 : 0, now(), 0.2);
    }
    if (rotor) {
      const on = Boolean(view?.police?.heli);
      rotor.gain.gain.setTargetAtTime(on ? 0.028 : 0, now(), 0.3);
      rotor.filter.frequency.setTargetAtTime(130 + Math.sin(now() * 8) * 30, now(), 0.1);
    }
    if (view?.playing) {
      stepTimer += dt;
      if (view?.playerMoving && stepTimer > 0.42) { stepTimer = 0; footstep(); }
      if (view?.skidding) skid();
      radioTimer += dt;
      if (radioTimer > 0.26) { radioTimer = 0; radioTick(); }
    }
  };

  return {
    start, setVolume, update, shot, reload, horn, ui, footstep, skid, radio,
    setRadioOn: (on) => { radioOn = on; },
    get started() { return started; },
    get ctx() { return ac; },
  };
}
