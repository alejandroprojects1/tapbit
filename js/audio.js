// Sons e música gerados pelo navegador (Web Audio), sem arquivos de áudio.
// Cada bit toca uma nota da escala pentatônica, então montar um código vira uma melodia.
const Sound = (() => {
  'use strict';
  let ctx = null, master = null, sfx = null, music = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
      sfx = ctx.createGain();
      sfx.connect(master);
      music = ctx.createGain();
      music.connect(master);
      apply();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function apply() {
    if (!ctx) return;
    sfx.gain.value = Store.data.sound ? 0.9 : 0;
    music.gain.value = Store.data.music ? 0.32 : 0;
  }

  function tone(freq, o = {}) {
    const c = ensure();
    if (!c || (!Store.data.sound && !o.dest)) return;
    const t = (o.at != null ? o.at : c.currentTime) + (o.delay || 0);
    const dur = o.dur || 0.12;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const vol = o.vol || 0.12;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.015, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(o.dest || sfx);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  let noiseBuf = null;
  function noise(dur, o = {}) {
    const c = ensure();
    if (!c || (!Store.data.sound && !o.dest)) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    const t = (o.at != null ? o.at : c.currentTime) + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.value = o.freq || 1000;
    const g = c.createGain();
    g.gain.setValueAtTime(o.vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(o.dest || sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // Pentatônica de Dó: 1=Dó, 2=Ré, 4=Mi, 8=Sol, 16=Lá
  const NOTE = { 1: 523.25, 2: 587.33, 4: 659.25, 8: 783.99, 16: 880.0 };

  const fx = {
    bitOn(v) {
      const f = NOTE[v] || 600;
      tone(f * 0.94, { type: 'square', to: f, dur: 0.07, vol: 0.09 });
      tone(f, { type: 'triangle', dur: 0.18, vol: 0.13, delay: 0.05 });
    },
    bitOff(v) {
      const f = (NOTE[v] || 600) / 2;
      tone(f, { type: 'triangle', to: f * 0.8, dur: 0.1, vol: 0.09 });
    },
    click() { tone(700, { type: 'triangle', dur: 0.05, vol: 0.08 }); },
    laser() {
      tone(1500, { type: 'sawtooth', to: 220, dur: 0.22, vol: 0.06 });
      tone(2200, { type: 'square', to: 600, dur: 0.12, vol: 0.03 });
    },
    boom() {
      noise(0.4, { freq: 900, vol: 0.28 });
      tone(140, { type: 'sine', to: 40, dur: 0.3, vol: 0.25 });
    },
    bounce() {
      tone(900, { type: 'square', to: 1400, dur: 0.07, vol: 0.07 });
      tone(320, { type: 'square', to: 140, dur: 0.22, vol: 0.07, delay: 0.08 });
    },
    wrong() {
      tone(330, { type: 'triangle', dur: 0.12, vol: 0.12 });
      tone(262, { type: 'triangle', dur: 0.2, vol: 0.12, delay: 0.12 });
    },
    shield() {
      tone(100, { type: 'sawtooth', to: 45, dur: 0.45, vol: 0.16 });
      noise(0.35, { freq: 500, vol: 0.22 });
    },
    overdrive() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { type: 'square', dur: 0.1, vol: 0.07, delay: i * 0.06 }));
    },
    empReady() {
      [784, 988, 1175].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.14, vol: 0.12, delay: i * 0.08 }));
    },
    emp() {
      tone(70, { type: 'sawtooth', to: 1800, dur: 0.5, vol: 0.08 });
      noise(0.8, { freq: 1400, vol: 0.32, delay: 0.35 });
      tone(90, { type: 'sine', to: 30, dur: 0.6, vol: 0.3, delay: 0.35 });
    },
    coin() {
      tone(988, { type: 'square', dur: 0.07, vol: 0.07 });
      tone(1319, { type: 'square', dur: 0.16, vol: 0.07, delay: 0.07 });
    },
    letter() {
      tone(1047, { type: 'triangle', dur: 0.1, vol: 0.12 });
      tone(1568, { type: 'triangle', dur: 0.16, vol: 0.1, delay: 0.06 });
    },
    word() {
      [659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, { type: 'square', dur: 0.1, vol: 0.07, delay: i * 0.07 }));
    },
    star(i) { tone(880 * Math.pow(1.26, i), { type: 'triangle', dur: 0.25, vol: 0.14 }); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'square', dur: 0.16, vol: 0.08, delay: i * 0.11 }));
      tone(1319, { type: 'triangle', dur: 0.5, vol: 0.12, delay: 0.46 });
    },
    lose() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.2, vol: 0.12, delay: i * 0.15 }));
    },
    tick() { tone(1200, { type: 'square', dur: 0.03, vol: 0.05 }); },
  };

  // ---------- Música chiptune (sequenciador simples) ----------
  // 4 acordes (Lá menor, Fá, Dó, Sol) de 16 passos cada; baixo, arpejo, bumbo e chimbal.
  const CHORDS = [
    { root: 110.0, arp: [440.0, 523.25, 659.25, 880.0] },
    { root: 87.31, arp: [349.23, 440.0, 523.25, 698.46] },
    { root: 130.81, arp: [523.25, 659.25, 783.99, 1046.5] },
    { root: 98.0, arp: [392.0, 493.88, 587.33, 783.99] },
  ];
  let timer = null, step = 0, next = 0, bpm = 110, mul = 1, hype = false;

  function playStep(s, t) {
    const chord = CHORDS[Math.floor(s / 16) % 4];
    const i = s % 16;
    const d = music;
    if (i % 4 === 0) {
      tone(150, { type: 'sine', to: 45, dur: 0.12, vol: 0.5, at: t, dest: d });
      tone(chord.root, { type: 'square', dur: 0.18, vol: 0.12, at: t, dest: d });
    }
    if (i % 4 === 2) {
      tone(chord.root * 2, { type: 'square', dur: 0.1, vol: 0.07, at: t, dest: d });
      noise(0.04, { freq: 7000, filter: 'highpass', vol: 0.12, at: t, dest: d });
    }
    if (i === 4 || i === 12) noise(0.12, { freq: 2000, filter: 'bandpass', vol: 0.22, at: t, dest: d });
    if (i % 2 === 0 || hype) {
      const n = chord.arp[(i >> (hype ? 0 : 1)) % 4] * (hype ? 2 : 1);
      tone(n, { type: hype ? 'square' : 'triangle', dur: 0.09, vol: hype ? 0.035 : 0.06, at: t, dest: d });
    }
  }
  function schedule() {
    if (!ctx) return;
    while (next < ctx.currentTime + 0.12) {
      playStep(step, next);
      next += 60 / (bpm * mul) / 4;
      step = (step + 1) % 64;
    }
  }
  function startMusic(tempo = 110) {
    const c = ensure();
    if (!c) return;
    stopMusic();
    bpm = tempo; mul = 1; hype = false; step = 0;
    next = c.currentTime + 0.05;
    timer = setInterval(schedule, 25);
  }
  function stopMusic() {
    if (timer) clearInterval(timer);
    timer = null;
  }
  function setOverdrive(on) { hype = on; mul = on ? 1.18 : 1; }
  function setTempo(t) { bpm = t; }

  // Primeiro toque destrava o áudio (regra dos navegadores de celular).
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, ensure, { once: true, passive: true }));

  return Object.assign(fx, { apply, startMusic, stopMusic, setOverdrive, setTempo, ensure });
})();

// Vibração curta (haptic feedback), quando o aparelho permite.
function buzz(ms = 12) {
  if (!Store.data.vibe) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* sem vibração */ }
}
