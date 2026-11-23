// Capa do jogo: cena ilustrada viva.
// O céu segue a hora real do aparelho (manhã, tarde, pôr do sol, noite) e o robô do jogador
// flutua sobre um Painel de Bits que conta sozinho em binário, de 1 a 31.
const Cover = (() => {
  'use strict';
  const cv = document.getElementById('cover-cv');
  const ctx = cv.getContext('2d');
  const VALUES = [16, 8, 4, 2, 1];
  let W = 0, H = 0, DPR = 1, raf = 0, last = 0, T = 0;
  let clouds = [], stars = [], glyphs = [];
  let count = 0, nextTick = 0.6, cheer = 0, pressed = [0, 0, 0, 0, 0];

  // paletas por período do dia
  const SKY = {
    manha: { top: '#6ec3ff', mid: '#aee0ff', hor: '#fff1d6', far: '#86c9e6', near: '#55c98a', ground: '#7fd69c', sun: '#fff3b0', sunY: 0.2, night: 0 },
    tarde: { top: '#4ea9ff', mid: '#9fd4ff', hor: '#ffe4b0', far: '#97b8ee', near: '#6fc483', ground: '#98d68a', sun: '#ffd77a', sunY: 0.34, night: 0 },
    poente: { top: '#7c86e0', mid: '#f4afcd', hor: '#ffcf9e', far: '#c08fe0', near: '#8f7ee0', ground: '#b59ae6', sun: '#ff9f7a', sunY: 0.5, night: 0 },
    noite: { top: '#24306f', mid: '#4d58b0', hor: '#8f98e4', far: '#6a73c8', near: '#4f5cb8', ground: '#5d68c2', sun: '#fff6d8', sunY: 0.22, night: 1 },
  };
  function period() {
    const q = location.search.match(/[?&]hora=(\d+)/);   // ?hora=10 força um horário (para testar)
    const h = q ? +q[1] : new Date().getHours();
    if (h >= 6 && h < 11) return 'manha';
    if (h >= 11 && h < 16) return 'tarde';
    if (h >= 16 && h < 19) return 'poente';
    return 'noite';
  }
  let P = SKY[period()];

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    DPR = Math.min(3, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    clouds = Array.from({ length: 4 }, (_, i) => ({ x: Math.random() * W, y: H * (0.08 + i * 0.09), s: 26 + Math.random() * 22, v: 6 + Math.random() * 8 }));
    stars = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.55, r: 0.6 + Math.random() * 1.1, p: Math.random() * 6 }));
  }
  window.addEventListener('resize', resize);

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function cloud(c) {
    ctx.fillStyle = P.night ? 'rgba(200,206,255,.55)' : 'rgba(255,255,255,.95)';
    const s = c.s;
    [[-0.9, 0.15, 0.55], [-0.3, -0.12, 0.75], [0.45, 0, 0.62], [1.0, 0.2, 0.42]].forEach(([dx, dy, k]) => {
      ctx.beginPath(); ctx.ellipse(c.x + dx * s, c.y + dy * s, s * k, s * k * 0.72, 0, 0, Math.PI * 2); ctx.fill();
    });
  }

  function hill(cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    g.addColorStop(0, P.top); g.addColorStop(0.55, P.mid); g.addColorStop(1, P.hor);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    if (P.night) stars.forEach((s) => {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(T * 2 + s.p);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // sol ou lua
    const sx = W * 0.82, sy = H * P.sunY, sr = Math.min(W, H) * 0.09;
    const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 3.2);
    glow.addColorStop(0, P.night ? 'rgba(255,246,216,.35)' : 'rgba(255,240,180,.55)'); glow.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, sr * 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    if (P.night) { ctx.fillStyle = 'rgba(200,190,150,.35)'; ctx.beginPath(); ctx.arc(sx - sr * 0.3, sy - sr * 0.15, sr * 0.22, 0, Math.PI * 2); ctx.fill(); }

    clouds.forEach(cloud);

    // colinas
    const gy = H * 0.8;
    hill(W * 0.15, gy, W * 0.55, H * 0.26, P.far);
    hill(W * 0.85, gy, W * 0.6, H * 0.3, P.far);
    hill(W * 0.5, gy + 4, W * 0.7, H * 0.16, P.near);
    hill(-W * 0.05, gy + 6, W * 0.4, H * 0.18, P.near);
    hill(W * 1.05, gy + 6, W * 0.38, H * 0.15, P.near);
    ctx.fillStyle = P.ground; ctx.fillRect(0, gy, W, H - gy);

    // 0 e 1 flutuando
    ctx.font = `700 ${Math.round(H * 0.06)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    glyphs.forEach((q) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, q.life)) * 0.75;
      ctx.fillStyle = q.ch === '1' ? '#22d3ee' : '#ffffff';
      ctx.fillText(q.ch, q.x, q.y);
    });
    ctx.globalAlpha = 1;

    // Painel de Bits (teclas com volume)
    const kw = Math.min(W * 0.095, H * 0.15, 46), gap = kw * 0.2, kh = kw * 1.1, depth = kw * 0.16;
    const total = kw * 5 + gap * 4, x0 = (W - total) / 2, ky = gy - kh * 0.35;
    // base do painel
    rr(x0 - gap * 1.3, ky - gap, total + gap * 2.6, kh + depth + gap * 2, kw * 0.3);
    ctx.fillStyle = 'rgba(20,24,60,.85)'; ctx.fill();
    VALUES.forEach((v, i) => {
      const on = !!(count & v);
      const x = x0 + i * (kw + gap), press = pressed[i] > 0 ? depth * 0.6 : 0;
      rr(x, ky + depth, kw, kh, kw * 0.22);
      ctx.fillStyle = on ? '#138a80' : '#0b0f2a'; ctx.fill();
      rr(x, ky + press, kw, kh, kw * 0.22);
      if (on) {
        const kg = ctx.createLinearGradient(0, ky, 0, ky + kh);
        kg.addColorStop(0, '#6ef3ff'); kg.addColorStop(1, '#2dd4bf');
        ctx.fillStyle = kg;
        ctx.shadowColor = 'rgba(62,224,255,.8)'; ctx.shadowBlur = kw * 0.4;
      } else ctx.fillStyle = '#262c66';
      ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = on ? '#04323a' : '#8d97c7';
      ctx.font = `600 ${Math.round(kw * 0.26)}px Lexend, sans-serif`;
      ctx.fillText(String(v), x + kw / 2, ky + press + kh * 0.26);
      ctx.font = `700 ${Math.round(kw * 0.44)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = on ? '#04262a' : '#4b5486';
      ctx.fillText(on ? '1' : '0', x + kw / 2, ky + press + kh * 0.66);
    });
    // número formado
    // etiqueta com o número formado, à direita do painel
    const tag = `= ${count}`;
    ctx.font = `800 ${Math.round(kw * 0.5)}px Lexend, sans-serif`;
    const tw = ctx.measureText(tag).width + kw * 0.5, th = kw * 0.78;
    const tx = Math.min(W - tw - 8, x0 + total + gap * 2.4), ty = ky + (kh - th) / 2;
    rr(tx, ty, tw, th, th / 2);
    ctx.fillStyle = count === 31 ? '#fbbf24' : '#ffffff'; ctx.fill();
    ctx.fillStyle = '#1b2156';
    ctx.fillText(tag, tx + tw / 2, ty + th / 2 + 1);

    // robô
    const rs = Math.min(H * 0.46, W * 0.36);
    drawRobot(ctx, W / 2, ky - gap - rs * 0.55, rs, Store.data.equip.robot, T, cheer > 0 ? 'cheer' : 'happy');
  }

  function update(dt) {
    T += dt;
    clouds.forEach((c) => { c.x += c.v * dt; if (c.x - c.s * 2 > W) c.x = -c.s * 2; });
    nextTick -= dt;
    if (nextTick <= 0) {
      const prev = count;
      count = count >= 31 ? 1 : count + 1;
      VALUES.forEach((v, i) => { if ((prev & v) !== (count & v)) pressed[i] = 0.14; });
      nextTick = count === 31 ? 2.2 : 0.85;
      if (count === 31) cheer = 2;
      if (Math.random() < 0.6) glyphs.push({ ch: Math.random() < 0.5 ? '0' : '1', x: W * (0.1 + Math.random() * 0.8), y: H * 0.7, v: 18 + Math.random() * 16, life: 1.6 });
    }
    pressed = pressed.map((p) => Math.max(0, p - dt));
    if (cheer > 0) cheer -= dt;
    glyphs.forEach((q) => { q.y -= q.v * dt; q.life -= dt * 0.55; });
    glyphs = glyphs.filter((q) => q.life > 0);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (cv.offsetParent) {
      if (!W) resize();
      update(dt);
      draw();
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    P = SKY[period()];
    resize();
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();

  return { start, refresh() { P = SKY[period()]; resize(); } };
})();
