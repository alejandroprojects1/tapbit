// Motor do jogo: campo de batalha (canvas), Painel de Bits, combo, Overdrive e Pulso PEM.
// Três tipos de fase:
//   build   - um número desce e o jogador liga os bits que somam o valor (Setores 1 e 2, Relâmpago)
//   decode  - o drone mostra um código binário e o jogador escolhe o número (Setor 3)
//   letters - o chefe mostra o binário de cada letra de uma palavra (Setor 4)
const Game = (() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('play');
  const ctx = canvas.getContext('2d');
  const field = $('field');
  const screen = $('game');
  const VALUES = [16, 8, 4, 2, 1];
  const FONT = 'Fredoka, "Trebuchet MS", sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, monospace';

  let W = 0, H = 0, DPR = 1;
  let L = null, st = null, raf = 0, last = 0, T = 0, onEnd = null;
  let sky = [], city = [];

  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rand(a.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const popcount = (v) => v.toString(2).replace(/0/g, '').length;
  const toBin = (v, n = 5) => v.toString(2).padStart(n, '0');
  const partsOf = (v) => VALUES.filter((b) => v & b);
  const LETTER = (n) => String.fromCharCode(64 + n);
  const NUM = (ch) => ch.charCodeAt(0) - 64;

  // ---------- Medidas do campo ----------
  function resize() {
    const r = field.getBoundingClientRect();
    if (!r.width || !r.height) return;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildCity();
  }
  window.addEventListener('resize', () => { if (screen.classList.contains('active')) resize(); });

  function buildCity() {
    city = [];
    let x = -6;
    const cols = ['#1d2458', '#242c6a', '#1a2050', '#2b2f74', '#1f2a5e'];
    while (x < W + 10) {
      const w = 18 + rand(26);
      const h = 18 + rand(42);
      const win = [];
      for (let i = 0; i < 12; i++) win.push(Math.random());
      city.push({ x, w, h, c: pick(cols), win, chip: Math.random() < 0.35 });
      x += w + 3 + rand(5);
    }
    if (!sky.length) for (let i = 0; i < 70; i++) sky.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.9 });
  }
  const ground = () => H - 12;
  const shieldY = (x) => { const k = (x - W / 2) / (W / 2); return H - 86 - 30 * (1 - k * k); };
  const cannonPos = () => ({ x: W / 2, y: H - 80 });
  const bossX = () => (L && L.kind === 'letters' ? (W - 86) / 2 : W / 2);

  // ---------- Painel / DOM ----------
  const els = {
    bits: $('bits'), options: $('options'), bin: $('bin'), sum: $('sum'), readout: $('readout'),
    fire: $('btn-fire'), clear: $('btn-clear'), emp: $('btn-emp'), empCount: $('emp-count'),
    score: $('hud-score'), prog: $('hud-prog'), progFill: $('hud-prog-fill'), shield: $('hud-shield'),
    title: $('hud-title'), pips: $('pips'), comboLabel: $('combo-label'), toast: $('toast'), banner: $('banner'),
    word: $('word'), abc: $('abc'),
  };

  const BOLT = '<svg viewBox="0 0 24 24" class="i-on"><path d="M13.5 2 4 13.5h6.5L9 22l10-12h-6.6z"/></svg>';
  const BATT = '<svg viewBox="0 0 24 24" class="i-off"><path d="M9 2h6v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2zm-2 4v14h10V6z"/></svg>';

  function buildPanel() {
    els.bits.innerHTML = '';
    const isBuild = L.kind === 'build';
    els.bits.classList.toggle('hidden', !isBuild);
    els.readout.classList.toggle('hidden', !isBuild);
    els.options.classList.toggle('hidden', isBuild);
    els.clear.classList.toggle('hidden', !isBuild);
    els.fire.classList.toggle('hidden', !(isBuild && Store.data.mode === 'desafio'));
    els.emp.classList.toggle('hidden', L.sector === 1);
    els.word.classList.toggle('hidden', L.kind !== 'letters');
    els.abc.classList.toggle('hidden', L.kind !== 'letters');
    if (!isBuild) return;
    VALUES.forEach((v, i) => {
      const b = document.createElement('button');
      const locked = L.bits === 4 && v === 16;
      b.className = 'bit' + (locked ? ' locked' : '');
      b.dataset.v = v;
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', locked ? 'Bit 16 bloqueado' : 'Bit ' + v);
      b.innerHTML = locked
        ? '<span class="val">16</span><span class="lock">🔒</span><span class="digit">0</span>'
        : `<span class="val">${v}</span><span class="ico">${BOLT}${BATT}</span><span class="digit">0</span><kbd>${i + 1}</kbd>`;
      if (locked) b.disabled = true;
      else b.addEventListener('pointerdown', (e) => { e.preventDefault(); toggle(v); });
      els.bits.appendChild(b);
    });
  }

  function updatePanel() {
    if (L.kind !== 'build') return;
    const n = L.bits;
    els.bits.querySelectorAll('.bit').forEach((b) => {
      const v = +b.dataset.v;
      const on = !!(st.bits & v);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
      b.querySelector('.digit').textContent = on ? '1' : '0';
    });
    els.bin.innerHTML = toBin(st.bits, n).split('').map((d) => `<i class="${d === '1' ? 'b1' : ''}">${d}</i>`).join('');
    const target = L.showSum ? alive().find((t) => !t.targeted) : null;
    els.sum.classList.toggle('hidden', !L.showSum);
    els.sum.classList.toggle('over', !!(target && st.bits > target.value));
    els.sum.innerHTML = `= ${st.bits}` + (target && st.bits > target.value ? ' <small>passou!</small>' : '');
  }

  function flashPanel(cls) {
    els.bits.classList.remove('fired', 'nope');
    void els.bits.offsetWidth;
    els.bits.classList.add(cls);
  }

  function renderOptions(list, cb, labelFn = (x) => x) {
    els.options.innerHTML = '';
    els.options.className = 'options n' + list.length;
    list.forEach((val, i) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = `<b>${labelFn(val)}</b><kbd>${i + 1}</kbd>`;
      b.dataset.val = val;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!b.disabled) cb(val, b); });
      els.options.appendChild(b);
    });
  }
  const lockOptions = (on) => els.options.querySelectorAll('.opt').forEach((b) => { if (on) b.disabled = true; });

  let toastTimer = 0;
  function toast(main, sub = '', cls = '') {
    els.toast.className = 'toast show ' + cls;
    els.toast.innerHTML = `<div>${main}</div>${sub ? `<small>${sub}</small>` : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.className = 'toast'; }, 2600);
  }
  function banner(text, cls = '') {
    els.banner.className = 'banner';
    void els.banner.offsetWidth;
    els.banner.textContent = text;
    els.banner.className = 'banner show ' + cls;
  }

  function updateHud() {
    els.score.textContent = st.score.toLocaleString('pt-BR');
    if (L.duration) {
      const s = Math.max(0, Math.ceil(st.timeLeft));
      els.prog.textContent = `⏱ ${s}s`;
      els.progFill.style.width = (100 * st.timeLeft / L.duration) + '%';
    } else {
      els.prog.textContent = `${st.done}/${L.count}`;
      els.progFill.style.width = (100 * st.done / L.count) + '%';
    }
    els.shield.innerHTML = '';
    if (st.maxShield) {
      for (let i = 0; i < st.maxShield; i++) {
        const s = document.createElement('i');
        if (i >= st.shield) s.className = 'off';
        els.shield.appendChild(s);
      }
    }
    els.pips.querySelectorAll('i').forEach((p, i) => p.classList.toggle('on', st.overdrive || i < st.streak));
    els.comboLabel.textContent = st.streak > 1 ? `COMBO ×${st.streak}` : 'COMBO';
    screen.classList.toggle('od', st.overdrive);
    els.emp.disabled = !st.emp;
    els.empCount.textContent = st.emp;
    els.emp.classList.toggle('ready', st.emp > 0);
  }

  // ---------- Começar ----------
  function start(level, cb) {
    L = level;
    onEnd = cb;
    st = {
      uid: 0, bits: 0, threats: [], beams: [], parts: [], floats: [], rings: [],
      spawned: 0, done: 0, hits: 0, errors: 0, misses: 0, taps: 0, tapMin: 0, tapUsed: 0,
      shield: L.shield || 0, maxShield: L.shield || 0, score: 0, streak: 0, best: 0, overdrive: false,
      emp: 0, spawnTimer: 0.6, timeLeft: L.duration || 0, ended: false, paused: false,
      shake: 0, aim: -Math.PI / 2, lastV: -1, wait: 0, tick: 0, robotMood: 'happy', moodT: 0,
    };
    els.title.textContent = L.sector ? `Setor ${L.id} · ${L.name}` : L.name;
    buildPanel();
    resize();
    if (L.kind === 'letters') setupLetters();
    updatePanel();
    updateHud();
    els.toast.className = 'toast';
    if (L.rule) banner('⚡ ' + L.rule.name, 'gold');
    else banner(L.name);
    if (L.rule) setTimeout(() => { if (st && !st.ended) toast(L.rule.hint, '', 'info'); }, 900);
    Sound.startMusic(L.sector ? 100 + L.sector * 6 + L.index * 3 : 128);
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    Sound.stopMusic();
    Sound.setOverdrive(false);
    screen.classList.remove('od');
    st = null;
  }

  function pause(on) {
    if (!st || st.ended) return;
    st.paused = on;
    if (on) Sound.stopMusic();
    else { Sound.startMusic(L.sector ? 100 + L.sector * 6 + L.index * 3 : 128); Sound.setOverdrive(st.overdrive); last = performance.now(); }
  }

  const alive = () => st.threats.filter((t) => !t.dead);

  // ---------- Fases de montar números (build) ----------
  function nextValue() {
    let v, guard = 0;
    do { v = pick(L.pool); guard++; }
    while (guard < 30 && L.pool.length > 2 && (v === st.lastV || st.threats.some((t) => !t.dead && t.value === v)));
    st.lastV = v;
    return v;
  }

  function makeRock() {
    const a = []; for (let i = 0; i < 11; i++) a.push(0.86 + Math.random() * 0.18);
    const cr = []; for (let i = 0; i < 3; i++) cr.push({ a: Math.random() * 6.28, d: 0.2 + Math.random() * 0.4, r: 0.12 + Math.random() * 0.12 });
    return { a, cr };
  }

  function spawn() {
    const v = L.kind === 'decode' ? nextValue() : nextValue();
    const lanes = (L.max || 1) > 1 ? [0.2, 0.5, 0.8] : [0.5];
    const used = alive().map((t) => t.lane);
    const free = lanes.filter((l) => !used.includes(l));
    const lane = free.length ? pick(free) : 0.5;
    const t = {
      id: ++st.uid, value: v, lane, x: lane, p: 0, float: !L.fall,
      y: -60, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.8,
      flash: 0, targeted: false, dead: false, dieIn: -1, born: T,
    };
    if (L.kind === 'decode') {
      t.type = 'drone';
      t.code = toBin(v, L.bits);
      t.r = 40;
      const opts = decoys(v, 2, Math.pow(2, L.bits) - 1);
      opts.push(v);
      t.options = shuffle(opts);
      renderOptions(t.options, answerDecode);
    } else {
      t.type = 'meteor';
      t.r = L.fall ? 31 : 42;
      t.shape = makeRock();
    }
    st.threats.push(t);
    st.spawned++;
    st.taps = 0;
    updatePanel();
  }

  function decoys(v, n, max, min = 1) {
    const bits = L.bits || 5;
    const out = [];
    const add = (c) => { if (c >= min && c <= max && c !== v && !out.includes(c)) out.push(c); };
    // erro comum: ler o código de trás para frente
    if (Math.random() < 0.6) add(parseInt(toBin(v, bits).split('').reverse().join(''), 2));
    const near = [];
    for (let k = 0; k < bits; k++) near.push(v ^ (1 << k));   // um bit trocado
    near.push(v + 1, v - 1);
    shuffle(near).forEach(add);
    while (out.length < n) add(min + rand(max - min + 1));
    return out.slice(0, n);
  }

  function toggle(v) {
    if (!st || st.ended || st.paused || L.kind !== 'build') return;
    if (L.bits === 4 && v === 16) return;
    st.bits ^= v;
    st.taps++;
    if (st.bits & v) { Sound.bitOn(v); buzz(12); } else Sound.bitOff(v);
    updatePanel();
    if (Store.data.mode !== 'desafio') {
      const t = matching(st.bits);
      if (t) hitBuild(t);
    }
  }

  function matching(sum) {
    if (!sum) return null;
    return alive().filter((t) => !t.targeted && t.value === sum).sort((a, b) => b.p - a.p)[0] || null;
  }

  function fire() {
    if (!st || st.ended || st.paused || L.kind !== 'build') return;
    if (!st.bits) { toast('Ligue alguns bits primeiro! ⚡', '', 'info'); Sound.wrong(); return; }
    const t = matching(st.bits);
    if (t) { hitBuild(t); return; }
    const target = alive().filter((x) => !x.targeted).sort((a, b) => b.p - a.p)[0];
    if (!target) return;
    st.errors++;
    breakStreak();
    bounceBeam(target);
    const diff = st.bits - target.value;
    toast(`Você enviou <b>${st.bits}</b>, o alvo era <b>${target.value}</b>`,
      diff > 0 ? `Passou ${diff} ⬆` : `Faltou ${-diff} ⬇`, 'bad');
    flashPanel('nope');
    updateHud();
  }

  function clearBits() {
    if (!st || st.ended || L.kind !== 'build' || !st.bits) return;
    st.bits = 0;
    Sound.bitOff(1);
    updatePanel();
  }

  function points(t) {
    let p = L.fall ? 100 + Math.round(60 * (1 - t.p)) : (L.duration ? 100 : 50);
    if (st.overdrive) p *= 2;
    return p;
  }

  function hitBuild(t) {
    const min = popcount(t.value);
    st.tapMin += min;
    st.tapUsed += Math.max(min, st.taps);
    st.taps = 0;
    st.bits = 0;
    flashPanel('fired');
    destroy(t, true);
    Missions.track('hit', { kind: 'build', value: t.value });
    updatePanel();
  }

  // acerto comum a todos os modos
  function destroy(t, byPlayer) {
    t.targeted = true;
    t.dieIn = 0.14;
    const p = pos(t);
    shootBeam(p.x, p.y);
    st.hits++;
    st.done++;
    const pts = points(t);
    st.score += pts;
    st.floats.push({ x: p.x, y: p.y - t.r - 6, text: '+' + pts, c: st.overdrive ? '#ffd23f' : '#3dff9e', life: 1 });
    if (byPlayer) streakUp();
    mood('cheer');
    updateHud();
  }

  function streakUp() {
    st.streak++;
    st.best = Math.max(st.best, st.streak);
    Missions.track('combo', { streak: st.streak });
    if (st.streak === 3 && !st.overdrive) {
      st.overdrive = true;
      Sound.overdrive();
      Sound.setOverdrive(true);
      banner('OVERDRIVE! ×2', 'gold');
    }
    if (st.streak % 5 === 0 && L.sector !== 1) {
      if (st.emp < 3) {
        st.emp++;
        setTimeout(() => { if (st && !st.ended) { banner('💥 PULSO PEM +1', 'emp'); Sound.empReady(); } }, 500);
      }
    }
  }

  function breakStreak() {
    if (st.overdrive) { Sound.setOverdrive(false); }
    st.streak = 0;
    st.overdrive = false;
    mood('sad');
  }

  function mood(m) { st.robotMood = m; st.moodT = 1.2; }

  // ---------- Setor 3: decodificar ----------
  function answerDecode(v, btn) {
    if (!st || st.ended || st.paused) return;
    const t = alive().find((x) => !x.targeted && x.type === 'drone');
    if (!t) return;
    if (v === t.value) {
      btn.classList.add('ok');
      lockOptions(true);
      Sound.bitOn(16);
      destroy(t, true);
      Missions.track('hit', { kind: 'decode', value: v });
    } else {
      btn.classList.add('bad');
      btn.disabled = true;
      st.errors++;
      breakStreak();
      bounceBeam(t);
      toast(`Você escolheu <b>${v}</b>`, `Some os bits ligados de ${t.code}`, 'bad');
      updateHud();
    }
  }

  // ---------- Setor 4: letras ----------
  function setupLetters() {
    st.wi = 0; st.li = 0; st.charge = 0;
    st.boss = { hp: L.count, max: L.count, flash: 0, x: 0.5 };
    st.slots = L.words.map((w) => w.split('').map(() => ''));
    els.abc.innerHTML = '<b class="abc-title">A=1</b>' + Array.from({ length: 26 }, (_, i) => `<span><b>${LETTER(i + 1)}</b>${i + 1}</span>`).join('');
    nextLetter();
  }
  const curWord = () => L.words[st.wi];
  const curLetter = () => curWord()[st.li];

  function renderWord() {
    els.word.innerHTML = curWord().split('').map((ch, i) => {
      const s = st.slots[st.wi][i];
      const cls = s === 'ok' ? 'ok' : s === 'miss' ? 'miss' : i === st.li ? 'cur' : '';
      return `<span class="${cls}">${s ? ch : '?'}</span>`;
    }).join('');
  }

  function nextLetter() {
    st.charge = 0;
    const ch = curLetter();
    const n = NUM(ch);
    st.code = toBin(n, 5);
    st.codeFlip = 0.35;
    const opts = decoys(n, 3, 26).map(LETTER);
    opts.push(ch);
    renderOptions(shuffle(opts), answerLetter);
    renderWord();
  }

  function answerLetter(ch, btn) {
    if (!st || st.ended || st.paused || st.wait > 0) return;
    const right = curLetter();
    if (ch === right) {
      btn.classList.add('ok');
      lockOptions(true);
      letterDone(true);
    } else {
      btn.classList.add('bad');
      btn.disabled = true;
      st.errors++;
      breakStreak();
      bounceBeam(bossTarget());
      toast(`<b>${ch}</b> = ${NUM(ch)} = ${toBin(NUM(ch))}`, `Compare com o código do chefe: ${st.code}`, 'bad');
      updateHud();
    }
  }

  function bossTarget() {
    return { x: bossX() / W, float: true, y: H * 0.28, r: 50, p: 0, flash: 0, isBoss: true };
  }

  function letterDone(ok, byEmp) {
    const b = st.boss;
    const bx = bossX(), by = H * 0.28;
    if (ok) {
      shootBeam(bx, by);
      st.hits++;
      const pts = (byEmp ? 50 : 120) * (st.overdrive ? 2 : 1);
      st.score += pts;
      st.floats.push({ x: bx, y: by - 70, text: '+' + pts, c: st.overdrive ? '#ffd23f' : '#3dff9e', life: 1 });
      if (!byEmp) streakUp();
      Sound.letter();
      Missions.track('hit', { kind: 'letters', value: NUM(curLetter()) });
      mood('cheer');
    } else {
      st.misses++;
      breakStreak();
    }
    b.hp--;
    b.flash = 0.3;
    st.slots[st.wi][st.li] = ok ? 'ok' : 'miss';
    st.done++;
    st.li++;
    if (st.li >= curWord().length) {
      renderWordFinal();
      const w = curWord();
      st.wi++;
      st.li = 0;
      if (st.wi >= L.words.length) {
        bossDown();
      } else {
        banner(`${w}!`, 'word');
        Sound.word();
        st.wait = 1.3;
        lockOptions(true);
      }
    } else {
      st.wait = 0.3;
      lockOptions(true);
    }
    updateHud();
  }

  function renderWordFinal() {
    const i = st.wi;
    els.word.innerHTML = L.words[i].split('').map((ch, k) => `<span class="${st.slots[i][k]}">${ch}</span>`).join('');
  }

  function bossDown() {
    const bx = bossX(), by = H * 0.28;
    banner(`${L.words[L.words.length - 1]}! Chefe derrotado!`, 'gold');
    for (let i = 0; i < 4; i++) setTimeout(() => { if (st) { burst(bx + (Math.random() - 0.5) * 120, by + (Math.random() - 0.5) * 60, '#ff4fd8', 30); Sound.boom(); } }, i * 180);
    st.boss.dead = true;
    lockOptions(true);
    end(true, 1.6);
  }

  // ---------- Pulso PEM ----------
  function useEMP() {
    if (!st || st.ended || st.paused || !st.emp) return;
    st.emp--;
    Sound.emp();
    buzz(80);
    st.rings.push({ life: 1 });
    if (L.kind === 'letters') {
      if (st.wait <= 0) { lockOptions(true); letterDone(true, true); }
    } else {
      alive().filter((t) => !t.targeted).forEach((t, i) => {
        t.targeted = true;
        t.dieIn = 0.3 + i * 0.12;
        st.hits++; st.done++;
        const pts = 50 * (st.overdrive ? 2 : 1);
        st.score += pts;
        const p = pos(t);
        st.floats.push({ x: p.x, y: p.y - t.r, text: '+' + pts, c: '#ffd23f', life: 1 });
      });
      st.bits = 0;
      lockOptions(true);
      updatePanel();
    }
    updateHud();
  }

  // ---------- Ameaça chegou ao escudo ----------
  function impact(t) {
    t.dead = true;
    st.misses++;
    st.done++;
    st.shield--;
    st.shake = 0.45;
    breakStreak();
    const p = pos(t);
    burst(p.x, shieldY(p.x), '#ff6b6b', 26);
    Sound.shield();
    buzz(60);
    if (t.type === 'drone') toast(`${t.code} = ${partsOf(t.value).join(' + ')} = <b>${t.value}</b>`, 'O drone passou! Veja como se lê.', 'bad');
    else toast(`O <b>${t.value}</b> passou!`, `${t.value} = ${partsOf(t.value).join(' + ')}`, 'bad');
    if (t.type === 'drone') lockOptions(true);
    if (st.shield <= 0) end(false);
    updateHud();
  }

  function bossAttack() {
    st.shield--;
    st.shake = 0.45;
    const ch = curLetter();
    burst(W / 2, shieldY(W / 2), '#ff6b6b', 26);
    st.beams.push({ x1: bossX(), y1: H * 0.28 + 40, x2: W / 2, y2: shieldY(W / 2), t: 0, dur: 0.35, enemy: true });
    Sound.shield();
    buzz(60);
    toast(`${st.code} = ${partsOf(NUM(ch)).join(' + ')} = ${NUM(ch)} = <b>${ch}</b>`, 'O chefe atacou! Veja a resposta.', 'bad');
    lockOptions(true);
    letterDone(false);
    if (st.shield <= 0) end(false);
  }

  // ---------- Fim ----------
  function end(win, delay = 1.0) {
    if (st.ended) return;
    st.ended = true;
    st.win = win;
    Sound.stopMusic();
    Sound.setOverdrive(false);
    if (win) setTimeout(() => Sound.win(), 300); else Sound.lose();
    const sum = summary();
    setTimeout(() => { if (onEnd) onEnd(sum); }, delay * 1000);
  }

  function summary() {
    const tries = st.hits + st.errors + st.misses;
    const precision = tries ? st.hits / tries : 1;
    const eff = st.tapUsed ? st.tapMin / st.tapUsed : 1;
    const acc = L.kind === 'build' ? precision * (0.7 + 0.3 * eff) : precision;
    return {
      level: L, win: st.win, hits: st.hits, errors: st.errors, misses: st.misses,
      acc, score: st.score, best: st.best, eff,
    };
  }

  // ---------- Disparos e efeitos ----------
  function shootBeam(x, y) {
    const c = cannonPos();
    st.aim = Math.atan2(y - c.y, x - c.x);
    const tip = tipPos();
    st.beams.push({ x1: tip.x, y1: tip.y, x2: x, y2: y, t: 0, dur: 0.28 });
    Sound.laser();
  }

  function bounceBeam(t) {
    const p = pos(t);
    const c = cannonPos();
    st.aim = Math.atan2(p.y - c.y, p.x - c.x);
    const tip = tipPos();
    const side = p.x < W / 2 ? 1 : -1;
    st.beams.push({ x1: tip.x, y1: tip.y, x2: p.x, y2: p.y, t: 0, dur: 0.45, bounce: { x: p.x + side * W * 0.5, y: p.y + H * 0.25 } });
    if (!t.isBoss) t.flash = 0.4; else st.boss.flash = 0.25;
    Sound.bounce();
    buzz(30);
  }

  function tipPos() {
    const c = cannonPos();
    return { x: c.x + Math.cos(st.aim) * 34, y: c.y + Math.sin(st.aim) * 34 };
  }

  function burst(x, y, color, n = 22) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 220;
      st.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.5, max: 1, c: Math.random() < 0.3 ? '#ffffff' : color, s: 3 + rand(5) });
    }
  }

  function pos(t) {
    const x = t.x * W;
    if (t.float) return { x, y: t.y };
    const y0 = -t.r, y1 = shieldY(x) - t.r * 0.6;
    return { x, y: y0 + (y1 - y0) * t.p };
  }

  // ---------- Atualização ----------
  function update(dt) {
    T += dt;
    if (st.shake > 0) st.shake -= dt;
    if (st.moodT > 0) { st.moodT -= dt; if (st.moodT <= 0) st.robotMood = 'happy'; }

    if (!st.ended) {
      if (L.duration) {
        const before = Math.ceil(st.timeLeft);
        st.timeLeft -= dt;
        if (Math.ceil(st.timeLeft) !== before && st.timeLeft <= 5 && st.timeLeft > 0) Sound.tick();
        if (st.timeLeft <= 0) { st.timeLeft = 0; banner('TEMPO!', 'gold'); end(true, 1.2); }
        if (Math.ceil(st.timeLeft) !== before) updateHud();
      }

      if (L.kind === 'letters') {
        if (st.wait > 0) {
          st.wait -= dt;
          if (st.wait <= 0) nextLetter();
        } else if (!st.boss.dead) {
          st.charge += dt / L.charge;
          if (st.charge >= 1) bossAttack();
        }
      } else {
        const n = alive().length;
        if (st.spawned < L.count && n < (L.max || 1)) {
          st.spawnTimer -= dt;
          if (n === 0 && st.spawnTimer > 0.5) st.spawnTimer = 0.5;
          if (st.spawnTimer <= 0) { spawn(); st.spawnTimer = L.every || 3; }
        }
      }
    }
    if (st.codeFlip > 0) st.codeFlip -= dt;

    st.threats.forEach((t) => {
      if (t.dead) return;
      t.rot += t.spin * dt;
      if (t.flash > 0) t.flash -= dt;
      if (t.float) {
        const ty = H * (L.kind === 'decode' ? 0.3 : 0.32) + Math.sin(T * 1.6 + t.id) * 6;
        t.y += (ty - t.y) * Math.min(1, dt * 3);
      } else if (!t.targeted && !st.ended) {
        t.p += dt / L.fall;
        if (t.p >= 1) impact(t);
      }
      if (t.dieIn >= 0) {
        t.dieIn -= dt;
        if (t.dieIn < 0) {
          t.dead = true;
          const p = pos(t);
          burst(p.x, p.y, t.type === 'drone' ? '#ff4fd8' : '#ffb347', 30);
          Sound.boom();
          if (t.type === 'drone') els.options.innerHTML = '';
        }
      }
    });
    st.threats = st.threats.filter((t) => !t.dead);

    if (!st.ended && L.kind !== 'letters' && !L.duration && st.spawned >= L.count && st.threats.length === 0) {
      banner('SETOR LIMPO!', 'gold');
      end(true, 1.2);
    }

    st.beams.forEach((b) => { b.t += dt; });
    st.beams = st.beams.filter((b) => b.t < b.dur);
    st.parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 0.98; p.life -= dt; });
    st.parts = st.parts.filter((p) => p.life > 0);
    st.floats.forEach((f) => { f.y -= 40 * dt; f.life -= dt * 0.9; });
    st.floats = st.floats.filter((f) => f.life > 0);
    st.rings.forEach((r) => { r.life -= dt * 1.2; });
    st.rings = st.rings.filter((r) => r.life > 0);
    if (st.boss && st.boss.flash > 0) st.boss.flash -= dt;

    // o canhão mira na ameaça mais perigosa
    const c = cannonPos();
    const near = st.threats.filter((t) => !t.targeted).sort((a, b) => b.p - a.p)[0];
    let want = -Math.PI / 2;
    if (near) { const p = pos(near); want = Math.atan2(p.y - c.y, p.x - c.x); }
    else if (L.kind === 'letters') want = Math.atan2(H * 0.28 - c.y, bossX() - c.x);
    if (!st.beams.length) st.aim += (want - st.aim) * Math.min(1, dt * 6);
  }

  // ---------- Desenho ----------
  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (st.shake > 0) ctx.translate((Math.random() - 0.5) * 12 * st.shake, (Math.random() - 0.5) * 12 * st.shake);
    drawSky();
    drawCity();
    drawShield();
    st.threats.forEach((t) => (t.type === 'drone' ? drawDrone(t) : drawMeteor(t)));
    if (L.kind === 'letters') drawBoss();
    st.beams.forEach(drawBeamFx);
    drawCannon();
    drawRobot(ctx, W / 2 - 58, H - 70, 46, Store.data.equip.robot, T, st.robotMood);
    st.parts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    });
    ctx.globalAlpha = 1;
    st.rings.forEach((r) => {
      const c = cannonPos();
      ctx.beginPath();
      ctx.arc(c.x, c.y, (1 - r.life) * Math.max(W, H) * 1.2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,210,63,${r.life})`;
      ctx.lineWidth = 18 * r.life + 2;
      ctx.stroke();
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    st.floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = `700 22px ${FONT}`;
      ctx.lineWidth = 5; ctx.strokeStyle = '#0b1026';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.c;
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, st.overdrive ? '#2a1640' : '#0b1026');
    g.addColorStop(0.7, st.overdrive ? '#3b1f3c' : '#151a44');
    g.addColorStop(1, '#22205a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // grade de circuito
    ctx.strokeStyle = 'rgba(34,230,255,.06)';
    ctx.lineWidth = 1;
    const off = (T * 20) % 40;
    for (let y = off; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = (W / 2) % 40; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    const sp = st.overdrive ? 3 : 1;
    sky.forEach((s) => {
      s.y += 0.0009 * s.z * sp;
      if (s.y > 1) { s.y = 0; s.x = Math.random(); }
      ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.5 * s.z})`;
      const sz = s.z > 1 ? 2 : 1.4;
      ctx.fillRect(s.x * W, s.y * H, sz, sz * (st.overdrive ? 4 : 1));
    });
  }

  function drawCity() {
    const gy = ground();
    city.forEach((b, i) => {
      const top = gy - b.h;
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x, top, b.w, b.h);
      if (b.chip) {
        ctx.fillStyle = '#3a4390';
        for (let px = b.x + 3; px < b.x + b.w - 2; px += 6) ctx.fillRect(px, top - 4, 3, 4);
      }
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(b.x, top, 3, b.h);
      let k = 0;
      for (let y = top + 6; y < gy - 6; y += 9) {
        for (let x = b.x + 5; x < b.x + b.w - 5; x += 8) {
          const on = b.win[k++ % b.win.length] > 0.45;
          if (!on) continue;
          const flick = Math.sin(T * 2 + i + k) > -0.9;
          ctx.fillStyle = flick ? (k % 3 ? '#22e6ff' : '#3dff9e') : '#ffd23f';
          ctx.globalAlpha = 0.55;
          ctx.fillRect(x, y, 3, 4);
          ctx.globalAlpha = 1;
        }
      }
    });
    ctx.fillStyle = '#0a0e2a';
    ctx.fillRect(0, gy, W, H - gy);
    ctx.strokeStyle = 'rgba(34,230,255,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }

  function drawShield() {
    const lvl = st.maxShield ? st.shield / st.maxShield : 1;
    const hurt = st.shake > 0;
    ctx.beginPath();
    ctx.moveTo(0, shieldY(0));
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, shieldY(x));
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const g = ctx.createLinearGradient(0, H - 130, 0, H);
    const col = hurt ? '255,90,110' : lvl > 0.5 ? '34,230,255' : '255,180,60';
    g.addColorStop(0, `rgba(${col},${0.14 * lvl + 0.04})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    for (let x = 0; x <= W; x += 10) {
      const y = shieldY(x) + Math.sin(x * 0.05 + T * 4) * 1.5;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${col},${0.35 + 0.5 * lvl})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = `rgb(${col})`;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawCannon() {
    const c = cannonPos();
    // torre
    ctx.fillStyle = '#1c2360';
    ctx.strokeStyle = '#0b1026';
    ctx.lineWidth = 3;
    rrect(ctx, c.x - 26, c.y, 52, ground() - c.y, 8);
    ctx.fill(); ctx.stroke();
    // cano
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(st.aim + Math.PI / 2);
    rrect(ctx, -9, -36, 18, 36, 6);
    ctx.fillStyle = '#c9d3ff'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = st.overdrive ? '#ffd23f' : '#22e6ff';
    ctx.fillRect(-9, -36, 18, 7);
    ctx.strokeRect(-9, -36, 18, 7);
    ctx.restore();
    // base
    ctx.beginPath();
    ctx.arc(c.x, c.y + 2, 18, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = '#2f3a8f'; ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y - 4, 5, 0, Math.PI * 2);
    ctx.fillStyle = st.overdrive ? '#ffd23f' : '#22e6ff';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawBeamFx(b) {
    const k = b.t / b.dur;
    const a = 1 - k;
    if (b.enemy) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,79,109,${a})`;
      ctx.lineWidth = 8;
      ctx.shadowColor = '#ff4f6d'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
      for (let i = 1; i <= 8; i++) {
        const f = i / 8;
        ctx.lineTo(b.x1 + (b.x2 - b.x1) * f + (i < 8 ? (Math.random() - 0.5) * 24 : 0), b.y1 + (b.y2 - b.y1) * f);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }
    const style = Store.data.equip.laser;
    if (b.bounce) {
      // o feixe vai até o alvo e rebate para fora, sem destruir nada
      const k1 = Math.min(1, k * 2.5);
      const ex = b.x1 + (b.x2 - b.x1) * k1, ey = b.y1 + (b.y2 - b.y1) * k1;
      drawBeam(ctx, style, b.x1, b.y1, ex, ey, T, a * 0.8);
      if (k1 >= 1) {
        const k2 = Math.min(1, (k - 0.4) * 2);
        if (k2 > 0) {
          ctx.save();
          ctx.setLineDash([8, 8]);
          ctx.strokeStyle = `rgba(255,140,90,${a})`;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(b.x2, b.y2);
          ctx.lineTo(b.x2 + (b.bounce.x - b.x2) * k2, b.y2 + (b.bounce.y - b.y2) * k2);
          ctx.stroke();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(b.x2, b.y2, 10 + 30 * k, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      return;
    }
    drawBeam(ctx, style, b.x1, b.y1, b.x2, b.y2, T, a);
    ctx.beginPath();
    ctx.arc(b.x2, b.y2, 8 + 26 * k, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${a * 0.7})`;
    ctx.fill();
  }

  function drawMeteor(t) {
    const { x, y } = pos(t);
    const r = t.r;
    const danger = !t.float && t.p > 0.72;
    ctx.save();
    ctx.translate(x, y);
    if (!t.float && !t.targeted) {
      const g = ctx.createLinearGradient(0, -r * 3.4, 0, 0);
      g.addColorStop(0, 'rgba(255,79,216,0)');
      g.addColorStop(1, 'rgba(255,140,80,.6)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, -r * 0.1);
      ctx.quadraticCurveTo(0, -r * 4, r * 0.85, -r * 0.1);
      ctx.fill();
    }
    if (danger) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 8 + Math.sin(T * 12) * 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,79,109,.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.save();
    ctx.rotate(t.rot);
    ctx.beginPath();
    const n = t.shape.a.length;
    t.shape.a.forEach((m, i) => {
      const a = (i / n) * Math.PI * 2;
      const px = Math.cos(a) * r * m, py = Math.sin(a) * r * m;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.closePath();
    const g2 = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g2.addColorStop(0, '#9b6fd0');
    g2.addColorStop(1, '#4a2a78');
    ctx.fillStyle = g2;
    ctx.shadowColor = '#ff4fd8';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#0b1026';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    t.shape.cr.forEach((c) => {
      ctx.beginPath();
      ctx.arc(Math.cos(c.a) * r * c.d, Math.sin(c.a) * r * c.d, r * c.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(30,14,60,.45)';
      ctx.fill();
    });
    ctx.restore();
    // número do alvo (com um "glitch" de cor de vez em quando)
    ctx.font = `700 ${Math.round(r * 1.0)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const txt = String(t.value);
    if (Math.sin(T * 7 + t.id * 3) > 0.93) {
      ctx.fillStyle = 'rgba(255,79,216,.8)'; ctx.fillText(txt, -3, 2);
      ctx.fillStyle = 'rgba(34,230,255,.8)'; ctx.fillText(txt, 3, 2);
    }
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#0b1026';
    ctx.strokeText(txt, 0, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(txt, 0, 2);
    if (t.flash > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${t.flash * 2})`;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDrone(t) {
    const { x, y } = pos(t);
    const n = t.code.length;
    const cw = 28;
    const w = n * cw + 30;
    const h = L.labels ? 82 : 64;
    ctx.save();
    ctx.translate(x, y + Math.sin(T * 3 + t.id) * 3);
    // hélices
    [-1, 1].forEach((d) => {
      ctx.strokeStyle = '#0b1026'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(d * w * 0.32, -h / 2); ctx.lineTo(d * w * 0.32, -h / 2 - 12); ctx.stroke();
      const spin = Math.abs(Math.sin(T * 30 + d));
      ctx.fillStyle = 'rgba(200,210,255,.75)';
      ctx.beginPath(); ctx.ellipse(d * w * 0.32, -h / 2 - 13, 22 * spin + 4, 4, 0, 0, Math.PI * 2); ctx.fill();
    });
    rrect(ctx, -w / 2, -h / 2, w, h, 18);
    ctx.fillStyle = '#2c1656';
    ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = t.p > 0.72 ? 22 : 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#0b1026'; ctx.lineWidth = 3.5; ctx.stroke();
    // chifres de vírus
    ctx.fillStyle = '#ff4fd8';
    [-1, 1].forEach((d) => {
      ctx.beginPath();
      ctx.moveTo(d * (w / 2 - 6), -h / 2 + 8);
      ctx.lineTo(d * (w / 2 + 10), -h / 2 - 6);
      ctx.lineTo(d * (w / 2 - 2), -h / 2 + 22);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    // tela
    const sh = L.labels ? h - 34 : h - 18;
    rrect(ctx, -w / 2 + 9, -h / 2 + 9, w - 18, sh, 10);
    ctx.fillStyle = '#07051a'; ctx.fill();
    ctx.font = `800 28px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const vals = VALUES.slice(5 - n);
    t.code.split('').forEach((d, i) => {
      const cx = -w / 2 + 15 + i * cw + cw / 2;
      ctx.fillStyle = d === '1' ? '#3dff9e' : '#4a5190';
      if (d === '1') { ctx.shadowColor = '#3dff9e'; ctx.shadowBlur = 10; }
      ctx.fillText(d, cx, -h / 2 + 9 + sh / 2 + 1);
      ctx.shadowBlur = 0;
      if (L.labels) {
        ctx.font = `700 13px ${FONT}`;
        ctx.fillStyle = d === '1' ? '#ffd23f' : '#8a8fc0';
        ctx.fillText(vals[i], cx, h / 2 - 12);
        ctx.font = `800 28px ${MONO}`;
      }
    });
    if (t.flash > 0) {
      rrect(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 22);
      ctx.strokeStyle = `rgba(255,255,255,${t.flash * 2})`;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoss() {
    const b = st.boss;
    if (!b) return;
    const S = Math.min((W - 100) * 0.85, 230);
    const x = bossX() + Math.sin(T * 1.3) * 8;
    const y = H * 0.28 + Math.sin(T * 2.1) * 5;
    if (b.dead) return;
    ctx.save();
    ctx.translate(x, y);
    const w = S, h = S * 0.6;
    // espinhos
    ctx.fillStyle = '#ff4fd8';
    ctx.strokeStyle = '#0b1026'; ctx.lineWidth = 3.5;
    for (let i = 0; i < 5; i++) {
      const sx = -w / 2 + 22 + i * (w - 44) / 4;
      ctx.beginPath(); ctx.moveTo(sx - 12, -h / 2 + 4); ctx.lineTo(sx, -h / 2 - 18 - (i % 2) * 8); ctx.lineTo(sx + 12, -h / 2 + 4); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    rrect(ctx, -w / 2, -h / 2, w, h, 26);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#5a1f8f'); g.addColorStop(1, '#2a0c4a');
    ctx.fillStyle = g;
    ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = 20 + st.charge * 20;
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.stroke();
    // olhos bravos
    [-1, 1].forEach((d) => {
      ctx.save();
      ctx.translate(d * w * 0.22, -h * 0.28);
      ctx.rotate(d * 0.25);
      rrect(ctx, -14, -6, 28, 12, 6);
      ctx.fillStyle = st.charge > 0.7 ? '#ff4f6d' : '#ffd23f';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
    });
    ctx.shadowBlur = 0;
    // tela com o código
    const sw = w - 30, shh = h * 0.42;
    rrect(ctx, -sw / 2, -h * 0.12, sw, shh, 12);
    ctx.fillStyle = '#07051a'; ctx.fill();
    ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 2; ctx.stroke();
    const code = st.code || '00000';
    const cw = sw / 5;
    ctx.font = `800 ${Math.round(Math.min(cw * 0.85, 34))}px ${MONO}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    code.split('').forEach((d, i) => {
      let ch = d;
      if (st.codeFlip > 0) ch = Math.random() < 0.5 ? '0' : '1';
      ctx.fillStyle = ch === '1' ? '#3dff9e' : '#4a5190';
      if (ch === '1') { ctx.shadowColor = '#3dff9e'; ctx.shadowBlur = 10; }
      ctx.fillText(ch, -sw / 2 + cw * i + cw / 2, -h * 0.12 + shh / 2 + 1);
      ctx.shadowBlur = 0;
    });
    if (b.flash > 0) {
      rrect(ctx, -w / 2, -h / 2, w, h, 26);
      ctx.fillStyle = `rgba(255,255,255,${b.flash * 2})`;
      ctx.fill();
    }
    // vida do chefe
    const pw = Math.min(12, (w - 20) / b.max - 3);
    const total = b.max * (pw + 3) - 3;
    for (let i = 0; i < b.max; i++) {
      ctx.fillStyle = i < b.hp ? '#ff4fd8' : 'rgba(255,255,255,.15)';
      ctx.fillRect(-total / 2 + i * (pw + 3), -h / 2 - 40, pw, 7);
    }
    // carga do ataque
    const cy = h / 2 + 12;
    rrect(ctx, -w / 2 + 10, cy, w - 20, 10, 5);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
    if (st.wait <= 0) {
      rrect(ctx, -w / 2 + 10, cy, Math.max(10, (w - 20) * Math.min(1, st.charge)), 10, 5);
      ctx.fillStyle = st.charge > 0.7 ? '#ff4f6d' : '#ffd23f';
      ctx.fill();
    }
    ctx.restore();
  }

  function frame(now) {
    if (!st) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!st.paused) update(dt);
    if (st) draw();
    raf = requestAnimationFrame(frame);
  }

  // ---------- Teclado (PC) ----------
  window.addEventListener('keydown', (e) => {
    if (!st || !screen.classList.contains('active') || st.paused) return;
    const n = parseInt(e.key, 10);
    if (L.kind === 'build') {
      if (n >= 1 && n <= 5) { toggle(VALUES[n - 1]); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === ' ') { if (Store.data.mode === 'desafio') fire(); e.preventDefault(); }
      else if (e.key === 'Backspace' || e.key === '0') clearBits();
    } else if (n >= 1) {
      const b = els.options.querySelectorAll('.opt')[n - 1];
      if (b) b.dispatchEvent(new Event('pointerdown'));
    }
    if (e.key === 'e' || e.key === 'E') useEMP();
  });

  els.fire.addEventListener('pointerdown', (e) => { e.preventDefault(); fire(); });
  els.clear.addEventListener('pointerdown', (e) => { e.preventDefault(); clearBits(); });
  els.emp.addEventListener('pointerdown', (e) => { e.preventDefault(); useEMP(); });

  return { start, stop, pause, resize, get running() { return !!st && !st.ended; }, get level() { return L; } };
})();
