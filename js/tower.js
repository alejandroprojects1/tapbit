// Mensagem na Torre (inspirado na atividade desplugada do CS Unplugged):
// o Bitinho está preso no alto de uma torre e manda uma frase acendendo 5 janelas.
// Cada letra é um número em binário: janela acesa = 1, apagada = 0; A=1, B=2 … Z=26; tudo apagado = espaço.
// O aluno decifra letra por letra até descobrir a frase. Na última fase ele responde, acendendo as janelas.

const TOWER_LEVELS = [
  { name: 'Primeiro sinal', phrase: 'OLA', labels: true, table: true, input: 'options' },
  { name: 'Pedido de ajuda', phrase: 'SOCORRO', labels: true, table: true, input: 'options' },
  { name: 'Onde ele está?', phrase: 'ESTOU NA TORRE', labels: true, table: true, input: 'options' },
  { name: 'Sem os valores', phrase: 'ABRA A PORTA', labels: false, table: true, input: 'options' },
  { name: 'Teclado secreto', phrase: 'TRAGA A CHAVE', labels: true, table: true, input: 'keyboard' },
  { name: 'Mensagem final', phrase: 'VOCE E UM GENIO', labels: false, table: false, input: 'keyboard' },
  { name: 'Responda!', phrase: 'VOU TE SALVAR', labels: true, table: true, input: 'reply', reply: true },
];

