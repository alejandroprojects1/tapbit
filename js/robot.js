// Robôs-avatar do Guardião Digital, desenhados em canvas (o mesmo desenho no menu, na loja e no jogo).
// Estilo "brinquedo de vinil": cabeça grande, corpo flutuando sobre um propulsor, sombreado com luz
// vindo do alto à esquerda, visor de vidro com reflexo e olhos de LED.
const ROBOTS = {
  bitinho: { name: 'Bitinho', price: 0, body: '#3ee0ff', visor: '#0a1230', eye: '#6ef7c8', antenna: 'ball', head: 'round', eyes: 'round' },
  volt:    { name: 'Volt', price: 60, body: '#fcd34d', visor: '#1a1033', eye: '#ff5fd2', antenna: 'bolt', head: 'square', eyes: 'round', decal: 'bolt' },
  pixel:   { name: 'Pixel', price: 90, body: '#4ade80', visor: '#04170f', eye: '#e8fff3', antenna: 'double', head: 'square', eyes: 'pixel' },
  nebula:  { name: 'Nébula', price: 120, body: '#a78bfa', visor: '#120a2e', eye: '#5ef0ff', antenna: 'ring', head: 'round', eyes: 'round', sparkle: true },
  brasa:   { name: 'Brasa', price: 150, body: '#fb8a4c', visor: '#240a06', eye: '#ffe36b', antenna: 'ball', head: 'tv', eyes: 'round', flame: true },
  glitchy: { name: 'Glitchy', price: 220, body: '#f472b6', visor: '#1b0420', eye: '#fde047', antenna: 'horns', head: 'tv', eyes: 'round', glitch: true },
};

const OUTLINE = 'rgba(6,9,26,.55)';

