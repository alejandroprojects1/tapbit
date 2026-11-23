// Robôs-avatar do Guardião Digital, desenhados em canvas (o mesmo desenho no menu, na loja e no jogo).
const ROBOTS = {
  bitinho: { name: 'Bitinho', price: 0, body: '#22e6ff', dark: '#0a86a6', visor: '#0b1026', eye: '#3dff9e', antenna: 'ball', head: 'round' },
  volt:    { name: 'Volt', price: 60, body: '#ffd23f', dark: '#c48a00', visor: '#1a1033', eye: '#ff4fd8', antenna: 'bolt', head: 'square' },
  pixel:   { name: 'Pixel', price: 90, body: '#3dff9e', dark: '#139a5c', visor: '#062318', eye: '#ffffff', antenna: 'double', head: 'square' },
  nebula:  { name: 'Nébula', price: 120, body: '#a78bfa', dark: '#5b3fc4', visor: '#120a2e', eye: '#22e6ff', antenna: 'ring', head: 'round' },
  brasa:   { name: 'Brasa', price: 150, body: '#ff7a45', dark: '#b8401a', visor: '#240a06', eye: '#ffe36b', antenna: 'ball', head: 'tv' },
  glitchy: { name: 'Glitchy', price: 220, body: '#ff4fd8', dark: '#a3168a', visor: '#1b0420', eye: '#ffd23f', antenna: 'horns', head: 'tv' },
};

const OUTLINE = '#0b1026';

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

