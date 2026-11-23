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
  const FONT = 'Lexend, system-ui, sans-serif';
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
    Scene3D.resize(W, H, DPR);
  }
  window.addEventListener('resize', () => { if (screen.classList.contains('active')) resize(); });
  // o campo muda de tamanho quando o painel de respostas aparece ou some
  if (window.ResizeObserver) new ResizeObserver(() => { if (screen.classList.contains('active')) resize(); }).observe(field);

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
  const cannonPos = () => ({ x: W / 2, y: H - 60 });
  const bossX = () => (L && L.kind === 'letters' ? (W - 86) / 2 : W / 2);

  // ---------- Painel / DOM ----------
  const els = {
    bits: $('bits'), options: $('options'), bin: $('bin'), sum: $('sum'), readout: $('readout'),
    fire: $('btn-fire'), clear: $('btn-clear'), emp: $('btn-emp'), empCount: $('emp-count'),
    score: $('hud-score'), prog: $('hud-prog'), progFill: $('hud-prog-fill'), shield: $('hud-shield'),
    title: $('hud-title'), pips: $('pips'), comboLabel: $('combo-label'), toast: $('toast'), banner: $('banner'),
    word: $('word'), abc: $('abc'),
  };

  const BOLT = icon('bolt', 'i-on');
  const BATT = icon('battery', 'i-off');

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
        ? `<span class="val">16</span><span class="lock">${icon('lock')}</span><span class="digit">0</span>`
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
    Scene3D.reset();
    els.title.textContent = L.sector ? `Setor ${L.id} · ${L.name}` : L.name;
    buildPanel();
    resize();
    if (L.kind === 'letters') setupLetters();
    updatePanel();
    updateHud();
    els.toast.className = 'toast';
    if (L.rule) banner(L.rule.name, 'gold');
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
    if (!st.bits) { toast('Ligue alguns bits primeiro!', '', 'info'); Sound.wrong(); return; }
    const t = matching(st.bits);
    if (t) { hitBuild(t); return; }
    const target = alive().filter((x) => !x.targeted).sort((a, b) => b.p - a.p)[0];
    if (!target) return;
    st.errors++;
    breakStreak();
    bounceBeam(target);
    const diff = st.bits - target.value;
    toast(`Você enviou <b>${st.bits}</b>, o alvo era <b>${target.value}</b>`,
      diff > 0 ? `Passou ${diff}` : `Faltou ${-diff}`, 'bad');
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
    st.floats.push({ x: p.x, y: p.y - t.r - 6, text: '+' + pts, c: st.overdrive ? '#fbbf24' : '#6ee7b7', life: 1 });
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
        setTimeout(() => { if (st && !st.ended) { banner('PULSO PEM +1', 'emp'); Sound.empReady(); } }, 500);
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
      st.floats.push({ x: bx, y: by - 70, text: '+' + pts, c: st.overdrive ? '#fbbf24' : '#6ee7b7', life: 1 });
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
    for (let i = 0; i < 4; i++) setTimeout(() => { if (st) { burst(bx + (Math.random() - 0.5) * 120, by + (Math.random() - 0.5) * 60, '#f472b6', 26); Sound.boom(); } }, i * 180);
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
        st.floats.push({ x: p.x, y: p.y - t.r, text: '+' + pts, c: '#fbbf24', life: 1 });
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
    return { x: c.x + Math.cos(st.aim) * 30, y: c.y + Math.sin(st.aim) * 30 };
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
          burst(p.x, p.y, t.type === 'drone' ? '#f472b6' : '#c4b5fd', 26);
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
  // Modo 3D: o cenário vem do Scene3D; aqui só o robô e os pontos flutuantes, por cima.
  function draw() {
    if (Scene3D.active) {
      ctx.clearRect(0, 0, W, H);
      Scene3D.render({ st, L, T, pos, ground, cannonPos, bossX, shieldY });
      drawRobot(ctx, W / 2 - 60, ground() - 22, 44, Store.data.equip.robot, T, st.robotMood);
      st.floats.forEach((f) => {
        ctx.globalAlpha = Math.max(0, f.life);
        numberText(f.text, f.x, f.y, 18, f.c);
      });
      ctx.globalAlpha = 1;
      return;
    }
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
    drawRobot(ctx, W / 2 - 60, ground() - 22, 44, Store.data.equip.robot, T, st.robotMood);
    st.parts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s / 2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    st.rings.forEach((r) => {
      const c = cannonPos();
      ctx.beginPath();
      ctx.arc(c.x, c.y, (1 - r.life) * Math.max(W, H) * 1.2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(251,191,36,${r.life * 0.8})`;
      ctx.lineWidth = 10 * r.life + 1;
      ctx.stroke();
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    st.floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, f.life);
      numberText(f.text, f.x, f.y, 18, f.c);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070b1a');
    g.addColorStop(0.65, '#0c1333');
    g.addColorStop(1, '#141c4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // nebulosas suaves
    const n1 = ctx.createRadialGradient(W * 0.15, H * 0.12, 0, W * 0.15, H * 0.12, W * 0.7);
    n1.addColorStop(0, 'rgba(124,58,237,.16)'); n1.addColorStop(1, 'rgba(124,58,237,0)');
    ctx.fillStyle = n1; ctx.fillRect(0, 0, W, H);
    const n2 = ctx.createRadialGradient(W * 0.95, H * 0.55, 0, W * 0.95, H * 0.55, W * 0.6);
    n2.addColorStop(0, 'rgba(62,224,255,.08)'); n2.addColorStop(1, 'rgba(62,224,255,0)');
    ctx.fillStyle = n2; ctx.fillRect(0, 0, W, H);
    if (st.overdrive) {
      const o = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, H);
      o.addColorStop(0, 'rgba(251,191,36,.16)'); o.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = o; ctx.fillRect(0, 0, W, H);
    }
    const sp = st.overdrive ? 3.5 : 1;
    sky.forEach((s, i) => {
      s.y += 0.0007 * s.z * sp;
      if (s.y > 1) { s.y = 0; s.x = Math.random(); }
      const tw = 0.55 + 0.45 * Math.sin(T * (1 + s.z) + i);
      ctx.fillStyle = `rgba(220,228,255,${(0.15 + 0.45 * s.z) * tw})`;
      const sz = s.z > 1 ? 1.6 : 1.1;
      ctx.fillRect(s.x * W, s.y * H, sz, st.overdrive ? sz * 5 : sz);
    });
  }

  function drawCity() {
    const gy = ground();
    // camada de trás
    ctx.fillStyle = '#111840';
    city.forEach((b) => {
      const h = b.h * 0.7 + 14;
      rrect(ctx, b.x + b.w * 0.4, gy - h - 10, b.w, h + 10, 4);
      ctx.fill();
    });
    // camada da frente
    city.forEach((b, i) => {
      const top = gy - b.h;
      const g = ctx.createLinearGradient(0, top, 0, gy);
      g.addColorStop(0, '#1d2660'); g.addColorStop(1, '#141b49');
      ctx.fillStyle = g;
      rrect(ctx, b.x, top, b.w, b.h + 4, 5);
      ctx.fill();
      let k = 0;
      for (let y = top + 8; y < gy - 8; y += 10) {
        for (let x = b.x + 6; x < b.x + b.w - 6; x += 9) {
          const on = b.win[k++ % b.win.length] > 0.72;
          if (!on) continue;
          ctx.fillStyle = k % 4 ? 'rgba(62,224,255,.55)' : 'rgba(251,191,36,.6)';
          ctx.globalAlpha = 0.6 + 0.4 * Math.sin(T * 1.5 + i + k);
          ctx.fillRect(x, y, 2.5, 3.5);
        }
      }
      ctx.globalAlpha = 1;
    });
    const gg = ctx.createLinearGradient(0, gy, 0, H);
    gg.addColorStop(0, '#0d1336'); gg.addColorStop(1, '#070b1a');
    ctx.fillStyle = gg;
    ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = 'rgba(62,224,255,.35)';
    ctx.fillRect(0, gy, W, 1);
  }

  function drawShield() {
    const lvl = st.maxShield ? st.shield / st.maxShield : 1;
    const hurt = st.shake > 0;
    const col = hurt ? '251,113,133' : lvl > 0.5 ? '62,224,255' : '251,191,36';
    ctx.beginPath();
    ctx.moveTo(0, shieldY(0));
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, shieldY(x));
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const g = ctx.createLinearGradient(0, H - 130, 0, H - 40);
    g.addColorStop(0, `rgba(${col},${0.09 * lvl + 0.03})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = shieldY(x);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${col},${0.3 + 0.55 * lvl})`;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = `rgb(${col})`;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawCannon() {
    const c = cannonPos();
    const accent = st.overdrive ? '#fbbf24' : '#3ee0ff';
    // pedestal
    const pg = ctx.createLinearGradient(0, c.y, 0, ground());
    pg.addColorStop(0, '#2a3474'); pg.addColorStop(1, '#161d4d');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(c.x - 14, c.y + 6); ctx.lineTo(c.x + 14, c.y + 6);
    ctx.lineTo(c.x + 22, ground()); ctx.lineTo(c.x - 22, ground());
    ctx.closePath(); ctx.fill();
    // cano
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(st.aim + Math.PI / 2);
    const bg = ctx.createLinearGradient(-6, 0, 6, 0);
    bg.addColorStop(0, '#aab6f0'); bg.addColorStop(0.5, '#eef2ff'); bg.addColorStop(1, '#9aa6e6');
    ctx.fillStyle = bg;
    rrect(ctx, -6, -32, 12, 32, 6);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.shadowColor = accent; ctx.shadowBlur = 12;
    rrect(ctx, -6, -32, 12, 6, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    // cúpula
    const dg = ctx.createLinearGradient(0, c.y - 16, 0, c.y + 6);
    dg.addColorStop(0, '#3a46a0'); dg.addColorStop(1, '#232c70');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(c.x, c.y + 6, 18, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c.x, c.y - 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.shadowColor = accent; ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawBeamFx(b) {
    const k = b.t / b.dur;
    const a = 1 - k;
    if (b.enemy) {
      ctx.save();
      ctx.strokeStyle = `rgba(251,113,133,${a})`;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#fb7185'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
      for (let i = 1; i <= 8; i++) {
        const f = i / 8;
        ctx.lineTo(b.x1 + (b.x2 - b.x1) * f + (i < 8 ? (Math.random() - 0.5) * 20 : 0), b.y1 + (b.y2 - b.y1) * f);
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
          ctx.setLineDash([6, 8]);
          ctx.lineCap = 'round';
          ctx.strokeStyle = `rgba(251,146,60,${a})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(b.x2, b.y2);
          ctx.lineTo(b.x2 + (b.bounce.x - b.x2) * k2, b.y2 + (b.bounce.y - b.y2) * k2);
          ctx.stroke();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(b.x2, b.y2, 10 + 28 * k, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${a * 0.8})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      return;
    }
    drawBeam(ctx, style, b.x1, b.y1, b.x2, b.y2, T, a);
    const ig = ctx.createRadialGradient(b.x2, b.y2, 0, b.x2, b.y2, 14 + 30 * k);
    ig.addColorStop(0, `rgba(255,255,255,${a * 0.9})`); ig.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(b.x2, b.y2, 14 + 30 * k, 0, Math.PI * 2); ctx.fill();
  }

  function numberText(txt, x, y, size, color = '#ffffff') {
    ctx.font = `700 ${Math.round(size)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(10,6,30,.65)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = color;
    ctx.fillText(txt, x, y);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }

  function drawMeteor(t) {
    const { x, y } = pos(t);
    const r = t.r;
    const danger = !t.float && t.p > 0.72;
    ctx.save();
    ctx.translate(x, y);
    if (!t.float && !t.targeted) {
      const g = ctx.createLinearGradient(0, -r * 3.6, 0, 0);
      g.addColorStop(0, 'rgba(167,139,250,0)');
      g.addColorStop(1, 'rgba(196,181,253,.35)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.2);
      ctx.quadraticCurveTo(0, -r * 4, r * 0.7, -r * 0.2);
      ctx.fill();
    }
    // halo
    const halo = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.7);
    halo.addColorStop(0, danger ? 'rgba(251,113,133,.35)' : 'rgba(167,139,250,.28)');
    halo.addColorStop(1, 'rgba(167,139,250,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2); ctx.fill();
    if (danger) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 7 + Math.sin(T * 10) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(251,113,133,.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.save();
    ctx.rotate(t.rot);
    ctx.beginPath();
    const n = t.shape.a.length;
    for (let i = 0; i <= n; i++) {
      const m = t.shape.a[i % n], m2 = t.shape.a[(i + 1) % n];
      const a = (i / n) * Math.PI * 2, a2 = ((i + 0.5) / n) * Math.PI * 2;
      const px = Math.cos(a) * r * m, py = Math.sin(a) * r * m;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.quadraticCurveTo(Math.cos(a2 - Math.PI / n) * r * (m + 0.06), Math.sin(a2 - Math.PI / n) * r * (m + 0.06), px, py);
      void m2;
    }
    ctx.closePath();
    const g2 = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    g2.addColorStop(0, '#c4b5fd');
    g2.addColorStop(0.45, '#7c5ce0');
    g2.addColorStop(1, '#2e1a66');
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    t.shape.cr.forEach((c) => {
      ctx.beginPath();
      ctx.arc(Math.cos(c.a) * r * c.d, Math.sin(c.a) * r * c.d, r * c.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20,10,50,.16)';
      ctx.fill();
    });
    ctx.restore();
    numberText(String(t.value), 0, 1, r * 0.95);
    if (t.flash > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${t.flash * 2})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCode(code, cx, cy, cw, size, labels) {
    const vals = VALUES.slice(5 - code.length);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    code.split('').forEach((d, i) => {
      const x = cx - (code.length * cw) / 2 + i * cw + cw / 2;
      ctx.font = `700 ${size}px ${MONO}`;
      if (d === '1') { ctx.fillStyle = '#5ef0ff'; ctx.shadowColor = '#3ee0ff'; ctx.shadowBlur = 12; }
      else { ctx.fillStyle = 'rgba(141,151,199,.35)'; }
      ctx.fillText(d, x, cy);
      ctx.shadowBlur = 0;
      if (labels) {
        ctx.font = `600 11px ${FONT}`;
        ctx.fillStyle = d === '1' ? '#fbbf24' : 'rgba(141,151,199,.6)';
        ctx.fillText(vals[i], x, cy + size * 0.85);
      }
    });
  }

  function drawDrone(t) {
    const { x, y } = pos(t);
    const n = t.code.length;
    const cw = 26;
    const w = n * cw + 28;
    const h = L.labels ? 78 : 60;
    ctx.save();
    ctx.translate(x, y + Math.sin(T * 3 + t.id) * 3);
    const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, w * 0.9);
    halo.addColorStop(0, t.p > 0.72 ? 'rgba(251,113,133,.3)' : 'rgba(167,139,250,.25)');
    halo.addColorStop(1, 'rgba(167,139,250,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-w, -w, w * 2, w * 2);
    // hélices
    [-1, 1].forEach((d) => {
      ctx.strokeStyle = 'rgba(196,181,253,.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(d * w * 0.3, -h / 2); ctx.lineTo(d * w * 0.3, -h / 2 - 9); ctx.stroke();
      const spin = Math.abs(Math.sin(T * 30 + d));
      ctx.fillStyle = 'rgba(221,214,254,.55)';
      ctx.beginPath(); ctx.ellipse(d * w * 0.3, -h / 2 - 10, 18 * spin + 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    });
    rrect(ctx, -w / 2, -h / 2, w, h, 18);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#2f2270'); g.addColorStop(1, '#1a1245');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(196,181,253,.35)'; ctx.lineWidth = 1; ctx.stroke();
    // LEDs
    [-1, 1].forEach((d) => {
      ctx.beginPath(); ctx.arc(d * (w / 2 - 9), -h / 2 + 9, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f472b6'; ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
    });
    const sh = L.labels ? h - 30 : h - 18;
    rrect(ctx, -w / 2 + 9, -h / 2 + 9, w - 18, sh, 11);
    ctx.fillStyle = 'rgba(5,4,20,.85)'; ctx.fill();
    drawCode(t.code, 0, -h / 2 + 9 + sh / 2 + 1, cw, 26, false);
    if (L.labels) {
      const vals = VALUES.slice(5 - n);
      ctx.font = `600 11px ${FONT}`;
      t.code.split('').forEach((d, i) => {
        ctx.fillStyle = d === '1' ? '#fbbf24' : 'rgba(141,151,199,.6)';
        ctx.fillText(vals[i], -(n * cw) / 2 + i * cw + cw / 2, h / 2 - 11);
      });
    }
    if (t.flash > 0) {
      rrect(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 22);
      ctx.strokeStyle = `rgba(255,255,255,${t.flash * 2})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoss() {
    const b = st.boss;
    if (!b || b.dead) return;
    const S = Math.min((W - 100) * 0.85, 230);
    const x = bossX() + Math.sin(T * 1.3) * 8;
    const y = H * 0.28 + Math.sin(T * 2.1) * 5;
    ctx.save();
    ctx.translate(x, y);
    const w = S, h = S * 0.6;
    const halo = ctx.createRadialGradient(0, 0, 20, 0, 0, w * 0.9);
    halo.addColorStop(0, `rgba(244,114,182,${0.18 + st.charge * 0.25})`);
    halo.addColorStop(1, 'rgba(244,114,182,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-w, -w, w * 2, w * 2);
    // antenas
    [-1, 1].forEach((d) => {
      ctx.strokeStyle = 'rgba(244,114,182,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(d * w * 0.28, -h / 2); ctx.lineTo(d * w * 0.36, -h / 2 - 16); ctx.stroke();
      ctx.beginPath(); ctx.arc(d * w * 0.36, -h / 2 - 18, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f472b6'; ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
    });
    rrect(ctx, -w / 2, -h / 2, w, h, 28);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#4c2a8f'); g.addColorStop(1, '#22125a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(244,114,182,.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    // olhos
    const eye = st.charge > 0.7 ? '#fb7185' : '#fbbf24';
    [-1, 1].forEach((d) => {
      ctx.save();
      ctx.translate(d * w * 0.22, -h * 0.29);
      ctx.rotate(d * 0.22);
      rrect(ctx, -13, -4, 26, 8, 4);
      ctx.fillStyle = eye; ctx.shadowColor = eye; ctx.shadowBlur = 12;
      ctx.fill();
      ctx.restore();
    });
    ctx.shadowBlur = 0;
    // tela com o código
    const sw = w - 30, shh = h * 0.44;
    rrect(ctx, -sw / 2, -h * 0.12, sw, shh, 14);
    ctx.fillStyle = 'rgba(5,4,20,.85)'; ctx.fill();
    let code = st.code || '00000';
    if (st.codeFlip > 0) code = code.split('').map(() => (Math.random() < 0.5 ? '0' : '1')).join('');
    const cw = sw / 5;
    drawCode(code, 0, -h * 0.12 + shh / 2 + 1, cw, Math.round(Math.min(cw * 0.8, 32)), false);
    if (b.flash > 0) {
      rrect(ctx, -w / 2, -h / 2, w, h, 28);
      ctx.fillStyle = `rgba(255,255,255,${b.flash * 2})`;
      ctx.fill();
    }
    // vida do chefe
    const bw = w * 0.6;
    rrect(ctx, -bw / 2, -h / 2 - 34, bw, 5, 2.5);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
    if (b.hp > 0) {
      rrect(ctx, -bw / 2, -h / 2 - 34, bw * b.hp / b.max, 5, 2.5);
      ctx.fillStyle = '#f472b6'; ctx.fill();
    }
    // carga do ataque
    const cy = h / 2 + 14;
    rrect(ctx, -w / 2 + 14, cy, w - 28, 5, 2.5);
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
    if (st.wait <= 0) {
      rrect(ctx, -w / 2 + 14, cy, Math.max(5, (w - 28) * Math.min(1, st.charge)), 5, 2.5);
      ctx.fillStyle = st.charge > 0.7 ? '#fb7185' : '#fbbf24';
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
