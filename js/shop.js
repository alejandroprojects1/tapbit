// Oficina de Skins: robôs, cores de laser e temas dos botões, comprados com Byte-Coins.
const LASERS = {
  ciano: { name: 'Ciano', price: 0, desc: 'O clássico neon' },
  plasma: { name: 'Plasma', price: 80, desc: 'Ondas roxas de energia' },
  pixel: { name: 'Pixel-art', price: 100, desc: 'Blocos de 8 bits' },
  arcoiris: { name: 'Arco-íris', price: 150, desc: 'Todas as cores!' },
};
const THEMES = {
  neon: { name: 'Neon', price: 0, desc: 'Brilho ciano' },
  retro: { name: 'Fliperama', price: 70, desc: 'Botões de arcade' },
  futuro: { name: 'Futurista', price: 90, desc: 'Vidro e cromo' },
  blocos: { name: 'Blocos', price: 110, desc: 'Peças de montar' },
};
const CATALOG = { robot: ROBOTS, laser: LASERS, theme: THEMES };

const Shop = (() => {
  'use strict';
  let tab = 'robot';
  const grid = document.getElementById('shop-grid');

  function owned(cat, id) { return Store.data.owned[cat].includes(id); }

  function preview(cat, id) {
    const box = document.createElement('div');
    box.className = 'item-prev';
    if (cat === 'robot') {
      const cv = document.createElement('canvas');
      cv.width = 84; cv.height = 84;
      cv.className = 'robot-cv';
      box.appendChild(cv);
      RobotView.set(cv, () => id);
    } else if (cat === 'laser') {
      const cv = document.createElement('canvas');
      cv.width = 120; cv.height = 84;
      box.appendChild(cv);
      LaserPreview.add(cv, id);
    } else {
      box.innerHTML = `<div class="theme-demo theme-${id}"><div class="bit on"><span class="val">4</span><span class="ico"></span><span class="digit">1</span></div><div class="bit"><span class="val">2</span><span class="ico"></span><span class="digit">0</span></div></div>`;
    }
    return box;
  }

  function render() {
    document.querySelectorAll('#shop .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    grid.innerHTML = '';
    const items = CATALOG[tab];
    Object.keys(items).forEach((id) => {
      const it = items[id];
      const card = document.createElement('div');
      const has = owned(tab, id);
      const eq = Store.data.equip[tab] === id;
      card.className = 'item' + (eq ? ' equipped' : '');
      card.appendChild(preview(tab, id));
      const info = document.createElement('div');
      info.className = 'item-info';
      info.innerHTML = `<b>${it.name}</b>${it.desc ? `<small>${it.desc}</small>` : ''}`;
      card.appendChild(info);
      const btn = document.createElement('button');
      btn.className = 'item-btn';
      if (eq) { btn.textContent = '✔ Usando'; btn.disabled = true; }
      else if (has) { btn.textContent = 'Usar'; }
      else {
        btn.innerHTML = `<i class="coin"></i>${it.price}`;
        btn.classList.add('buy');
        if (Store.data.coins < it.price) btn.classList.add('poor');
      }
      btn.addEventListener('click', () => act(id));
      card.appendChild(btn);
      grid.appendChild(card);
    });
    UI.refreshCoins();
  }

  function act(id) {
    const it = CATALOG[tab][id];
    if (!owned(tab, id)) {
      if (Store.data.coins < it.price) {
        Sound.wrong();
        UI.flashCoins();
        return;
      }
      Store.data.coins -= it.price;
      Store.data.owned[tab].push(id);
      Sound.coin();
    } else {
      Sound.click();
    }
    Store.data.equip[tab] = id;
    Store.save();
    UI.applyTheme();
    render();
  }

  document.querySelectorAll('#shop .tab').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; Sound.click(); render(); }));

  return { render };
})();

// Pequenas prévias animadas dos lasers na loja.
const LaserPreview = (() => {
  const list = [];
  function add(cv, id) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.width, h = cv.height;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.width = w * dpr; cv.height = h * dpr;
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].cv.isConnected) list.splice(i, 1);
    list.push({ cv, id, w, h, dpr });
  }
  function loop(now) {
    const t = now / 1000;
    list.forEach((p) => {
      if (!p.cv.offsetParent) return;
      const c = p.cv.getContext('2d');
      c.setTransform(p.dpr, 0, 0, p.dpr, 0, 0);
      c.clearRect(0, 0, p.w, p.h);
      drawBeam(c, p.id, 12, p.h - 12, p.w - 14, 14, t, 1);
    });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return { add };
})();

// Desenha um feixe de laser no estilo escolhido (usado no jogo e na loja).
function drawBeam(c, style, x1, y1, x2, y2, t, alpha = 1) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  c.save();
  c.globalAlpha = alpha;
  c.lineCap = 'round';
  if (style === 'pixel') {
    const step = 9;
    const cols = ['#3dff9e', '#ffd23f', '#22e6ff'];
    for (let d = 0, i = 0; d < len; d += step, i++) {
      const x = x1 + dx * d / len, y = y1 + dy * d / len;
      c.fillStyle = cols[(i + Math.floor(t * 12)) % 3];
      c.fillRect(Math.round(x / 3) * 3 - 4, Math.round(y / 3) * 3 - 4, 8, 8);
    }
  } else if (style === 'plasma') {
    for (let pass = 0; pass < 2; pass++) {
      c.beginPath();
      for (let d = 0; d <= len; d += 6) {
        const w = Math.sin(d * 0.08 - t * 25 + pass * Math.PI) * 6 * Math.sin(Math.PI * d / len);
        const x = x1 + dx * d / len + nx * w, y = y1 + dy * d / len + ny * w;
        d === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.strokeStyle = pass ? '#ff4fd8' : '#a78bfa';
      c.lineWidth = 5;
      c.shadowColor = '#ff4fd8'; c.shadowBlur = 14;
      c.stroke();
    }
    c.shadowBlur = 0;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
  } else if (style === 'arcoiris') {
    const g = c.createLinearGradient(x1, y1, x2, y2);
    const off = (t * 0.8) % 1;
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(i * 60 + off * 360) % 360},100%,60%)`);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
    c.strokeStyle = g; c.lineWidth = 12; c.globalAlpha = alpha * 0.45; c.stroke();
    c.globalAlpha = alpha; c.lineWidth = 5; c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
  } else {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
    c.strokeStyle = 'rgba(34,230,255,.35)'; c.lineWidth = 14; c.stroke();
    c.strokeStyle = '#22e6ff'; c.lineWidth = 6; c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 2.5; c.stroke();
  }
  c.restore();
}