// (x, y) = centro do robô; s = altura total; t = tempo em segundos (piscar, balançar)
function drawRobot(c, x, y, s, skin, t = 0, mood = 'happy') {
  const R = typeof skin === 'string' ? (ROBOTS[skin] || ROBOTS.bitinho) : skin;
  const lw = Math.max(2, s * 0.035);
  const bob = Math.sin(t * 3) * s * 0.02;
  c.save();
  c.translate(x, y + bob);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = OUTLINE;
  c.lineWidth = lw;

  // sombra
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.beginPath();
  c.ellipse(0, s * 0.47 - bob, s * 0.28, s * 0.05, 0, 0, Math.PI * 2);
  c.fill();

  // braços
  const wave = Math.sin(t * 4) * 0.35 + (mood === 'cheer' ? -1.2 : 0);
  [-1, 1].forEach((side) => {
    c.save();
    c.translate(side * s * 0.25, s * 0.12);
    c.rotate(side * (0.5 + (side === 1 ? wave : 0)));
    rrect(c, -s * 0.05, 0, s * 0.1, s * 0.22, s * 0.05);
    c.fillStyle = R.dark; c.fill(); c.stroke();
    c.beginPath(); c.arc(0, s * 0.24, s * 0.06, 0, Math.PI * 2);
    c.fillStyle = R.body; c.fill(); c.stroke();
    c.restore();
  });

  // corpo
  rrect(c, -s * 0.24, s * 0.04, s * 0.48, s * 0.36, s * 0.12);
  c.fillStyle = R.body; c.fill(); c.stroke();
  rrect(c, -s * 0.24, s * 0.26, s * 0.48, s * 0.14, s * 0.07);
  c.fillStyle = R.dark; c.fill();
  // luz do peito (bit)
  const pulse = 0.6 + 0.4 * Math.sin(t * 5);
  c.beginPath(); c.arc(0, s * 0.17, s * 0.065, 0, Math.PI * 2);
  c.fillStyle = R.visor; c.fill(); c.stroke();
  c.beginPath(); c.arc(0, s * 0.17, s * 0.04, 0, Math.PI * 2);
  c.globalAlpha = pulse; c.fillStyle = R.eye; c.fill(); c.globalAlpha = 1;

  // pescoço
  c.fillStyle = R.dark;
  c.fillRect(-s * 0.07, -s * 0.02, s * 0.14, s * 0.08);
  c.strokeRect(-s * 0.07, -s * 0.02, s * 0.14, s * 0.08);

  // antena
  const hy = -s * 0.5;
  c.beginPath();
  if (R.antenna === 'double') {
    c.moveTo(-s * 0.14, hy + s * 0.03); c.lineTo(-s * 0.2, hy - s * 0.1);
    c.moveTo(s * 0.14, hy + s * 0.03); c.lineTo(s * 0.2, hy - s * 0.1);
    c.stroke();
    [-1, 1].forEach((d) => { c.beginPath(); c.arc(d * s * 0.2, hy - s * 0.11, s * 0.04, 0, Math.PI * 2); c.fillStyle = R.eye; c.fill(); c.stroke(); });
  } else if (R.antenna === 'horns') {
    [-1, 1].forEach((d) => {
      c.beginPath();
      c.moveTo(d * s * 0.2, hy + s * 0.05);
      c.quadraticCurveTo(d * s * 0.34, hy - s * 0.04, d * s * 0.3, hy - s * 0.14);
      c.lineTo(d * s * 0.12, hy + s * 0.04);
      c.closePath();
      c.fillStyle = R.dark; c.fill(); c.stroke();
    });
  } else {
    c.moveTo(0, hy + s * 0.02); c.lineTo(0, hy - s * 0.09); c.stroke();
    if (R.antenna === 'bolt') {
      c.beginPath();
      const by = hy - s * 0.1;
      c.moveTo(s * 0.03, by - s * 0.09); c.lineTo(-s * 0.05, by + s * 0.01); c.lineTo(0, by + s * 0.01);
      c.lineTo(-s * 0.03, by + s * 0.08); c.lineTo(s * 0.05, by - s * 0.02); c.lineTo(0, by - s * 0.02); c.closePath();
      c.fillStyle = R.eye; c.fill(); c.stroke();
    } else if (R.antenna === 'ring') {
      c.beginPath(); c.arc(0, hy - s * 0.13, s * 0.05, 0, Math.PI * 2);
      c.fillStyle = 'transparent'; c.lineWidth = lw * 1.6; c.strokeStyle = R.eye; c.stroke();
      c.lineWidth = lw; c.strokeStyle = OUTLINE;
    } else {
      c.beginPath(); c.arc(0, hy - s * 0.11, s * 0.05, 0, Math.PI * 2);
      c.fillStyle = R.eye; c.fill(); c.stroke();
    }
  }

  // cabeça
  const hw = s * 0.62, hh = s * 0.46;
  const hr = R.head === 'round' ? s * 0.2 : R.head === 'tv' ? s * 0.08 : s * 0.12;
  // orelhas
  [-1, 1].forEach((d) => {
    rrect(c, d * hw / 2 - (d > 0 ? 0 : s * 0.07), hy + hh * 0.35, s * 0.07, hh * 0.32, s * 0.03);
    c.fillStyle = R.dark; c.fill(); c.stroke();
  });
  rrect(c, -hw / 2, hy, hw, hh, hr);
  c.fillStyle = R.body; c.fill(); c.stroke();
  // brilho
  c.save();
  rrect(c, -hw / 2 + s * 0.05, hy + s * 0.03, hw * 0.4, s * 0.05, s * 0.025);
  c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
  c.restore();
  // visor
  rrect(c, -hw / 2 + s * 0.06, hy + s * 0.1, hw - s * 0.12, hh - s * 0.17, hr * 0.7);
  c.fillStyle = R.visor; c.fill(); c.stroke();

  // olhos (piscam de vez em quando)
  const blink = (t % 3.7) < 0.13;
  c.fillStyle = R.eye;
  c.shadowColor = R.eye; c.shadowBlur = s * 0.08;
  const ey = hy + hh * 0.5;
  [-1, 1].forEach((d) => {
    if (blink) { c.fillRect(d * s * 0.12 - s * 0.05, ey, s * 0.1, s * 0.025); return; }
    if (mood === 'cheer') {
      c.beginPath(); c.lineWidth = s * 0.035; c.strokeStyle = R.eye;
      c.arc(d * s * 0.12, ey + s * 0.02, s * 0.045, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.lineWidth = lw; c.strokeStyle = OUTLINE;
    } else if (mood === 'sad') {
      rrect(c, d * s * 0.12 - s * 0.045, ey, s * 0.09, s * 0.05, s * 0.02); c.fill();
    } else {
      rrect(c, d * s * 0.12 - s * 0.045, ey - s * 0.05, s * 0.09, s * 0.11, s * 0.045); c.fill();
    }
  });
  // boca
  c.beginPath();
  c.lineWidth = s * 0.025; c.strokeStyle = R.eye;
  if (mood === 'sad') c.arc(0, ey + s * 0.13, s * 0.05, Math.PI * 1.15, Math.PI * 1.85);
  else c.arc(0, ey + s * 0.04, s * 0.05, Math.PI * 0.15, Math.PI * 0.85);
  c.stroke();
  c.shadowBlur = 0;
  c.restore();
}

// Anima os pequenos canvas de robô que estiverem visíveis na tela.
const RobotView = (() => {
  const views = new Map();
  function set(canvas, getSkin, mood = 'happy') {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
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
