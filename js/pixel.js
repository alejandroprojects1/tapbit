// Mundo dos Pixels: a tela do computador é uma grade de quadradinhos (pixels).
// Cada linha tem um código de 0 e 1: 1 acende o quadrado, 0 deixa apagado.
// Linha por linha, o aluno acende os pixels certos; no fim, a imagem secreta aparece colorida.
// Nas fases "Números secretos" a linha vem em decimal e as colunas valem 16, 8, 4, 2 e 1.

// Cada imagem é desenhada com letras de cor; "." é pixel apagado (0), qualquer letra é aceso (1).
const PX_COLORS = {
  r: '#f43f5e', o: '#fb923c', y: '#facc15', g: '#22c55e', b: '#3b82f6', c: '#22d3ee',
  p: '#a855f7', s: '#f9a8d4', w: '#f8fafc', n: '#a16207', k: '#334155',
};

const PIXEL_LEVELS = [
  { name: 'Primeiro pixel', image: 'Mais', art: ['.g.', 'ggg', '.g.'] },
  { name: 'Imagem secreta', image: 'Coração', art: ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'] },
  { name: 'Imagem secreta', image: 'Casinha', art: ['..r..', '.rrr.', 'rrrrr', 'yy.yy', 'yy.yy'] },
  { name: 'Imagem secreta', image: 'Carinha feliz', art: ['.y.y.', '.y.y.', '.....', 'y...y', '.yyy.'] },
  { name: 'Imagem secreta', image: 'Robô', art: ['...r...', '.ccccc.', 'cc.c.cc', 'ccccccc', 'cc...cc', '.ccccc.', '.b...b.'] },
  { name: 'Imagem secreta', image: 'Foguete', art: ['...rr...', '..wwww..', '..wbbw..', '..wwww..', '.rwwwwr.', 'rr.ww.rr', '...oo...', '..o..o..'] },
  { name: 'Imagem secreta', image: 'Gatinho', art: ['o......o', 'oo....oo', 'oooooooo', 'oo.oo.oo', 'oooooooo', 'ooossooo', '.oooooo.', '..oooo..'] },
  { name: 'Imagem secreta', image: 'Árvore', art: ['...gg...', '..gggg..', '.gggggg.', 'gggggggg', '.gggggg.', '...nn...', '...nn...', '..nnnn..'] },
  { name: 'Números secretos', image: 'Flecha', decimal: true, art: ['..b..', '.bbb.', 'b.b.b', '..b..', '..b..'] },
  { name: 'Números secretos', image: 'Estrela', decimal: true, art: ['..y..', 'yyyyy', '.yyy.', '.y.y.', 'y...y'] },
];

// miniatura da imagem (para o mapa e o resultado)
function pixelThumb(art, size = 40) {
  const n = art[0].length, m = art.length;
  const cell = size / Math.max(n, m);
  let rects = '';
  art.forEach((row, y) => row.split('').forEach((ch, x) => {
    if (ch !== '.') rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${(cell * 0.9).toFixed(2)}" height="${(cell * 0.9).toFixed(2)}" rx="${(cell * 0.15).toFixed(2)}" fill="${PX_COLORS[ch] || '#fff'}"/>`;
  }));
  return `<svg class="px-thumb" viewBox="0 0 ${(n * cell).toFixed(2)} ${(m * cell).toFixed(2)}" width="${size}" height="${size}" aria-hidden="true">${rects}</svg>`;
}

const Pixel = (() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const board = $('px-board');
  const VALUES = [16, 8, 4, 2, 1];
  let L = null, st = null, onEnd = null, timers = [];

  const later = (ms, f) => timers.push(setTimeout(f, ms));
  const codeOf = (row) => row.split('').map((ch) => (ch === '.' ? 0 : 1));

  function start(level, cb) {
    stop();
    L = level;
    onEnd = cb;
    const rows = L.art.map(codeOf);
    st = {
      rows, n: rows[0].length, m: rows.length, row: 0,
      lit: rows.map((r) => r.map(() => 0)),
      wrong: 0, needed: rows.flat().reduce((a, b) => a + b, 0), score: 0, streak: 0, best: 0, rowErrors: 0, done: false,
    };
    Sound.stopMusic();
    Sound.setKey('calm');
    $('px-title').textContent = `Pixel ${L.id} · ${L.name}`;
    $('px-hint').innerHTML = L.decimal
      ? 'Número → 0 e 1 · colunas <b>16 8 4 2 1</b>'
      : '<b>1</b> acende o pixel · <b>0</b> deixa apagado';
    build();
    update();
    later(200, () => checkEmptyRow());
  }

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    st = null;
  }

  function build() {
    const { n, m } = st;
    board.style.setProperty('--cols', n);
    board.className = 'px-board' + (L.decimal ? ' decimal' : '') + (n >= 7 ? ' big' : '');
    let html = '';
    if (L.decimal) {
      html += '<span class="px-code head"></span>' + VALUES.map((v) => `<span class="px-col">${v}</span>`).join('');
    }
    for (let y = 0; y < m; y++) {
      html += `<span class="px-code" data-row="${y}"></span>`;
      for (let x = 0; x < n; x++) html += `<button class="px-cell" data-x="${x}" data-y="${y}" aria-label="Pixel linha ${y + 1}, coluna ${x + 1}"></button>`;
    }
    board.innerHTML = html;
    board.querySelectorAll('.px-cell').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(+b.dataset.x, +b.dataset.y); }));
  }

  const cell = (x, y) => board.querySelector(`.px-cell[data-x="${x}"][data-y="${y}"]`);
  const rowValue = (code) => code.reduce((a, b) => a * 2 + b, 0);

  function tap(x, y) {
    if (!st || st.done || y !== st.row) {
      if (st && !st.done && y > st.row) nudge();
      return;
    }
    const want = st.rows[y][x];
    const now = st.lit[y][x] ^ 1;
    st.lit[y][x] = now;
    const v = VALUES[x % 5];
    if (now) { Sound.bitOn(v); buzz(10); } else Sound.bitOff(v);
    if (now !== want) {
      // acendeu onde é 0, ou apagou onde é 1
      st.wrong++;
      st.rowErrors++;
      const c = cell(x, y);
      c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
      if (now) toast(L.decimal
        ? `O <b>${rowValue(st.rows[y])}</b> não usa o <b>${VALUES[x]}</b>: este pixel fica apagado.`
        : `Aqui o código é <b>0</b>: este pixel fica apagado.`);
    }
    update();
    if (st.lit[y].every((b, i) => b === st.rows[y][i])) lockRow();
  }

  function nudge() {
    const r = board.querySelector(`.px-code[data-row="${st.row}"]`);
    if (r) { r.classList.remove('pulse'); void r.offsetWidth; r.classList.add('pulse'); }
  }

  function lockRow() {
    const y = st.row;
    const clean = st.rowErrors === 0;
    st.score += 100 + (clean ? 50 : 0);
    st.streak = clean ? st.streak + 1 : 0;
    st.best = Math.max(st.best, st.streak);
    st.rowErrors = 0;
    Sound.letter();
    for (let x = 0; x < st.n; x++) {
      const c = cell(x, y);
      c.classList.add('locked');
    }
    st.row++;
    update();
    if (st.row >= st.m) reveal();
    else later(250, () => checkEmptyRow());
  }

  // linha toda de zeros: não há nada para acender, ela passa sozinha
  function checkEmptyRow() {
    if (!st || st.done || st.row >= st.m) return;
    if (st.rows[st.row].every((b) => b === 0)) {
      toast(`Linha <b>${st.rows[st.row].join('')}</b>: tudo apagado!`);
      later(900, () => { if (st && !st.done) lockRow(); });
    }
  }

  function update() {
    const { n, m } = st;
    for (let y = 0; y < m; y++) {
      const code = st.rows[y];
      const lab = board.querySelector(`.px-code[data-row="${y}"]`);
      lab.classList.toggle('active', y === st.row && !st.done);
      lab.classList.toggle('done', y < st.row);
      if (L.decimal) {
        lab.innerHTML = `<b>${rowValue(code)}</b>` + (y < st.row ? `<small>${code.join('')}</small>` : '');
      } else {
        lab.innerHTML = code.map((d, i) => `<i class="${y <= st.row && st.lit[y][i] === d && (d === 1 || y < st.row) ? 'ok' : ''}">${d}</i>`).join('');
      }
      for (let x = 0; x < n; x++) {
        const c = cell(x, y);
        c.classList.toggle('on', !!st.lit[y][x]);
        c.classList.toggle('row', y === st.row && !st.done);
        c.classList.toggle('bad', y === st.row && !!st.lit[y][x] && !code[x]);
      }
    }
    $('px-prog').textContent = `${Math.min(st.row, m)}/${m}`;
    $('px-prog-fill').style.width = (100 * Math.min(st.row, m) / m) + '%';
    $('px-score').textContent = st.score.toLocaleString('pt-BR');
    const cur = $('px-current');
    if (st.done || st.row >= m) { cur.innerHTML = '<span class="px-cur-label">Imagem completa!</span>'; return; }
    const code = st.rows[st.row];
    cur.innerHTML = `<span class="px-cur-label">Linha ${st.row + 1}</span>` + (L.decimal
      ? `<span class="px-cur-num">= ${rowValue(code)}</span>`
      : `<span class="px-cur-code">${code.map((d, i) => `<i class="${st.lit[st.row][i] === d && d === 1 ? 'ok' : ''} ${d ? 'one' : ''}">${d}</i>`).join('')}</span>`);
  }

  let toastTimer = 0;
  function toast(html) {
    const t = $('px-toast');
    t.innerHTML = html;
    t.className = 'px-toast show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'px-toast'; }, 1800);
  }

  // revelação: os pixels ganham as cores da imagem, numa onda diagonal
  function reveal() {
    st.done = true;
    update();
    board.classList.add('revealed');
    for (let y = 0; y < st.m; y++) {
      for (let x = 0; x < st.n; x++) {
        const ch = L.art[y][x];
        const c = cell(x, y);
        later((x + y) * 55, () => {
          if (ch !== '.') { c.style.setProperty('--px', PX_COLORS[ch] || '#fff'); c.classList.add('paint'); }
          else c.classList.add('off');
        });
      }
    }
    const total = (st.n + st.m) * 55;
    later(total + 150, () => {
      const b = $('px-banner');
      b.textContent = L.image + '!';
      b.className = 'px-banner show';
      Sound.word();
      Missions.track('pixel');
    });
    later(total + 1900, () => {
      $('px-banner').className = 'px-banner';
      const acc = st.needed ? st.needed / (st.needed + st.wrong) : 1;
      const r = { level: L, win: true, hits: st.m, errors: st.wrong, misses: 0, acc, score: st.score, best: st.best, eff: 1 };
      const cb = onEnd;
      stop();
      if (cb) cb(r);
    });
  }

  return { start, stop };
})();
