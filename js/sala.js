// Ranking da Sala (Supabase): o professor cria um código, os alunos entram com o primeiro nome,
// e a sala mostra só os 5 melhores do dia na Missão Relâmpago.
const Sala = (() => {
  'use strict';
  const body = document.getElementById('class-body');
  const ready = () => !!(SUPABASE.url && SUPABASE.key);
  const tidy = (s) => String(s || '').trim().replace(/\s+/g, ' ');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toLocaleString('pt-BR');

  async function rpc(fn, args) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(SUPABASE.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { apikey: SUPABASE.key, Authorization: 'Bearer ' + SUPABASE.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const txt = await res.text();
      return txt ? JSON.parse(txt) : null;
    } finally { clearTimeout(timer); }
  }

  const offline = (e) => (/HTTP 404/.test(e.message)
    ? 'O ranking ainda não foi ligado. Professor(a): rode o arquivo supabase/tapbit.sql no Supabase.'
    : 'Sem conexão com o ranking agora. Tente de novo daqui a pouco.');

  // Envia a pontuação do Relâmpago (o banco guarda só a melhor do dia).
  async function submit(pontos) {
    const p = Store.data.profile;
    if (!ready() || !p || !pontos) return false;
    try { await rpc('tapbit_enviar', { p_codigo: p.sala, p_nome: p.nome, p_pontos: Math.min(1000000, Math.floor(pontos)) }); return true; }
    catch (e) { return false; }
  }

  function render() {
    if (!ready()) {
      body.innerHTML = '<div class="panel"><p>O ranking da sala está desligado neste jogo.</p><p class="muted">Professor(a): veja como ligar no arquivo README do TapBit.</p></div>';
      return;
    }
    const p = Store.data.profile;
    body.innerHTML = '';
    if (p) renderRoom(p); else renderJoin();
    renderTeacher();
  }

  function renderJoin() {
    const box = document.createElement('div');
    box.className = 'panel';
    box.innerHTML = `
      <h4>Entrar na sala</h4>
      <label class="field-l">Código da sala<input id="join-code" maxlength="5" autocapitalize="characters" autocomplete="off" placeholder="EX: K7P2Q"></label>
      <label class="field-l">Seu primeiro nome<input id="join-name" maxlength="20" autocomplete="off" placeholder="Ex: Ana"></label>
      <p class="muted small">Só aparecem os 5 melhores do dia. Use só o primeiro nome.</p>
      <button class="big-btn primary" id="join-go">Entrar</button>
      <p class="msg" id="join-msg"></p>`;
    body.appendChild(box);
    const code = box.querySelector('#join-code');
    code.addEventListener('input', () => { code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    box.querySelector('#join-go').addEventListener('click', async () => {
      const c = code.value.trim().toUpperCase();
      const n = tidy(box.querySelector('#join-name').value);
      const msg = box.querySelector('#join-msg');
      if (!/^[A-Z2-9]{5}$/.test(c)) { msg.textContent = 'O código tem 5 letras/números.'; return; }
      if (n.length < 2) { msg.textContent = 'Escreva seu primeiro nome.'; return; }
      msg.textContent = 'Procurando a sala…';
      try {
        const nome = await rpc('tapbit_sala', { p_codigo: c });
        if (!nome) { msg.textContent = 'Não achei essa sala. Confira o código com o professor.'; return; }
        Store.data.profile = { sala: c, salaNome: nome, nome: n.charAt(0).toUpperCase() + n.slice(1) };
        Store.save();
        Sound.coin();
        render();
      } catch (e) { msg.textContent = offline(e); }
    });
  }

  function renderRoom(p) {
    const box = document.createElement('div');
    box.className = 'panel';
    box.innerHTML = `
      <div class="room-head"><div><small>Sala</small><b>${esc(p.salaNome)}</b></div><span class="code-tag">${esc(p.sala)}</span></div>
      <p class="muted small">Jogando como <b>${esc(p.nome)}</b> · Top 5 de hoje na Missão Relâmpago</p>
      <ol class="top5" id="top5"><li class="muted">Carregando…</li></ol>
      <button class="big-btn flash" id="room-play">${icon('zap')} Jogar Relâmpago</button>
      <button class="link-btn" id="room-leave">Trocar de sala</button>`;
    body.appendChild(box);
    box.querySelector('#room-play').addEventListener('click', () => UI.startFlash());
    box.querySelector('#room-leave').addEventListener('click', () => { Store.data.profile = null; Store.save(); render(); });
    loadTop(p.sala, box.querySelector('#top5'), p.nome);
    if (Store.data.bestFlashDay === Store.today() && Store.data.bestFlashToday) submit(Store.data.bestFlashToday);
  }

  async function loadTop(code, ol, me) {
    try {
      const rows = await rpc('tapbit_top5', { p_codigo: code }) || [];
      if (!rows.length) { ol.innerHTML = '<li class="muted">Ninguém jogou hoje ainda. Seja o primeiro!</li>'; return; }
      ol.innerHTML = rows.map((r, i) => `<li class="${me && r.nome.toLowerCase() === me.toLowerCase() ? 'me' : ''}"><span class="pos">${i + 1}</span><span class="nm">${esc(r.nome)}</span><b>${fmt(r.pontos)}</b></li>`).join('');
    } catch (e) { ol.innerHTML = `<li class="muted">${offline(e)}</li>`; }
  }

  function renderTeacher() {
    const box = document.createElement('details');
    box.className = 'panel teacher';
    const rooms = Store.data.teacherRooms || [];
    box.innerHTML = `
      <summary>${icon('user')} Sou professor(a)</summary>
      <label class="field-l">Nome da turma<input id="t-name" maxlength="40" placeholder="Ex: 5º ano B"></label>
      <button class="big-btn primary" id="t-create">Criar sala</button>
      <p class="msg" id="t-msg"></p>
      <div id="t-rooms">${rooms.map((r) => `<button class="room-chip" data-code="${esc(r.codigo)}"><b>${esc(r.codigo)}</b> ${esc(r.nome)}</button>`).join('')}</div>
      <div id="t-view"></div>`;
    body.appendChild(box);
    if (rooms.length) box.open = false;
    box.querySelector('#t-create').addEventListener('click', async () => {
      const n = tidy(box.querySelector('#t-name').value);
      const msg = box.querySelector('#t-msg');
      if (n.length < 2) { msg.textContent = 'Dê um nome para a turma.'; return; }
      msg.textContent = 'Criando…';
      try {
        const codigo = await rpc('tapbit_criar_sala', { p_nome: n });
        Store.data.teacherRooms = [{ codigo, nome: n }].concat(rooms).slice(0, 8);
        Store.save();
        render();
        const d = body.querySelector('details.teacher');
        d.open = true;
        showRoom(d, codigo, n);
      } catch (e) { msg.textContent = offline(e); }
    });
    box.querySelectorAll('.room-chip').forEach((b) => b.addEventListener('click', () => {
      const r = rooms.find((x) => x.codigo === b.dataset.code);
      showRoom(box, r.codigo, r.nome);
    }));
  }

  function showRoom(box, codigo, nome) {
    const v = box.querySelector('#t-view');
    const url = location.href.split('#')[0].split('?')[0];
    v.innerHTML = `
      <div class="t-room">
        <small>${esc(nome)}</small>
        <div class="big-code">${esc(codigo)}</div>
        <p class="muted small">Mostre o código para a turma. O QR abre o jogo:</p>
        <div class="qr" id="qr"></div>
        <p class="muted small url">${esc(url)}</p>
        <h4>Top 5 de hoje</h4>
        <ol class="top5" id="t-top5"><li class="muted">Carregando…</li></ol>
      </div>`;
    loadTop(codigo, v.querySelector('#t-top5'));
    QR.render(v.querySelector('#qr'), url);
  }

  return { render, submit };
})();

// QR Code do link do jogo (biblioteca carregada só quando o professor precisa).
const QR = (() => {
  let loading = null;
  function lib() {
    if (window.QRCode) return Promise.resolve();
    if (!loading) {
      loading = new Promise((ok, fail) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        s.onload = ok; s.onerror = fail;
        document.head.appendChild(s);
      });
    }
    return loading;
  }
  async function render(el, text) {
    try {
      await lib();
      el.innerHTML = '';
      new window.QRCode(el, { text, width: 180, height: 180, colorDark: '#0b1026', colorLight: '#ffffff' });
    } catch (e) { el.textContent = ''; }
  }
  return { render };
})();