function rrect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// clareia (f > 0) ou escurece (f < 0) uma cor #rrggbb
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
  return `rgb(${r},${g},${b})`;
}
function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// (x, y) = centro do robô; s = altura de referência; t = tempo em segundos; mood = happy | cheer | sad
function drawRobot(c, x, y, s, skin, t = 0, mood = 'happy') {
  const R = typeof skin === 'string' ? (ROBOTS[skin] || ROBOTS.bitinho) : skin;
  const lw = Math.max(1, s * 0.018);
  const hover = Math.sin(t * 2.6) * s * 0.025;
  const lean = mood === 'cheer' ? Math.sin(t * 8) * 0.05 : mood === 'sad' ? 0.04 : Math.sin(t * 1.3) * 0.025;

  c.save();
  c.translate(x, y);
  c.lineJoin = 'round';
  c.lineCap = 'round';

  // sombra no chão (diminui quando o robô sobe)
  const sh = 1 - hover / (s * 0.1);
  c.fillStyle = 'rgba(0,0,0,.28)';
  c.beginPath();
  c.ellipse(0, s * 0.5, s * 0.2 * sh, s * 0.035 * sh, 0, 0, Math.PI * 2);
  c.fill();

  c.translate(0, hover);

  // propulsor
  const flick = 0.75 + 0.25 * Math.sin(t * 30) * Math.sin(t * 17);
  const jetCol = R.flame ? '#ffb347' : R.eye;
  const jet = c.createRadialGradient(0, s * 0.34, 0, 0, s * 0.34, s * 0.2);
  jet.addColorStop(0, alpha('#ffffff', 0.9));
  jet.addColorStop(0.25, R.flame ? 'rgba(255,170,70,.85)' : alpha(R.eye.length === 7 ? R.eye : '#6ef7c8', 0.7));
  jet.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = jet;
  c.beginPath();
  c.ellipse(0, s * 0.38, s * 0.1, s * 0.15 * flick, 0, 0, Math.PI * 2);
  c.fill();
  if (R.flame) {
    c.fillStyle = 'rgba(255,90,40,.55)';
    c.beginPath();
    c.moveTo(-s * 0.06, s * 0.32);
    c.quadraticCurveTo(0, s * (0.5 + 0.06 * flick), s * 0.06, s * 0.32);
    c.fill();
  }
  void jetCol;

  c.rotate(lean);

  // mãos flutuantes (atrás do corpo quando abaixadas)
  const wave = mood === 'cheer' ? Math.sin(t * 10) * 0.25 : Math.sin(t * 2.2) * 0.12;
  const handY = mood === 'cheer' ? -s * 0.08 : mood === 'sad' ? s * 0.24 : s * 0.15;
  const hand = (side) => {
    const hx = side * s * (mood === 'cheer' ? 0.44 : 0.3);
    const hy = handY + (side > 0 ? wave * s * 0.3 : -wave * s * 0.15);
    const g = c.createRadialGradient(hx - s * 0.02, hy - s * 0.02, s * 0.01, hx, hy, s * 0.075);
    g.addColorStop(0, shade(R.body, 0.45)); g.addColorStop(1, shade(R.body, -0.25));
    c.fillStyle = g;
    c.beginPath(); c.arc(hx, hy, s * 0.062, 0, Math.PI * 2); c.fill();
    c.strokeStyle = OUTLINE; c.lineWidth = lw; c.stroke();
  };

  // corpo (cápsula)
  const bw = s * 0.42, bh = s * 0.3, by = s * 0.02;
  const gb = c.createLinearGradient(-bw / 2, by, bw / 2, by + bh);
  gb.addColorStop(0, shade(R.body, 0.35)); gb.addColorStop(0.55, R.body); gb.addColorStop(1, shade(R.body, -0.35));
  rrect(c, -bw / 2, by, bw, bh, bh * 0.48);
  c.fillStyle = gb; c.fill();
  c.strokeStyle = OUTLINE; c.lineWidth = lw; c.stroke();
  // faixa inferior
  c.save();
  rrect(c, -bw / 2, by, bw, bh, bh * 0.48); c.clip();
  c.fillStyle = shade(R.body, -0.3);
  c.fillRect(-bw / 2, by + bh * 0.72, bw, bh * 0.3);
  c.restore();
  // painel do peito com 3 luzes piscando em binário
  const pw = bw * 0.56, ph = bh * 0.34, py = by + bh * 0.3;
  rrect(c, -pw / 2, py, pw, ph, ph * 0.45);
  c.fillStyle = R.visor; c.fill();
  const bits = (Math.floor(t * 2.5) % 8);
  for (let i = 0; i < 3; i++) {
    const on = (bits >> (2 - i)) & 1;
    const lx = -pw / 2 + pw * (0.25 + i * 0.25);
    c.beginPath(); c.arc(lx, py + ph / 2, ph * 0.22, 0, Math.PI * 2);
    c.fillStyle = on ? R.eye : alpha('#ffffff', 0.12);
    if (on) { c.shadowColor = R.eye; c.shadowBlur = s * 0.04; }
    c.fill();
    c.shadowBlur = 0;
  }
  if (R.decal === 'bolt') {
    c.fillStyle = shade(R.body, -0.45);
    const dx = bw * 0.33, dy = by + bh * 0.2;
    c.beginPath();
    c.moveTo(dx, dy); c.lineTo(dx - s * 0.03, dy + s * 0.055); c.lineTo(dx, dy + s * 0.05); c.lineTo(dx - s * 0.015, dy + s * 0.1);
    c.lineTo(dx + s * 0.035, dy + s * 0.035); c.lineTo(dx + s * 0.005, dy + s * 0.04); c.closePath(); c.fill();
  }

  if (mood !== 'cheer') { hand(-1); hand(1); }

  // cabeça
  const hw = s * 0.74, hh = s * 0.54, hy = -s * 0.5;
  const hr = R.head === 'round' ? hh * 0.48 : R.head === 'tv' ? hh * 0.22 : hh * 0.32;

  // antena (atrás da cabeça)
  drawAntenna(c, R, s, hy, t, lw);

  // orelhas
  [-1, 1].forEach((d) => {
    const ex = d * hw / 2, ey = hy + hh * 0.52;
    const ge = c.createLinearGradient(ex, ey - hh * 0.2, ex, ey + hh * 0.2);
    ge.addColorStop(0, shade(R.body, 0.1)); ge.addColorStop(1, shade(R.body, -0.45));
    rrect(c, ex - s * 0.045, ey - hh * 0.17, s * 0.09, hh * 0.34, s * 0.035);
    c.fillStyle = ge; c.fill();
    c.strokeStyle = OUTLINE; c.lineWidth = lw; c.stroke();
    c.fillStyle = R.eye;
    c.globalAlpha = 0.9;
    rrect(c, ex + d * s * 0.03 - s * 0.012, ey - hh * 0.08, s * 0.024, hh * 0.16, s * 0.012); c.fill();
    c.globalAlpha = 1;
  });

  const gh = c.createLinearGradient(-hw / 2, hy, hw * 0.2, hy + hh);
  gh.addColorStop(0, shade(R.body, 0.45)); gh.addColorStop(0.45, R.body); gh.addColorStop(1, shade(R.body, -0.4));
  rrect(c, -hw / 2, hy, hw, hh, hr);
  c.fillStyle = gh; c.fill();
  c.strokeStyle = OUTLINE; c.lineWidth = lw; c.stroke();
  // brilho do topo
  c.save();
  rrect(c, -hw / 2, hy, hw, hh, hr); c.clip();
  const gl = c.createLinearGradient(0, hy, 0, hy + hh * 0.3);
  gl.addColorStop(0, 'rgba(255,255,255,.55)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gl;
  c.beginPath(); c.ellipse(-hw * 0.12, hy + hh * 0.06, hw * 0.36, hh * 0.13, -0.1, 0, Math.PI * 2); c.fill();
  c.restore();

  // visor de vidro
  const vx = -hw / 2 + s * 0.065, vy = hy + hh * 0.22, vw = hw - s * 0.13, vh = hh * 0.62;
  const vr = Math.max(s * 0.04, hr * 0.72);
  const gv = c.createLinearGradient(0, vy, 0, vy + vh);
  gv.addColorStop(0, shade(R.visor, 0.12)); gv.addColorStop(1, R.visor);
  rrect(c, vx, vy, vw, vh, vr);
  c.fillStyle = gv; c.fill();
  c.strokeStyle = shade(R.body, -0.5); c.lineWidth = lw * 1.2; c.stroke();

  // olhos
  const blink = (t % 3.9) < 0.12 && mood !== 'cheer';
  const look = Math.sin(t * 0.7) * s * 0.012;
  const ey = vy + vh * 0.48;
  c.save();
  rrect(c, vx, vy, vw, vh, vr); c.clip();
  const glitchOff = R.glitch && Math.sin(t * 9) > 0.9 ? s * 0.02 : 0;
  const drawEyes = (dx, col, a) => {
    c.globalAlpha = a;
    c.fillStyle = col;
    c.strokeStyle = col;
    c.shadowColor = col; c.shadowBlur = s * 0.06;
    [-1, 1].forEach((d) => {
      const ex = d * vw * 0.22 + look + dx;
      if (blink) { rrect(c, ex - s * 0.05, ey - s * 0.008, s * 0.1, s * 0.018, s * 0.01); c.fill(); return; }
      if (mood === 'cheer') {
        c.lineWidth = s * 0.03;
        c.beginPath(); c.arc(ex, ey + s * 0.02, s * 0.045, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      } else if (mood === 'sad') {
        c.save(); c.translate(ex, ey + s * 0.01); c.rotate(d * 0.28);
        rrect(c, -s * 0.045, -s * 0.018, s * 0.09, s * 0.036, s * 0.018); c.fill();
        c.restore();
      } else if (R.eyes === 'pixel') {
        const p = s * 0.03;
        c.fillRect(ex - p, ey - p * 1.5, p * 2, p * 3);
        c.fillRect(ex - p * 1.5, ey - p, p * 3, p * 2);
      } else {
        rrect(c, ex - s * 0.042, ey - s * 0.058, s * 0.084, s * 0.116, s * 0.042); c.fill();
        c.shadowBlur = 0;
        c.fillStyle = 'rgba(255,255,255,.85)';
        c.beginPath(); c.arc(ex - s * 0.014, ey - s * 0.026, s * 0.014, 0, Math.PI * 2); c.fill();
        c.fillStyle = col;
        c.shadowBlur = s * 0.06;
      }
    });
    // boca
    c.lineWidth = s * 0.022;
    c.beginPath();
    if (mood === 'sad') c.arc(look + dx, ey + vh * 0.38, s * 0.04, Math.PI * 1.2, Math.PI * 1.8);
    else if (mood === 'cheer') { c.arc(look + dx, ey + vh * 0.14, s * 0.05, 0.1, Math.PI - 0.1); c.closePath(); c.fill(); }
    else c.arc(look + dx, ey + vh * 0.12, s * 0.04, Math.PI * 0.2, Math.PI * 0.8);
    if (mood !== 'cheer') c.stroke();
    // bochechas
    c.shadowBlur = 0;
    c.globalAlpha = a * 0.28;
    [-1, 1].forEach((d) => { c.beginPath(); c.ellipse(d * vw * 0.36 + dx, ey + vh * 0.16, s * 0.03, s * 0.016, 0, 0, Math.PI * 2); c.fill(); });
    c.globalAlpha = 1;
  };
  if (glitchOff) { drawEyes(-glitchOff, '#22e6ff', 0.6); drawEyes(glitchOff, '#ff2d55', 0.6); }
  drawEyes(0, R.eye, 1);
  // reflexo do vidro
  c.shadowBlur = 0;
  c.fillStyle = 'rgba(255,255,255,.13)';
  c.beginPath();
  c.moveTo(vx + vw * 0.08, vy); c.lineTo(vx + vw * 0.32, vy); c.lineTo(vx + vw * 0.12, vy + vh); c.lineTo(vx - vw * 0.12, vy + vh);
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.08)';
  c.beginPath();
  c.moveTo(vx + vw * 0.38, vy); c.lineTo(vx + vw * 0.46, vy); c.lineTo(vx + vw * 0.26, vy + vh); c.lineTo(vx + vw * 0.18, vy + vh);
  c.closePath(); c.fill();
  c.restore();

  if (mood === 'cheer') { hand(-1); hand(1); }

  // brilhinhos da Nébula
  if (R.sparkle) {
    for (let i = 0; i < 3; i++) {
      const a = t * 0.9 + i * 2.1;
      const sx = Math.cos(a) * s * 0.5, sy = hy + hh * 0.4 + Math.sin(a * 1.3) * s * 0.3;
      const k = (Math.sin(t * 4 + i * 2) + 1) / 2;
      c.fillStyle = alpha('#ffffff', 0.4 + 0.6 * k);
      const r = s * (0.012 + 0.018 * k);
      c.beginPath();
      c.moveTo(sx, sy - r * 2); c.lineTo(sx + r * 0.5, sy - r * 0.5); c.lineTo(sx + r * 2, sy); c.lineTo(sx + r * 0.5, sy + r * 0.5);
      c.lineTo(sx, sy + r * 2); c.lineTo(sx - r * 0.5, sy + r * 0.5); c.lineTo(sx - r * 2, sy); c.lineTo(sx - r * 0.5, sy - r * 0.5);
      c.closePath(); c.fill();
    }
  }
  c.restore();
}

function drawAntenna(c, R, s, hy, t, lw) {
  const glowBall = (bx, by, r) => {
    const g = c.createRadialGradient(bx - r * 0.35, by - r * 0.35, r * 0.1, bx, by, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, R.eye); g.addColorStop(1, shade(R.eye.length === 7 ? R.eye : '#6ef7c8', -0.35));
    c.shadowColor = R.eye; c.shadowBlur = s * (0.05 + 0.03 * Math.sin(t * 4));
    c.fillStyle = g;
    c.beginPath(); c.arc(bx, by, r, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
  };
  const stalk = (x1, y1, x2, y2) => {
    c.strokeStyle = shade(R.body, -0.4); c.lineWidth = s * 0.028;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  };
  const sway = Math.sin(t * 2.4) * s * 0.02;
  if (R.antenna === 'double') {
    [-1, 1].forEach((d) => { stalk(d * s * 0.14, hy + s * 0.04, d * s * 0.2 + sway, hy - s * 0.1); glowBall(d * s * 0.2 + sway, hy - s * 0.115, s * 0.035); });
  } else if (R.antenna === 'horns') {
    [-1, 1].forEach((d) => {
      const g = c.createLinearGradient(0, hy - s * 0.15, 0, hy + s * 0.05);
      g.addColorStop(0, shade(R.body, 0.4)); g.addColorStop(1, shade(R.body, -0.35));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(d * s * 0.2, hy + s * 0.06);
      c.quadraticCurveTo(d * s * 0.36, hy - s * 0.02, d * s * 0.33, hy - s * 0.16);
      c.quadraticCurveTo(d * s * 0.22, hy - s * 0.06, d * s * 0.1, hy + s * 0.05);
      c.closePath(); c.fill();
      c.strokeStyle = OUTLINE; c.lineWidth = lw; c.stroke();
    });
  } else if (R.antenna === 'ring') {
    stalk(0, hy + s * 0.02, sway * 0.5, hy - s * 0.06);
    c.save();
    c.translate(sway * 0.5, hy - s * 0.15 + Math.sin(t * 3) * s * 0.01);
    c.strokeStyle = R.eye; c.lineWidth = s * 0.024;
    c.shadowColor = R.eye; c.shadowBlur = s * 0.06;
    c.beginPath(); c.ellipse(0, 0, s * 0.11, s * 0.035, 0, 0, Math.PI * 2); c.stroke();
    c.restore();
  } else if (R.antenna === 'bolt') {
    stalk(0, hy + s * 0.02, sway, hy - s * 0.08);
    const bx = sway, by = hy - s * 0.15;
    c.fillStyle = R.eye; c.shadowColor = R.eye; c.shadowBlur = s * 0.06;
    c.beginPath();
    c.moveTo(bx + s * 0.03, by - s * 0.07); c.lineTo(bx - s * 0.04, by + s * 0.015); c.lineTo(bx, by + s * 0.015);
    c.lineTo(bx - s * 0.025, by + s * 0.08); c.lineTo(bx + s * 0.045, by - s * 0.01); c.lineTo(bx + s * 0.005, by - s * 0.01); c.closePath();
    c.fill(); c.shadowBlur = 0;
  } else {
    stalk(0, hy + s * 0.02, sway, hy - s * 0.09);
    glowBall(sway, hy - s * 0.115, s * 0.045);
  }
}

// Anima os pequenos canvas de robô que estiverem visíveis na tela.
const RobotView = (() => {
  const views = new Map();
  function set(canvas, getSkin, mood = 'happy') {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (!canvas.dataset.w) { canvas.dataset.w = canvas.getAttribute('width'); canvas.dataset.h = canvas.getAttribute('height'); }
    const w = +canvas.dataset.w, h = +canvas.dataset.h;
    if (!canvas.dataset.css) {
      canvas.dataset.css = '1';
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      canvas.width = w * dpr; canvas.height = h * dpr;
    }
    views.set(canvas, { getSkin, mood, w, h, dpr });
  }
  function loop(now) {
    const t = now / 1000;
    views.forEach((v, cv) => {
      if (!cv.offsetParent) return;
      const c = cv.getContext('2d');
      c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      c.clearRect(0, 0, v.w, v.h);
      drawRobot(c, v.w / 2, v.h * 0.55, v.h * 0.82, v.getSkin(), t, typeof v.mood === 'function' ? v.mood() : v.mood);
    });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return { set };
})();
