// Sons e música gerados pelo próprio navegador (Web Audio), sem arquivos de áudio.
//
// Cadeia de mixagem: efeitos (sfx) + música -> reverb leve -> compressor -> saída.
// Cada bit toca uma nota da escala pentatônica do tom da música que está tocando
// (então montar um número sempre soa afinado), e sai do lado do fone em que o botão está:
// o 16 à esquerda, o 1 à direita.
//
// Música: sequenciador em semicolcheias com bateria, baixo, acordes (pad), arpejo e melodia.
// Cada setor tem um clima (manhã calma, tarde animada, pôr do sol em tom menor, chefes tensos);
// o Overdrive acelera e dá brilho, e a "tensão" (meteoro perto do escudo) deixa a bateria mais intensa.
const Sound = (() => {
  'use strict';
  let ctx = null, master = null, comp = null, sfx = null, music = null, verb = null, verbSend = null;
  let noiseBuf = null;

  // ---------- Criação da cadeia de áudio ----------
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 4;
      comp.attack.value = 0.004; comp.release.value = 0.2;
      master = ctx.createGain();
      master.gain.value = 1.6;
      // limitador final: segura os picos para não distorcer no alto-falante do celular
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20;
      limiter.attack.value = 0.001; limiter.release.value = 0.08;
      comp.connect(master).connect(limiter).connect(ctx.destination);

      // reverb: resposta de impulso gerada (ruído que decai), em estéreo
      verb = ctx.createConvolver();
      verb.buffer = impulse(1.8, 2.6);
      verbSend = ctx.createGain();
      verbSend.gain.value = 0.22;
      verbSend.connect(verb).connect(comp);

      sfx = ctx.createGain();
      sfx.connect(comp);
      sfx.connect(verbSend);
      music = ctx.createGain();
      music.connect(comp);
      const mSend = ctx.createGain(); mSend.gain.value = 0.6;
      music.connect(mSend).connect(verbSend);

      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      apply();
    }
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
    if (want && !timer) begin();
    return ctx;
  }

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfx.gain.setTargetAtTime(Store.data.sound ? 1.5 : 0, t, 0.02);
    music.gain.setTargetAtTime(Store.data.music ? 0.85 : 0, t, 0.05);
  }

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- Blocos de síntese ----------
  function panNode(pan, dest) {
    if (!pan || !ctx.createStereoPanner) return dest;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(dest);
    return p;
  }

  // nota com envelope ADSR simples e filtro passa-baixa opcional
  function voice(o) {
    const t = o.at;
    const dur = o.dur || 0.2;
    const out = ctx.createGain();
    const peak = o.vol || 0.1;
    const a = o.attack || 0.005, r = o.release || 0.12;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + a);
    if (o.sustain != null) {
      out.gain.setTargetAtTime(peak * o.sustain, t + a, (o.decay || 0.1) / 3);
      out.gain.setValueAtTime(peak * o.sustain, t + dur);
    }
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    let node = out;
    if (o.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = o.q || 0.8;
      f.frequency.setValueAtTime(o.cutoff, t);
      if (o.cutoffTo) f.frequency.exponentialRampToValueAtTime(o.cutoffTo, t + (o.sweep || dur));
      out.connect(f);
      node = f;
    }
    node.connect(panNode(o.pan, o.dest));
    (o.detune || [0]).forEach((cents) => {
      const osc = ctx.createOscillator();
      osc.type = o.type || 'triangle';
      osc.frequency.setValueAtTime(o.freq, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
      osc.detune.value = cents;
      if (o.vibrato) {
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 5.5; lg.gain.value = o.vibrato;
        lfo.connect(lg).connect(osc.detune);
        lfo.start(t + 0.08); lfo.stop(t + dur + r + 0.05);
      }
      osc.connect(out);
      osc.start(t);
      osc.stop(t + dur + r + 0.05);
    });
  }

  // sino/plim (síntese FM): bom para moedas, estrelas e acertos
  function bell(freq, at, vol, dest, pan, ratio = 3.5, len = 0.6) {
    const car = ctx.createOscillator(), mod = ctx.createOscillator();
    const mg = ctx.createGain(), out = ctx.createGain();
    car.frequency.value = freq; mod.frequency.value = freq * ratio;
    mg.gain.setValueAtTime(freq * 2.2, at);
    mg.gain.exponentialRampToValueAtTime(freq * 0.05, at + len);
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(vol, at + 0.005);
    out.gain.exponentialRampToValueAtTime(0.0001, at + len);
    mod.connect(mg).connect(car.frequency);
    car.connect(out).connect(panNode(pan, dest));
    car.start(at); mod.start(at);
    car.stop(at + len + 0.05); mod.stop(at + len + 0.05);
  }

  function noise(o) {
    const t = o.at, dur = o.dur || 0.2;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.Q.value = o.q || 0.7;
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(panNode(o.pan, o.dest));
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  // ---------- Tom atual (as notas dos bits seguem a música) ----------
  let keyRoot = 60, keyMinor = false;
  const BIT_DEG = { 1: 0, 2: 1, 4: 2, 8: 3, 16: 4 };
  const BIT_PAN = { 16: -0.6, 8: -0.3, 4: 0, 2: 0.3, 1: 0.6 };
  const pent = () => (keyMinor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]);
  const bitMidi = (v) => keyRoot + 12 + pent()[BIT_DEG[v] || 0];

  const ok = () => ensure() && Store.data.sound;
  const now = () => ctx.currentTime;

  // ---------- Efeitos sonoros ----------
  const fx = {
    bitOn(v) {
      if (!ok()) return;
      const f = mtof(bitMidi(v)), t = now(), pan = BIT_PAN[v] || 0;
      voice({ at: t, freq: f, type: 'triangle', dur: 0.05, release: 0.35, vol: 0.16, pan, dest: sfx, cutoff: 5000, cutoffTo: 1500, sweep: 0.3 });
      voice({ at: t, freq: f * 2, type: 'sine', dur: 0.02, release: 0.18, vol: 0.05, pan, dest: sfx });
      noise({ at: t, dur: 0.03, freq: 6000, filter: 'highpass', vol: 0.05, pan, dest: sfx });
    },
    bitOff(v) {
      if (!ok()) return;
      const f = mtof(bitMidi(v) - 12), t = now();
      voice({ at: t, freq: f * 1.06, to: f * 0.94, glide: 0.08, type: 'sine', dur: 0.04, release: 0.1, vol: 0.12, pan: BIT_PAN[v] || 0, dest: sfx });
    },
    click() {
      if (!ok()) return;
      voice({ at: now(), freq: 1800, type: 'sine', dur: 0.008, release: 0.03, vol: 0.06, dest: sfx });
    },
    laser() {
      if (!ok()) return;
      const t = now();
      voice({ at: t, freq: 1900, to: 260, glide: 0.18, type: 'sawtooth', dur: 0.12, release: 0.08, vol: 0.07, dest: sfx, cutoff: 6000, cutoffTo: 900, sweep: 0.18 });
      voice({ at: t, freq: 1300, to: 400, glide: 0.12, type: 'square', dur: 0.06, release: 0.05, vol: 0.03, dest: sfx, detune: [-12, 12] });
      noise({ at: t, dur: 0.1, freq: 4000, filter: 'bandpass', q: 1.5, vol: 0.06, dest: sfx });
    },
    boom() {
      if (!ok()) return;
      const t = now();
      voice({ at: t, freq: 160, to: 38, glide: 0.35, type: 'sine', dur: 0.15, release: 0.3, vol: 0.4, dest: sfx });
      noise({ at: t, dur: 0.55, freq: 3500, freqTo: 180, vol: 0.32, dest: sfx });
      noise({ at: t + 0.02, dur: 0.25, freq: 900, filter: 'bandpass', vol: 0.12, pan: 0.3, dest: sfx });
      bell(mtof(bitMidi(1) + 12), t + 0.03, 0.05, sfx, 0, 2, 0.4);   // brilhinho de acerto, no tom da música
    },
    bounce() {
      if (!ok()) return;
      const t = now();
      voice({ at: t, freq: 700, to: 1300, glide: 0.06, type: 'triangle', dur: 0.05, release: 0.06, vol: 0.1, dest: sfx });
      voice({ at: t + 0.07, freq: 520, to: 180, glide: 0.25, type: 'triangle', dur: 0.12, release: 0.15, vol: 0.1, vibrato: 60, dest: sfx });
    },
    wrong() {
      if (!ok()) return;
      const t = now();
      voice({ at: t, freq: mtof(64), type: 'triangle', dur: 0.08, release: 0.1, vol: 0.12, dest: sfx, cutoff: 2000 });
      voice({ at: t + 0.11, freq: mtof(60), type: 'triangle', dur: 0.12, release: 0.2, vol: 0.12, dest: sfx, cutoff: 1500 });
    },
    shield() {
      if (!ok()) return;
      const t = now();
      voice({ at: t, freq: 110, to: 40, glide: 0.45, type: 'sawtooth', dur: 0.25, release: 0.3, vol: 0.18, dest: sfx, cutoff: 900, cutoffTo: 120, sweep: 0.5 });
      noise({ at: t, dur: 0.4, freq: 1800, freqTo: 200, vol: 0.28, dest: sfx });
      for (let i = 0; i < 4; i++) noise({ at: t + 0.05 + i * 0.05, dur: 0.04, freq: 5000, filter: 'highpass', vol: 0.06, pan: (i % 2 ? 0.5 : -0.5), dest: sfx });
    },
    overdrive() {
      if (!ok()) return;
      const t = now();
      [0, 2, 4, 7, 9, 12].forEach((d, i) => bell(mtof(keyRoot + 12 + d), t + i * 0.055, 0.06, sfx, -0.6 + i * 0.24, 3, 0.5));
      noise({ at: t, dur: 0.5, freq: 1500, freqTo: 9000, filter: 'bandpass', vol: 0.06, attack: 0.3, dest: sfx });
    },
    empReady() {
      if (!ok()) return;
      const t = now();
      [7, 12, 16].forEach((d, i) => bell(mtof(keyRoot + 12 + d), t + i * 0.09, 0.08, sfx, 0, 2, 0.7));
    },
    emp() {
      if (!ok()) return;
      const t = now();
      noise({ at: t, dur: 0.45, freq: 300, freqTo: 6000, filter: 'bandpass', q: 2, vol: 0.18, attack: 0.35, dest: sfx });
      voice({ at: t, freq: 60, to: 900, glide: 0.4, type: 'sawtooth', dur: 0.4, release: 0.05, vol: 0.06, dest: sfx, cutoff: 3000 });
      voice({ at: t + 0.4, freq: 120, to: 28, glide: 0.7, type: 'sine', dur: 0.2, release: 0.6, vol: 0.45, dest: sfx });
      noise({ at: t + 0.4, dur: 1.2, freq: 4000, freqTo: 120, vol: 0.35, dest: sfx });
    },
    coin() {
      if (!ok()) return;
      const t = now();
      bell(mtof(83), t, 0.08, sfx, 0, 2, 0.25);
      bell(mtof(88), t + 0.08, 0.09, sfx, 0, 2, 0.6);
    },
    letter() {
      if (!ok()) return;
      const t = now();
      bell(mtof(keyRoot + 24), t, 0.08, sfx, -0.2, 3, 0.5);
      bell(mtof(keyRoot + 24 + pent()[2]), t + 0.07, 0.08, sfx, 0.2, 3, 0.6);
    },
    word() {
      if (!ok()) return;
      const t = now();
      [0, 2, 4, 7, 4, 7, 12].forEach((d, i) => bell(mtof(keyRoot + 12 + d), t + i * 0.08, 0.07, sfx, (i % 2 ? 0.3 : -0.3), 3, 0.5));
    },
    star(i) {
      if (!ok()) return;
      bell(mtof(76 + [0, 4, 7][i % 3]), now(), 0.12, sfx, (i - 1) * 0.5, 3.5, 1.1);
    },
    win() {
      if (!ok()) return;
      const t = now();
      [[60, 0], [64, 0.12], [67, 0.24], [72, 0.36]].forEach(([m, d]) => voice({ at: t + d, freq: mtof(m), type: 'square', dur: 0.1, release: 0.15, vol: 0.06, dest: sfx, cutoff: 3000, detune: [-6, 6] }));
      [60, 64, 67, 72, 76].forEach((m) => voice({ at: t + 0.5, freq: mtof(m), type: 'sawtooth', dur: 0.5, release: 0.9, vol: 0.035, dest: sfx, cutoff: 2600, cutoffTo: 900, sweep: 1.2, detune: [-8, 8], attack: 0.02 }));
      bell(mtof(84), t + 0.5, 0.08, sfx, 0, 3.5, 1.4);
    },
    lose() {
      if (!ok()) return;
      const t = now();
      [67, 65, 63, 60].forEach((m, i) => voice({ at: t + i * 0.17, freq: mtof(m), type: 'triangle', dur: 0.12, release: 0.25, vol: 0.12, dest: sfx, cutoff: 1800, vibrato: i === 3 ? 25 : 0 }));
    },
    tick() {
      if (!ok()) return;
      voice({ at: now(), freq: 2400, type: 'sine', dur: 0.01, release: 0.04, vol: 0.07, dest: sfx });
      noise({ at: now(), dur: 0.02, freq: 7000, filter: 'highpass', vol: 0.05, dest: sfx });
    },
  };

  // ---------- Música ----------
  // Climas: tom, andamento, progressão de acordes (grau em semitons + maior/menor) e camadas.
  const MOODS = {
    menu:   { root: 60, minor: false, bpm: 84, prog: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']], drums: 0, bass: 0.6, lead: 0, arp: 1, swing: 0.08 },
    calm:   { root: 60, minor: false, bpm: 94, prog: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']], drums: 1, bass: 1, lead: 0.5, arp: 1, swing: 0.06 },
    bright: { root: 55, minor: false, bpm: 108, prog: [[0, 'M'], [5, 'M'], [9, 'm'], [7, 'M']], drums: 2, bass: 1, lead: 1, arp: 1, swing: 0.04 },
    sunset: { root: 57, minor: true, bpm: 112, prog: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], drums: 2, bass: 1, lead: 1, arp: 1, swing: 0.03 },
    boss:   { root: 62, minor: true, bpm: 124, prog: [[0, 'm'], [8, 'M'], [10, 'M'], [7, 'm']], drums: 3, bass: 2, lead: 1, arp: 1, swing: 0 },
    flash:  { root: 60, minor: false, bpm: 132, prog: [[0, 'M'], [5, 'M'], [7, 'M'], [9, 'm']], drums: 3, bass: 2, lead: 1, arp: 1, swing: 0 },
  };
  let want = null, mood = MOODS.menu, moodName = '', timer = null, step = 0, next = 0, hype = false, tension = 0, melody = [];

  // melodia de 8 compassos gerada a partir da escala pentatônica, com frases que se repetem
  function makeMelody(m) {
    let seed = 1234 + m.root * 7 + m.bpm;
    const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const scale = m.minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
    const RHYTHMS = [[0, 4, 6, 8, 12], [0, 3, 6, 10, 12, 14], [0, 2, 4, 8, 10], [0, 6, 8, 11, 12], [2, 4, 8, 12, 14]];
    const phrase = [];
    let deg = 2;
    for (let bar = 0; bar < 4; bar++) {
      const rhythm = RHYTHMS[Math.floor(R() * RHYTHMS.length)];
      rhythm.forEach((s, i) => {
        deg = Math.max(0, Math.min(9, deg + [-2, -1, -1, 0, 1, 1, 2][Math.floor(R() * 7)]));
        const oct = Math.floor(deg / 5), d = scale[deg % 5] + 12 * oct;
        const len = (rhythm[i + 1] != null ? rhythm[i + 1] : 16) - s;
        phrase.push({ bar, step: s, note: m.root + 12 + d, len: Math.min(len, 4) });
      });
    }
    // compassos 5-8: repete a frase, terminando na tônica
    const out = phrase.concat(phrase.map((n) => Object.assign({}, n, { bar: n.bar + 4 })));
    const last = out[out.length - 1];
    last.note = m.root + 12; last.len = 4;
    return out;
  }

  function chordNotes(bar) {
    const [deg, q] = mood.prog[bar % mood.prog.length];
    const r = mood.root + deg;
    return [r, r + (q === 'm' ? 3 : 4), r + 7];
  }

  function playStep(s, t) {
    const d = music;
    const i = s % 16, bar = Math.floor(s / 16);
    const sp = 60 / (mood.bpm * (hype ? 1.1 : 1)) / 4;     // duração de uma semicolcheia
    const ch = chordNotes(bar);
    const lvl = mood.drums + (tension > 0.65 ? 1 : 0);

    // acordes (pad) no começo do compasso
    if (i === 0) {
      ch.forEach((n, k) => voice({ at: t, freq: mtof(n), type: 'sawtooth', dur: sp * 14, attack: 0.35, sustain: 0.75, decay: 0.6, release: 0.8, vol: 0.022, dest: d, cutoff: hype ? 2600 : 1300, q: 0.5, detune: [-9, 9], pan: (k - 1) * 0.35 }));
    }
    // baixo
    if (mood.bass) {
      const pattern = mood.bass > 1 ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 6, 8, 14];
      if (pattern.includes(i)) {
        const n = ch[0] - 24 + (mood.bass > 1 && i % 4 === 2 ? 12 : 0);
        voice({ at: t, freq: mtof(n), type: 'sawtooth', dur: sp * 1.4, release: 0.08, vol: 0.09, dest: d, cutoff: 1200, cutoffTo: 220, sweep: sp * 1.6, q: 2 });
        voice({ at: t, freq: mtof(n), type: 'sine', dur: sp * 1.4, release: 0.08, vol: 0.12, dest: d });
      }
    }
    // arpejo (sinos)
    if (mood.arp) {
      const every = hype ? 1 : 2;
      if (i % every === 0) {
        const k = (i / every) % 4;
        const n = (k === 3 ? ch[1] + 12 : ch[k]) + 12;
        bell(mtof(n), t, moodName === 'menu' ? 0.03 : 0.022, d, k % 2 ? 0.45 : -0.45, 4, sp * 3);
      }
    }
    // bateria
    if (lvl >= 1) {
      const kick = lvl >= 3 ? i % 4 === 0 : lvl === 2 ? (i === 0 || i === 6 || i === 8 || i === 11) : (i === 0 || i === 8);
      if (kick) {
        voice({ at: t, freq: 150, to: 42, glide: 0.12, type: 'sine', dur: 0.06, release: 0.18, vol: 0.5, dest: d });
        noise({ at: t, dur: 0.02, freq: 3000, vol: 0.05, dest: d });
      }
      if (lvl >= 2 && (i === 4 || i === 12)) {
        noise({ at: t, dur: 0.16, freq: 1900, filter: 'bandpass', q: 0.9, vol: 0.2, dest: d });
        voice({ at: t, freq: 210, to: 160, glide: 0.06, type: 'triangle', dur: 0.03, release: 0.08, vol: 0.12, dest: d });
      }
      const hatEvery = lvl >= 3 || hype ? 1 : 2;
      if (i % hatEvery === 0) {
        const open = i % 4 === 2 && lvl >= 2;
        noise({ at: t, dur: open ? 0.12 : 0.03, freq: 8500, filter: 'highpass', vol: (i % 4 === 0 ? 0.05 : 0.035) * (open ? 1.3 : 1), pan: 0.25, dest: d });
      }
    }
    // melodia
    if (mood.lead && (hype || mood.lead >= 1 || bar % 8 >= 4)) {
      melody.forEach((n) => {
        if (n.bar === bar % 8 && n.step === i) {
          voice({ at: t, freq: mtof(n.note + (hype ? 12 : 0)), type: hype ? 'square' : 'triangle', dur: sp * n.len * 0.85, attack: 0.01, sustain: 0.6, decay: 0.15, release: 0.12, vol: hype ? 0.03 : 0.06, dest: d, cutoff: 3200, vibrato: 12, detune: hype ? [-7, 7] : [0] });
        }
      });
    }
  }

  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    if (next < ctx.currentTime - 0.05) next = ctx.currentTime + 0.05;   // aba voltou do fundo: não toca tudo atrasado
    while (next < ctx.currentTime + 0.14) {
      const sp = 60 / (mood.bpm * (hype ? 1.1 : 1)) / 4;
      const swing = step % 2 ? sp * mood.swing : 0;
      playStep(step, next + swing);
      next += sp;
      step = (step + 1) % 128;
    }
  }

  function begin() {
    if (timer) clearInterval(timer);
    step = 0;
    next = ctx.currentTime + 0.08;
    timer = setInterval(schedule, 25);
  }

  // style: 'menu' | 'calm' | 'bright' | 'sunset' | 'boss' | 'flash'
  function startMusic(style = 'calm') {
    if (!MOODS[style]) style = 'calm';
    if (style === moodName && timer) return;
    moodName = style;
    mood = MOODS[style];
    keyRoot = mood.root; keyMinor = mood.minor;
    melody = makeMelody(mood);
    hype = false; tension = 0;
    want = style;
    if (ctx) { stopTimer(); begin(); }
  }
  // tom das notas dos bits sem tocar música (durante as partidas só há efeitos sonoros)
  function setKey(style) {
    const m = MOODS[style] || MOODS.calm;
    keyRoot = m.root; keyMinor = m.minor;
  }
  function stopTimer() { if (timer) clearInterval(timer); timer = null; }
  function stopMusic() { want = null; moodName = ''; stopTimer(); }
  function setOverdrive(on) { hype = !!on; }
  function setTension(v) { tension = v; }

  // Primeiro toque destrava o áudio (regra dos navegadores de celular).
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, ensure, { passive: true }));
  // Aba escondida: pausa o áudio todo.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return Object.assign(fx, { apply, startMusic, stopMusic, setKey, setOverdrive, setTension, ensure, setTempo() {} });
})();

// Vibração curta (haptic feedback), quando o aparelho permite.
function buzz(ms = 12) {
  if (!Store.data.vibe) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* sem vibração */ }
}
