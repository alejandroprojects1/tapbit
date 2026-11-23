// Telas, menus e fluxo entre as fases.
const UI = (() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let current = null;       // fase em jogo

  // ---------- Telas ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    if (id === 'home') renderHome();
    if (id === 'map') renderMap();
    if (id === 'shop') Shop.render();
    if (id === 'missions') renderMissions();
    if (id === 'class') Sala.render();
    refreshCoins();
    window.scrollTo(0, 0);
  }

  function refreshCoins() {
    document.querySelectorAll('.coins-view').forEach((e) => { e.textContent = Store.data.coins; });
    $('home-coins').textContent = Store.data.coins;
  }
  function flashCoins() {
    document.querySelectorAll('.coins-view').forEach((e) => {
      const chip = e.closest('.chip');
      chip.classList.remove('shake'); void chip.offsetWidth; chip.classList.add('shake');
    });
  }
  function coinPop(n) {
    const el = $('coin-pop');
    el.innerHTML = `<i class="coin"></i>+${n}`;
    el.className = 'coin-pop';
    void el.offsetWidth;
    el.className = 'coin-pop show';
  }

  function applyTheme() {
    const t = Store.data.equip.theme;
    document.body.className = document.body.className.replace(/\btheme-\w+/g, '').trim() + ' theme-' + t;
  }

  // ---------- Início ----------
  function renderHome() {
    $('home-stars').textContent = Store.totalStars();
    $('home-streak').textContent = Store.streak();
    $('missions-dot').classList.toggle('hidden', !Missions.pending());
  }

  // ---------- Mapa ----------
  function renderMap() {
    document.querySelectorAll('.mode-switch button').forEach((b) => {
      const on = b.dataset.mode === Store.data.mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on);
    });
    const box = $('sectors');
    box.innerHTML = '';
    SECTORS.forEach((s) => {
      const open = isUnlocked(s.levels[0]);
      const got = s.levels.reduce((a, l) => a + (Store.data.stars[l.id] || 0), 0);
      const card = document.createElement('div');
      card.className = 'sector' + (open ? '' : ' locked');
      card.style.setProperty('--sc', s.color);
      card.innerHTML = `
        <div class="sector-head">
          <span class="sector-ico">${open ? s.icon : '🔒'}</span>
          <div><small>SETOR ${s.id}</small><b>${s.name}</b></div>
          <span class="sector-stars"><i class="star"></i>${got}/${s.levels.length * 3}</span>
        </div>
        <p>${s.desc}</p>
        <div class="nodes"></div>`;
      const nodes = card.querySelector('.nodes');
      s.levels.forEach((l, i) => {
        const b = document.createElement('button');
        const un = isUnlocked(l);
        const stars = Store.data.stars[l.id] || 0;
        b.className = 'node' + (un ? '' : ' locked') + (stars ? ' done' : '') + (s.id === 4 ? ' boss' : '');
        b.innerHTML = `<b>${un ? (s.id === 4 ? '👾' : i + 1) : '🔒'}</b><span class="mini-stars">${[0, 1, 2].map((k) => `<i class="${k < stars ? 'on' : ''}"></i>`).join('')}</span>`;
        b.title = l.name;
        b.setAttribute('aria-label', `Fase ${l.id}: ${l.name}${un ? '' : ' (bloqueada)'}`);
        if (un) b.addEventListener('click', () => { Sound.click(); startLevel(l); });
        else b.disabled = true;
        nodes.appendChild(b);
      });
      box.appendChild(card);
    });
  }

  document.querySelectorAll('.mode-switch button').forEach((b) => b.addEventListener('click', () => {
    Store.data.mode = b.dataset.mode;
    Store.save();
    Sound.click();
    renderMap();
  }));

  // ---------- Jogar ----------
  function startLevel(l) {
    if (!Store.data.tutorial && l.kind === 'build') {
      Tutorial.open(() => startLevel(l));
      return;
    }
    current = l;
    $('result').classList.add('hidden');
    $('pause').classList.add('hidden');
    show('game');
    requestAnimationFrame(() => Game.start(l, finish));
  }

  function startFlash() { startLevel(flashLevel()); }

  function finish(r) {
    const l = r.level;
    const isFlash = l.id === 'flash';
    Game.stop();
    Store.markPlayed();
    let coins = 0, stars = 0, improved = false;
    if (isFlash) {
      coins = Math.floor(r.score / 100);
      Missions.track('flash');
      if (r.score > Store.data.bestFlash) { Store.data.bestFlash = r.score; improved = true; }
      if (Store.data.bestFlashDay !== Store.today()) { Store.data.bestFlashDay = Store.today(); Store.data.bestFlashToday = 0; }
      Store.data.bestFlashToday = Math.max(Store.data.bestFlashToday || 0, r.score);
      Sala.submit(r.score);
    } else if (r.win) {
      stars = r.acc >= 0.85 ? 3 : r.acc >= 0.6 ? 2 : 1;
      const prev = Store.data.stars[l.id] || 0;
      coins = 5 + stars * 5 + (prev === 0 ? 20 : 0) + Math.max(0, stars - prev) * 5;
      if (stars > prev) { Store.data.stars[l.id] = stars; improved = true; }
      Missions.track('stars', { stars });
    }
    Store.addCoins(coins);
    Store.save();
    showResult(r, stars, coins, improved);
  }

  function showResult(r, stars, coins, improved) {
    const l = r.level;
    const isFlash = l.id === 'flash';
    const ov = $('result');
    ov.classList.remove('hidden');
    const pct = Math.round(r.acc * 100);
    $('res-title').textContent = isFlash ? '⚡ Tempo esgotado!' : r.win ? (l.kind === 'letters' ? 'Chefe derrotado!' : 'Setor protegido!') : 'O escudo caiu!';
    RobotView.set($('result-robot'), () => Store.data.equip.robot, r.win || isFlash ? 'cheer' : 'sad');
    const starsEl = $('res-stars');
    starsEl.classList.toggle('hidden', isFlash || !r.win);
    starsEl.querySelectorAll('i').forEach((s, i) => {
      s.className = '';
      if (i < stars) setTimeout(() => { s.className = 'on'; Sound.star(i); }, 350 + i * 300);
    });
    const rows = isFlash
      ? [['Pontos', r.score.toLocaleString('pt-BR')], ['Acertos', r.hits], ['Recorde', Store.data.bestFlash.toLocaleString('pt-BR') + (improved ? ' 🆕' : '')]]
      : [['Precisão', pct + '%'], ['Acertos', r.hits], ['Erros', r.errors + r.misses], ['Maior combo', r.best], ['Pontos', r.score.toLocaleString('pt-BR')]];
    $('res-stats').innerHTML = rows.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
    $('res-coins').innerHTML = coins ? `<i class="coin"></i>+${coins} Byte-Coins` : '';
    if (coins) setTimeout(() => Sound.coin(), 1300);
    $('res-tip').textContent = tipFor(r);
    const next = nextLevel(l);
    const nb = $('btn-next');
    nb.classList.toggle('hidden', isFlash || !r.win || !next || !isUnlocked(next));
    nb.onclick = () => startLevel(next);
    $('btn-again').onclick = () => startLevel(isFlash ? flashLevel() : l);
    $('btn-tomap').onclick = () => show(isFlash ? 'home' : 'map');
    $('btn-tomap').textContent = isFlash ? 'Início' : 'Mapa';
  }

  function tipFor(r) {
    const l = r.level;
    if (l.id === 'flash') return Store.data.profile ? `Sua pontuação foi para a sala ${Store.data.profile.sala}.` : 'Entre numa sala (🏆) para aparecer no ranking da turma!';
    if (!r.win) {
      if (l.kind === 'decode') return 'Dica: some só os valores dos bits que estão em 1.';
      if (l.kind === 'letters') return 'Dica: transforme o código em número e procure na tabela (A=1).';
      return 'Dica: comece pelo maior bit que cabe no número.';
    }
    if (l.kind === 'build' && r.eff < 0.8) return 'Para 3 estrelas: tente acertar sem ligar e desligar bits à toa.';
    if (r.acc >= 0.85) return 'Perfeito, Guardião!';
    return 'Para mais estrelas, erre menos. Pense antes de disparar!';
  }

  // ---------- Pausa ----------
  $('btn-pause').addEventListener('click', () => { Game.pause(true); $('pause').classList.remove('hidden'); });
  $('btn-resume').addEventListener('click', () => { $('pause').classList.add('hidden'); Game.pause(false); });
  $('btn-restart').addEventListener('click', () => { Game.stop(); startLevel(current.id === 'flash' ? flashLevel() : current); });
  $('btn-quit').addEventListener('click', () => { Game.stop(); $('pause').classList.add('hidden'); show(current && current.id === 'flash' ? 'home' : 'map'); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && Game.running) { Game.pause(true); $('pause').classList.remove('hidden'); }
  });

  // ---------- Missões ----------
  function renderMissions() {
    const s = Store.streak();
    $('streak-days').textContent = s === 1 ? '1 dia' : `${s} dias`;
    const week = $('week');
    week.innerHTML = '';
    const names = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    for (let i = 6; i >= 0; i--) {
      const key = Store.shiftDay(Store.today(), -i);
      const [y, m, d] = key.split('-').map(Number);
      const day = new Date(y, m - 1, d).getDay();
      const on = Store.data.days.includes(key);
      week.insertAdjacentHTML('beforeend', `<div class="day ${on ? 'on' : ''} ${i === 0 ? 'today' : ''}"><small>${names[day]}</small><span>${on ? '🔥' : '·'}</span></div>`);
    }
    const list = $('mission-list');
    list.innerHTML = '';
    Missions.today().forEach((m) => {
      const done = m.progress >= m.goal;
      const el = document.createElement('div');
      el.className = 'mission' + (done ? ' done' : '') + (m.claimed ? ' claimed' : '');
      el.innerHTML = `
        <div class="m-text"><b>${m.text}</b><small>💡 ${m.hint}</small>
          <div class="m-bar"><i style="width:${100 * m.progress / m.goal}%"></i><span>${m.progress}/${m.goal}</span></div></div>
        <button class="m-btn" ${done && !m.claimed ? '' : 'disabled'}>${m.claimed ? '✔' : `<i class="coin"></i>${m.reward}`}</button>`;
      el.querySelector('.m-btn').addEventListener('click', () => {
        const got = Missions.claim(m.id);
        if (got) { Sound.coin(); coinPop(got); renderMissions(); refreshCoins(); }
      });
      list.appendChild(el);
    });
    const r = flashRule();
    $('flash-rule').textContent = `Hoje: ${r.name} · 1 minuto`;
    $('flash-best').textContent = `Recorde: ${Store.data.bestFlash.toLocaleString('pt-BR')}`;
  }

  Missions.onDone = (def) => {
    const b = $('banner');
    if (b && $('game').classList.contains('active')) {
      setTimeout(() => {
        const t = $('toast');
        t.className = 'toast show good';
        t.innerHTML = `<div>🎯 Missão cumprida!</div><small>${def.text}</small>`;
        setTimeout(() => { t.className = 'toast'; }, 2200);
      }, 700);
    }
  };

  // ---------- Configurações ----------
  const settings = $('settings');
  function openSettings() {
    $('set-sound').checked = Store.data.sound;
    $('set-music').checked = Store.data.music;
    $('set-vibe').checked = Store.data.vibe;
    $('set-unlock').checked = Store.data.unlockAll;
    settings.classList.remove('hidden');
  }
  ['sound', 'music', 'vibe', 'unlock'].forEach((k) => $('set-' + k).addEventListener('change', (e) => {
    Store.data[k === 'unlock' ? 'unlockAll' : k] = e.target.checked;
    Store.save();
    Sound.apply();
    if (k === 'vibe' && e.target.checked) buzz(30);
  }));
  $('btn-close-settings').addEventListener('click', () => { settings.classList.add('hidden'); renderHome(); });
  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Apagar estrelas, moedas e skins deste aparelho?')) return;
    Store.reset();
    applyTheme();
    settings.classList.add('hidden');
    show('home');
  });

  // ---------- Botões do menu ----------
  $('btn-settings').addEventListener('click', () => { Sound.click(); openSettings(); });
  $('btn-play').addEventListener('click', () => { Sound.click(); show('map'); });
  $('btn-flash').addEventListener('click', () => { Sound.click(); startFlash(); });
  $('btn-flash2').addEventListener('click', () => { Sound.click(); startFlash(); });
  $('btn-shop').addEventListener('click', () => { Sound.click(); show('shop'); });
  $('btn-missions').addEventListener('click', () => { Sound.click(); show('missions'); });
  $('btn-class').addEventListener('click', () => { Sound.click(); show('class'); });
  $('btn-howto').addEventListener('click', () => { Sound.click(); Tutorial.open(null); });
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { Sound.click(); show(b.dataset.go); }));

  // ---------- Início ----------
  RobotView.set($('home-robot'), () => Store.data.equip.robot);
  RobotView.set($('shop-robot'), () => Store.data.equip.robot, 'cheer');
  applyTheme();
  Missions.today();
  show('home');

  return { show, refreshCoins, flashCoins, applyTheme, startFlash };
})();