const Tower = (() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const VALUES = [16, 8, 4, 2, 1];
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const num = (ch) => (ch === ' ' ? 0 : ch.charCodeAt(0) - 64);
  const bits = (n) => VALUES.map((v) => (n & v ? 1 : 0));
  const show = (ch) => (ch === ' ' ? '␣' : ch);
  let L = null, st = null, onEnd = null, timers = [];
  const later = (ms, f) => timers.push(setTimeout(f, ms));

  function start(level, cb) {
    stop();
    L = level;
    onEnd = cb;
    st = { i: 0, errors: 0, letterErrors: 0, score: 0, streak: 0, best: 0, lit: [0, 0, 0, 0, 0], done: false, busy: false };
    Sound.stopMusic();
    Sound.setKey('sunset');
    $('tw-title').textContent = `Torre ${L.id} · ${L.name}`;
    $('tw-hint').innerHTML = L.reply
      ? 'Agora é você! <b>Acenda as janelas</b> para mandar cada letra.'
      : 'Janela <b>acesa = 1</b> · apagada = 0 · <b>A = 1, B = 2…</b>';
    $('tw-scene').classList.toggle('reply', !!L.reply);
    $('tw-labels').classList.toggle('hidden', !L.labels);
    buildTable();
    buildCity();
    RobotView.set($('tw-robot'), () => Store.data.equip.robot, () => (st && st.done ? 'cheer' : st && st.sad > 0 ? 'sad' : 'happy'));
    $('tw-robot').classList.toggle('reply', !!L.reply);
    showLetter(true);
  }

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    st = null;
  }

  // ---------- Cena ----------
  function buildCity() {
    // janelas pequenas e aleatórias dos andares de baixo (só enfeite)
    const f = $('tw-floors');
    let html = '';
    for (let i = 0; i < 24; i++) html += `<i class="${Math.random() < 0.3 ? 'on' : ''}"></i>`;
    f.innerHTML = html;
  }

  function buildTable() {
    const t = $('tw-table');
    t.classList.toggle('hidden', !L.table);
    t.innerHTML = ABC.split('').map((c, i) => `<span><b>${c}</b>${i + 1}</span>`).join('') + '<span class="sp"><b>␣</b>0</span>';
  }

  const cur = () => L.phrase[st.i];

  function setWindows(arr, cls = '') {
    document.querySelectorAll('#tw-windows .tw-win').forEach((w, k) => {
      w.classList.toggle('on', !!arr[k]);
      w.classList.remove('flash', 'bad', 'good');
      if (cls) { void w.offsetWidth; w.classList.add(cls); }
    });
  }

  function showLetter(first) {
    renderPhrase();
    updateHud();
    if (st.i >= L.phrase.length) return finishLevel();
    const ch = cur();
    st.letterErrors = 0;
    if (L.reply) {
      st.lit = [0, 0, 0, 0, 0];
      setWindows(st.lit);
      $('tw-target').innerHTML = `Mande a letra <b>${show(ch)}</b>${ch === ' ' ? ' (espaço)' : ''}`;
      renderReplyControls();
      return;
    }
    // apaga tudo e acende a próxima letra (pisca como um sinal)
    setWindows([0, 0, 0, 0, 0]);
    later(first ? 300 : 220, () => {
      if (!st) return;
      setWindows(bits(num(ch)), 'flash');
      Sound.tick();
    });
    $('tw-target').innerHTML = '';
    renderAnswers();
  }

  function renderPhrase() {
    const box = $('tw-phrase');
    // agrupa por palavra para a quebra de linha nunca cortar uma palavra no meio
    let k = 0, html = '';
    L.phrase.split(' ').forEach((word, wi) => {
      if (wi > 0) { html += `<span class="space ${k === st.i ? 'cur' : ''}"></span>`; k++; }
      html += '<span class="word">' + word.split('').map((ch) => {
        const cls = k < st.i ? 'ok' : k === st.i ? 'cur' : '';
        const txt = k < st.i ? ch : '?';
        k++;
        return `<span class="${cls}">${txt}</span>`;
      }).join('') + '</span>';
    });
    box.innerHTML = html;
  }

  function updateHud() {
    const total = L.phrase.length;
    $('tw-prog').textContent = `${Math.min(st.i, total)}/${total}`;
    $('tw-prog-fill').style.width = (100 * Math.min(st.i, total) / total) + '%';
    $('tw-score').textContent = st.score.toLocaleString('pt-BR');
  }

  // ---------- Respostas: 4 opções ou teclado ----------
  function renderAnswers() {
    const box = $('tw-answers');
    const ch = cur();
    if (L.input === 'options') {
      const n = num(ch);
      const set = new Set([ch]);
      const near = [];
      for (let k = 0; k < 5; k++) near.push(n ^ (1 << k));   // um bit trocado: erro comum
      near.push(n + 1, n - 1);
      near.sort(() => Math.random() - 0.5);
      for (const v of near) { if (set.size >= 4) break; if (v >= 0 && v <= 26) set.add(v === 0 ? ' ' : ABC[v - 1]); }
      while (set.size < 4) set.add(ABC[Math.floor(Math.random() * 26)]);
      const opts = [...set].sort(() => Math.random() - 0.5);
      box.className = 'tw-answers options';
      box.innerHTML = opts.map((o) => `<button class="opt tw-opt" data-ch="${o}"><b>${o === ' ' ? 'espaço' : o}</b></button>`).join('');
    } else {
      box.className = 'tw-answers keyboard';
      box.innerHTML = ABC.split('').map((c) => `<button class="tw-key" data-ch="${c}">${c}</button>`).join('') + '<button class="tw-key space" data-ch=" ">espaço</button>';
    }
    box.querySelectorAll('button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!b.disabled) answer(b.dataset.ch, b); }));
  }

  function answer(ch, btn) {
    if (!st || st.done || st.busy) return;
    const right = cur();
    if (ch === right) {
      btn.classList.add('ok');
      correct();
    } else {
      btn.classList.add('bad');
      btn.disabled = true;
      wrong(`<b>${ch === ' ' ? 'espaço' : ch}</b> seria ${num(ch)} = ${bits(num(ch)).join('')}`, 'Compare com as janelas acesas!');
    }
  }

  function correct() {
    st.busy = true;
    const clean = st.letterErrors === 0;
    st.score += clean ? 150 : 80;
    st.streak = clean ? st.streak + 1 : 0;
    st.best = Math.max(st.best, st.streak);
    setWindows(bits(num(cur())), 'good');
    Sound.letter();
    buzz(12);
    later(450, () => {
      if (!st) return;
      st.busy = false;
      st.i++;
      showLetter(false);
    });
  }

  function wrong(main, sub) {
    st.errors++;
    st.letterErrors++;
    st.streak = 0;
    st.sad = 1;
    later(1200, () => { if (st) st.sad = 0; });
    Sound.wrong();
    buzz(30);
    toast(main, sub);
    document.querySelectorAll('#tw-windows .tw-win').forEach((w) => { w.classList.remove('bad'); void w.offsetWidth; w.classList.add('bad'); });
  }

  // ---------- Fase de resposta: o aluno acende as janelas ----------
  function renderReplyControls() {
    const box = $('tw-answers');
    box.className = 'tw-answers reply';
    box.innerHTML = '<div class="tw-sum" id="tw-sum">= 0</div><button class="fire-btn tw-send" id="tw-send">Enviar sinal</button>';
    $('tw-send').addEventListener('pointerdown', (e) => { e.preventDefault(); send(); });
    updateSum();
  }
  function updateSum() {
    const n = st.lit.reduce((a, b, k) => a + b * VALUES[k], 0);
    const el = $('tw-sum');
    if (el) el.innerHTML = `${st.lit.join('')} = <b>${n}</b>` + (n >= 1 && n <= 26 ? ` = ${ABC[n - 1]}` : n === 0 ? ' = espaço' : ' (não é letra)');
  }
  function toggleWindow(k) {
    if (!st || !L.reply || st.done || st.busy) return;
    st.lit[k] ^= 1;
    if (st.lit[k]) { Sound.bitOn(VALUES[k]); buzz(10); } else Sound.bitOff(VALUES[k]);
    setWindows(st.lit);
    updateSum();
  }
  function send() {
    if (!st || st.done || st.busy) return;
    const n = st.lit.reduce((a, b, k) => a + b * VALUES[k], 0);
    const want = num(cur());
    if (n === want) correct();
    else {
      const got = n === 0 ? 'espaço' : n <= 26 ? ABC[n - 1] : 'nenhuma letra';
      wrong(`Você mandou ${st.lit.join('')} = ${n} (${got})`, `A letra ${show(cur())} é ${want}: ${want ? VALUES.filter((v) => want & v).join(' + ') : 'tudo apagado'}`);
    }
  }
  document.querySelectorAll('#tw-windows .tw-win').forEach((w, k) => w.addEventListener('pointerdown', (e) => { e.preventDefault(); toggleWindow(k); }));

  // ---------- Fim ----------
  function finishLevel() {
    st.done = true;
    $('tw-answers').innerHTML = '';
    $('tw-target').innerHTML = '';
    const b = $('tw-banner');
    b.textContent = `“${L.phrase}”`;
    b.className = 'tw-banner show';
    $('tw-scene').classList.add('party');
    Sound.word();
    Missions.track('tower');
    // as janelas piscam em festa
    for (let k = 0; k < 8; k++) later(k * 160, () => setWindows(bits([31, 21, 10, 31, 0, 31, 21, 10][k]), 'flash'));
    later(2600, () => {
      $('tw-banner').className = 'tw-banner';
      $('tw-scene').classList.remove('party');
      const letters = L.phrase.length;
      const acc = letters / (letters + st.errors);
      const r = { level: L, win: true, hits: letters, errors: st.errors, misses: 0, acc, score: st.score, best: st.best, eff: 1 };
      const cb = onEnd;
      stop();
      if (cb) cb(r);
    });
  }

  let toastTimer = 0;
  function toast(main, sub) {
    const t = $('tw-toast');
    t.innerHTML = `<div>${main}</div>${sub ? `<small>${sub}</small>` : ''}`;
    t.className = 'px-toast tw-toast show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'px-toast tw-toast'; }, 2400);
  }

  // teclado do computador
  window.addEventListener('keydown', (e) => {
    if (!st || st.done || !$('tower').classList.contains('active')) return;
    if (L.reply) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 5) toggleWindow(n - 1);
      if (e.key === 'Enter') send();
      return;
    }
    const k = e.key === ' ' ? ' ' : e.key.toUpperCase();
    if (k.length !== 1 || !(ABC.includes(k) || k === ' ')) return;
    e.preventDefault();
    const b = [...document.querySelectorAll('#tw-answers button')].find((x) => x.dataset.ch === k && !x.disabled);
    if (b) answer(k, b);
  });

  return { start, stop };
})();
