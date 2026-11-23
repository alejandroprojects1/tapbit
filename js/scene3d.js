// Cenário em 3D (Three.js). O motor do jogo (game.js) continua calculando tudo em coordenadas de tela;
// aqui cada coisa vira um objeto 3D num plano z = 0, visto por uma câmera em perspectiva calibrada
// para que 1 unidade = 1 pixel nesse plano. Assim os acertos e os feixes batem com o que se vê.
// Se o aparelho não tiver WebGL, Scene3D.active fica false e o jogo usa o desenho 2D.
const Scene3D = (() => {
  'use strict';
  const canvas = document.getElementById('play3d');
  const FONT = 'Lexend, system-ui, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, monospace';
  let renderer = null;

  try {
    const probe = document.createElement('canvas');
    const okGL = !!(window.WebGLRenderingContext && (probe.getContext('webgl') || probe.getContext('experimental-webgl')));
    if (window.THREE && okGL && !/[?&]2d\b/.test(location.search)) {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    }
  } catch (e) { renderer = null; }
  if (!renderer) {
    canvas.style.display = 'none';
    return { active: false, resize() {}, render() {}, reset() {} };
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 6000);
  let W = 0, H = 0, DIST = 600;
  const wx = (x) => x - W / 2;
  const wy = (y) => H / 2 - y;

  // ---------- Texturas desenhadas em canvas ----------
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }
  const glowTex = canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const dotTex = canvasTex(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const trailTex = canvasTex(64, 256, (g, w, h) => {
    const r = g.createLinearGradient(0, 0, 0, h);
    r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(1, 'rgba(255,255,255,.9)');
    g.fillStyle = r;
    g.beginPath(); g.moveTo(w * 0.5, 0); g.quadraticCurveTo(w, h * 0.7, w * 0.5, h); g.quadraticCurveTo(0, h * 0.7, w * 0.5, 0); g.fill();
  });
  const numCache = new Map();
  function numberTex(txt) {
    if (numCache.has(txt)) return numCache.get(txt);
    const t = canvasTex(256, 256, (g, w) => {
      g.font = `700 ${txt.length > 2 ? 110 : 150}px ${FONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(10,6,30,.85)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
      g.fillStyle = '#fff';
      g.fillText(txt, w / 2, w / 2 + 8);
    });
    numCache.set(txt, t);
    return t;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { numCache.forEach((t) => t.dispose()); numCache.clear(); });

  const VALUES = [16, 8, 4, 2, 1];
  // tela de um drone/chefe com o código binário (e os valores dos bits embaixo, se houver dica)
  function drawScreen(g, w, h, code, labels) {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#05040f';
    roundRect(g, 0, 0, w, h, h * 0.18); g.fill();
    const n = code.length;
    const cw = w / (n + 0.6);
    const cy = labels ? h * 0.42 : h * 0.52;
    const vals = VALUES.slice(5 - n);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    code.split('').forEach((d, i) => {
      const x = w / 2 - (n * cw) / 2 + i * cw + cw / 2;
      g.font = `700 ${Math.round(Math.min(cw * 0.95, h * 0.62))}px ${MONO}`;
      if (d === '1') { g.fillStyle = '#5ef0ff'; g.shadowColor = '#3ee0ff'; g.shadowBlur = 18; }
      else { g.fillStyle = 'rgba(141,151,199,.38)'; g.shadowBlur = 0; }
      g.fillText(d, x, cy);
      g.shadowBlur = 0;
      if (labels) {
        g.font = `600 ${Math.round(h * 0.17)}px ${FONT}`;
        g.fillStyle = d === '1' ? '#fbbf24' : 'rgba(141,151,199,.65)';
        g.fillText(vals[i], x, h * 0.84);
      }
    });
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // ---------- Geometrias ----------
  function slab(w, h, d, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 4, bevelSize: 4, bevelSegments: 3, curveSegments: 8 });
    g.center();
    return g;
  }
  function rockGeo(r, seed) {
    const g = new THREE.IcosahedronGeometry(r, 1);
    const p = g.attributes.position;
    const memo = new Map();
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`;
      if (!memo.has(key)) memo.set(key, 0.82 + rnd() * 0.3);
      const f = memo.get(key);
      p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
    }
    g.computeVertexNormals();
    return g;
  }

  // ---------- Estilo cartoon: sombreado em faixas (toon) + contorno de tinta ----------
  const toonGrad = (() => {
    const d = new Uint8Array([90, 90, 90, 255, 160, 160, 160, 255, 225, 225, 225, 255, 255, 255, 255, 255]);
    const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  })();
  const toon = (color, extra) => new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: toonGrad }, extra || {}));
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x150c33, side: THREE.BackSide });
  const SHARED = new Set([inkMat]);
  // malha + "casca" escura um pouco maior vista por dentro = contorno de desenho animado
  function ink(geo, mat, thick = 1.6) {
    const g = new THREE.Group();
    geo.computeBoundingBox();
    const s = new THREE.Vector3();
    geo.boundingBox.getSize(s);
    const o = new THREE.Mesh(geo, inkMat);
    o.scale.set(1 + 2 * thick / Math.max(1, s.x), 1 + 2 * thick / Math.max(1, s.y), 1 + 2 * thick / Math.max(1, s.z));
    const m = new THREE.Mesh(geo, mat);
    g.add(o); g.add(m);
    g.userData.main = m;
    g.userData.outline = o;
    return g;
  }

  // céu de entardecer digital
  const duskTex = canvasTex(64, 1024, (g, w, h) => {
    const r = g.createLinearGradient(0, 0, 0, h);
    r.addColorStop(0, '#090b2a'); r.addColorStop(0.28, '#1a1650'); r.addColorStop(0.42, '#3d2275');
    r.addColorStop(0.5, '#9a3f8f'); r.addColorStop(0.555, '#ff8f78'); r.addColorStop(0.6, '#5a2a7a'); r.addColorStop(1, '#2a1650');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  scene.background = duskTex;
  // chão de placa de circuito
  const circuitTex = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < 14; i++) {
      let x = Math.round(Math.random() * 8) * 32, y = Math.round(Math.random() * 8) * 32;
      g.lineWidth = Math.random() < 0.3 ? 4 : 2;
      g.globalAlpha = 0.35 + Math.random() * 0.5;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        const d = Math.floor(Math.random() * 4);
        const len = 32 * (1 + Math.floor(Math.random() * 3));
        x += [len, -len, 0, 0][d]; y += [0, 0, len, -len][d];
        g.lineTo(x, y);
      }
      g.stroke();
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    }
    g.globalAlpha = 0.18; g.lineWidth = 2;
    g.strokeRect(0, 0, w, w);
  });
  circuitTex.wrapS = circuitTex.wrapT = THREE.RepeatWrapping;
  // janelas com luz quente e fria
  const winTex2 = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 6; y += 16) {
      for (let x = 7; x < w - 6; x += 14) {
        const r = Math.random();
        if (r < 0.5) continue;
        g.fillStyle = r > 0.8 ? '#ffd27a' : '#7ff3ff';
        g.globalAlpha = 0.55 + Math.random() * 0.45;
        roundRect(g, x, y, 7, 9, 2); g.fill();
      }
    }
  });
  winTex2.wrapS = winTex2.wrapT = THREE.RepeatWrapping;

  // ---------- Luzes ----------
  const hemi = new THREE.HemisphereLight(0xc4b5ff, 0x3a1d5c, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc08a, 1.05);   // luz quente do pôr do sol, vinda da direita
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x7aa2ff, 0.55);   // contraluz fria da esquerda
  scene.add(rim);
  const cannonLight = new THREE.PointLight(0x3ee0ff, 1.3, 340, 2);
  scene.add(cannonLight);

  // ---------- Ambiente (refeito a cada mudança de tamanho) ----------
  let env = null, live = null, stars = null, ground = null, shield = null, cannon = null;

  const shieldMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x3ee0ff) }, uAlpha: { value: 0.9 }, uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uAlpha; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
        float hex = step(0.92, fract(vP.x * 0.04 + vP.y * 0.02)) + step(0.92, fract(vP.x * -0.04 + vP.y * 0.02));
        float scan = 0.5 + 0.5 * sin(vP.y * 0.12 - uTime * 3.0);
        gl_FragColor = vec4(uColor, (f * 0.9 + hex * 0.06 + scan * 0.04 + 0.02) * uAlpha);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  });
  SHARED.add(shieldMat);

  function disposeTree(o) {
    o.traverse((m) => {
      if (m.geometry) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { if (!SHARED.has(x)) x.dispose(); });
    });
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const PALETTE = [0x5b6cff, 0x7c5cff, 0x2fb7c9, 0xff7eb6, 0x3fc7a0, 0xffa86b, 0x6e8bff, 0xb27cff];

  function windowMat(color, w, h, glow) {
    const tex = winTex2.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 22)), Math.max(1, Math.round(h / 30)));
    return toon(color, { emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: glow });
  }
  function blinker(color, r) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color }));
    m.userData.blink = Math.random() * 6;
    return m;
  }

  // Tipos de prédio da Cidade de Silício (base no chão, em y = 0 do grupo)
  function towerRound(h, r, glow) {
    const g = new THREE.Group();
    const col = pick(PALETTE);
    const body = ink(new THREE.CylinderGeometry(r, r * 1.05, h, 20), windowMat(col, r * 3, h, glow));
    body.position.y = h / 2; g.add(body);
    const ring = ink(new THREE.CylinderGeometry(r * 1.12, r * 1.12, Math.max(3, h * 0.04), 20), toon(0xffffff));
    ring.position.y = h * 0.7; g.add(ring);
    const dome = ink(new THREE.SphereGeometry(r * 0.95, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(pick(PALETTE)));
    dome.position.y = h; g.add(dome);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, r * 1.2, 6), toon(0xe8e4ff));
    ant.position.y = h + r * 0.95 + r * 0.5; g.add(ant);
    const bl = blinker(0xff5a7a, Math.max(2, r * 0.14)); bl.position.y = h + r * 1.6; g.add(bl);
    return g;
  }
  function towerStack(w, h, d, glow) {
    const g = new THREE.Group();
    const col = pick(PALETTE);
    let y = 0, cw = w, cd = d;
    const parts = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < parts; i++) {
      const ph = h * (i === 0 ? 0.55 : 0.45 / (parts - 1));
      const b = ink(new THREE.BoxGeometry(cw, ph, cd), windowMat(col, cw, ph, glow));
      b.position.y = y + ph / 2; g.add(b);
      y += ph; cw *= 0.72; cd *= 0.8;
      const cap = ink(new THREE.BoxGeometry(cw / 0.72 + 2, 3, cd / 0.8 + 2), toon(0xf5f3ff));
      cap.position.y = y + 1.5; g.add(cap);
    }
    if (Math.random() < 0.6) {
      const dish = ink(new THREE.SphereGeometry(cw * 0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xe8e4ff));
      dish.rotation.x = Math.PI; dish.position.set(cw * 0.15, y + cw * 0.35, 0); dish.rotation.z = 0.6; g.add(dish);
    }
    const bl = blinker(0x7ff3ff, Math.max(1.6, w * 0.04)); bl.position.y = y + 4; g.add(bl);
    return g;
  }
  function chipBuilding(w, d) {
    const g = new THREE.Group();
    const h = Math.max(8, w * 0.22);
    const body = ink(new THREE.BoxGeometry(w, h, d), toon(0x272b5e));
    body.position.y = h / 2; g.add(body);
    const pinMat = toon(0xd9dcf5);
    const n = Math.max(3, Math.floor(w / 9));
    for (let i = 0; i < n; i++) {
      const px = -w / 2 + (i + 0.5) * (w / n);
      [-1, 1].forEach((side) => {
        const pin = new THREE.Mesh(new THREE.BoxGeometry(3, h * 0.5, 5), pinMat);
        pin.position.set(px, h * 0.25, side * (d / 2 + 2.5)); g.add(pin);
      });
    }
    const label = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 1.5, d * 0.4), new THREE.MeshBasicMaterial({ color: 0x3ee0ff }));
    label.position.y = h + 0.8; g.add(label);
    label.userData.blink = Math.random() * 6;
    return g;
  }
  function domeHouse(r) {
    const g = new THREE.Group();
    const base = ink(new THREE.CylinderGeometry(r, r, r * 0.6, 20), windowMat(pick(PALETTE), r * 3, r * 0.6, 0.55));
    base.position.y = r * 0.3; g.add(base);
    const dome = ink(new THREE.SphereGeometry(r * 0.96, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x8fc8f0, { emissive: 0x1a4a7a, emissiveIntensity: 0.35 }));
    dome.position.y = r * 0.6; g.add(dome);
    return g;
  }
  function tree(s) {
    const g = new THREE.Group();
    const trunk = ink(new THREE.CylinderGeometry(s * 0.09, s * 0.12, s * 0.5, 8), toon(0x8a5a3c), 1.2);
    trunk.position.y = s * 0.25; g.add(trunk);
    const crownCol = pick([0x3fc7a0, 0x55d68a, 0x2fb7c9]);
    [[0, s * 0.62, 0, s * 0.32], [-s * 0.16, s * 0.5, 0, s * 0.22], [s * 0.17, s * 0.52, 0, s * 0.2]].forEach(([x, y, z, r]) => {
      const c = ink(new THREE.SphereGeometry(r, 12, 10), toon(crownCol), 1.4);
      c.position.set(x, y, z); g.add(c);
    });
    return g;
  }
  function cloud(s) {
    const g = new THREE.Group();
    const mat = toon(0xd8c8ff, { emissive: 0x3a2a70, emissiveIntensity: 0.35 });
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const r = s * rand(0.28, 0.45);
      const c = ink(new THREE.SphereGeometry(r, 14, 10), mat, 3);
      c.position.set((i - (n - 1) / 2) * s * 0.32, Math.abs(i - (n - 1) / 2) < 1 ? r * 0.35 : 0, rand(-s * 0.1, s * 0.1));
      g.add(c);
    }
    g.scale.y = 0.62;
    return g;
  }
  function mountain(s, color) {
    const g = new THREE.Group();
    const m = ink(new THREE.ConeGeometry(s, s * rand(0.6, 1.0), 6), toon(color), 4);
    m.position.y = s * 0.35; m.rotation.y = Math.random(); g.add(m);
    return g;
  }

  function buildEnv(view) {
    if (env) { scene.remove(env); disposeTree(env); }
    if (live) { scene.remove(live); disposeTree(live); }
    env = new THREE.Group();
    env.userData = { clouds: [], cars: [], lights: [] };
    scene.add(env);
    live = new THREE.Group();   // o que continua sendo desenhado ao vivo mesmo com o fundo "congelado"
    scene.add(live);
    const gy = wy(view.ground());
    const fogOff = (m) => m.traverse((o) => { if (o.material) o.material.fog = false; });

    // estrelas só no alto do céu
    const N = 220;
    const sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      sp[i * 3] = (Math.random() - 0.5) * W * 6;
      sp[i * 3 + 1] = H * 0.6 + Math.random() * H * 2.4;
      sp[i * 3 + 2] = -1800 - Math.random() * 1600;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff6e8, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
    env.add(stars);

    // planeta com anel e uma lua
    const planet = new THREE.Group();
    const pr = Math.max(W, H) * 0.42;
    const ball = ink(new THREE.SphereGeometry(pr, 40, 28), toon(0xff9ec7, { emissive: 0x5a1f5a, emissiveIntensity: 0.5 }), 8);
    planet.add(ball);
    const band = new THREE.Mesh(new THREE.TorusGeometry(pr * 1.55, pr * 0.09, 6, 80), toon(0xffd9a8, { emissive: 0x6a3a2a, emissiveIntensity: 0.5 }));
    band.rotation.x = Math.PI / 2.3; band.rotation.y = 0.25;
    planet.add(band);
    planet.position.set(W * 1.15, H * 1.25, -2600);
    fogOff(planet);
    env.add(planet);
    const moon = ink(new THREE.SphereGeometry(pr * 0.22, 24, 16), toon(0xfff1c9, { emissive: 0x6a5a3a, emissiveIntensity: 0.7 }), 4);
    moon.position.set(-W * 1.1, H * 1.6, -2600);
    fogOff(moon);
    env.add(moon);

    // montanhas no horizonte
    for (let i = 0; i < 9; i++) {
      const m = mountain(rand(260, 520), pick([0x3b2468, 0x452a78, 0x33205e]));
      m.position.set(-W * 3 + i * W * 0.75 + rand(-80, 80), gy, -2300 - rand(0, 500));
      env.add(m);
    }

    // nuvens cartoon
    for (let i = 0; i < 6; i++) {
      const c = cloud(rand(120, 220));
      c.position.set(rand(-W * 2.5, W * 2.5), rand(H * 0.05, H * 0.75), -1300 - rand(0, 700));
      c.userData.v = rand(6, 16) * (Math.random() < 0.5 ? -1 : 1);
      env.userData.clouds.push(c);
      env.add(c);
    }

    // chão de placa de circuito
    circuitTex.repeat.set(26, 26);
    ground = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 14, 5200),
      toon(0x221d5a, { emissive: 0x3ee0ff, emissiveMap: circuitTex, emissiveIntensity: 0.55 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, gy, -2500);
    env.add(ground);

    // Cidade de Silício
    const place = (o, x, z) => { o.position.set(x, gy, z); env.add(o); return o; };
    // fileira da frente: casinhas, chips e árvores (deixa o canhão livre)
    let x = -W * 0.62;
    while (x < W * 0.62) {
      const r = Math.random();
      let wdt;
      if (Math.abs(x) < 40) { x += 18; continue; }
      if (r < 0.3) { wdt = rand(30, 46); place(chipBuilding(wdt, rand(20, 30)), x + wdt / 2, -34); }
      else if (r < 0.55) { wdt = rand(26, 36); place(domeHouse(wdt / 2), x + wdt / 2, -36); }
      else if (r < 0.8) { wdt = rand(16, 22); place(tree(rand(34, 48)), x + wdt / 2, -22); }
      else { wdt = rand(22, 32); place(towerStack(wdt, rand(30, 50), 26, 0.55), x + wdt / 2, -40); }
      x += wdt + rand(4, 12);
    }
    // fileira do meio: torres
    x = -W * 1.3;
    while (x < W * 1.3) {
      const wdt = rand(36, 70);
      const o = Math.random() < 0.5 ? towerRound(rand(60, 120), wdt / 2, 0.42) : towerStack(wdt, rand(60, 130), wdt * 0.8, 0.42);
      place(o, x + wdt / 2, -380 - rand(0, 80));
      if (Math.random() < 0.35) place(tree(rand(50, 70)), x + wdt + 10, -340);
      x += wdt + rand(50, 110);
    }
    // fileira do fundo: arranha-céus
    x = -W * 2.6;
    while (x < W * 2.6) {
      const wdt = rand(60, 120);
      const o = Math.random() < 0.5 ? towerRound(rand(180, 340), wdt / 2, 0.3) : towerStack(wdt, rand(200, 360), wdt * 0.8, 0.3);
      place(o, x + wdt / 2, -950 - rand(0, 150));
      x += wdt + rand(120, 240);
    }
    env.traverse((o) => { if (o !== env && typeof o.userData.blink === 'number') env.userData.lights.push(o); });

    // carros voadores
    for (let i = 0; i < 4; i++) {
      const car = new THREE.Group();
      const body = ink(new THREE.CapsuleGeometry(4, 12, 4, 10), toon(pick([0xffd27a, 0xff7eb6, 0x7ff3ff, 0xffffff])), 1.2);
      body.rotation.z = Math.PI / 2; car.add(body);
      const light = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a7a }));
      light.position.x = -11; car.add(light);
      const z = -180 - rand(0, 500);
      car.position.set(rand(-W, W), gy + rand(H * 0.35, H * 0.7), z);
      car.userData.v = rand(40, 90) * (i % 2 ? -1 : 1);
      car.scale.x = car.userData.v < 0 ? -1 : 1;
      env.userData.cars.push(car);
      env.add(car);
    }

    // escudo em cúpula (achatado em z para não chegar perto da câmera)
    const top = H - 116, drop = 30;
    const R = ((W / 2) * (W / 2) + drop * drop) / (2 * drop);
    const toGround = (H - 12) - top;
    const theta = Math.acos(Math.max(-1, (R - toGround) / R));
    shield = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 28, 0, Math.PI * 2, 0, theta), shieldMat);
    shield.position.set(0, wy(top) - R, 0);
    shield.scale.z = 0.3;
    live.add(shield);

    // canhão (estilo brinquedo)
    cannon = new THREE.Group();
    const c = view.cannonPos();
    cannon.position.set(wx(c.x), wy(c.y), 0);
    const pedH = view.ground() - c.y;
    const pad = ink(new THREE.CylinderGeometry(30, 32, 6, 28), toon(0x2a2f6e));
    pad.position.y = -pedH + 3; cannon.add(pad);
    const padLight = new THREE.Mesh(new THREE.TorusGeometry(30, 1.2, 6, 40), new THREE.MeshBasicMaterial({ color: 0x3ee0ff }));
    padLight.rotation.x = Math.PI / 2; padLight.position.y = -pedH + 6.2; cannon.add(padLight);
    const ped = ink(new THREE.CylinderGeometry(14, 22, pedH, 24), toon(0x4a5ad0));
    ped.position.y = -pedH / 2; cannon.add(ped);
    const stripe = ink(new THREE.CylinderGeometry(19.5, 20.5, 5, 24), toon(0xfbbf24), 1);
    stripe.position.y = -pedH * 0.55; cannon.add(stripe);
    const dome = ink(new THREE.SphereGeometry(19, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x6c7cf0));
    dome.position.y = -6; cannon.add(dome);
    const pivot = new THREE.Group();
    const barrel = ink(new THREE.CylinderGeometry(5.5, 7, 32, 20), toon(0xeef0ff));
    barrel.position.y = 16; pivot.add(barrel);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 6, 20), new THREE.MeshBasicMaterial({ color: 0x3ee0ff }));
    tip.position.y = 30; pivot.add(tip);
    cannon.add(pivot);
    const core = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0x3ee0ff }));
    core.position.set(0, -2, 17); cannon.add(core);
    cannon.userData = { pivot, tip, core, padLight };
    live.add(cannon);
    cannonLight.position.set(wx(c.x), wy(c.y) + 30, 60);
  }

  function animateEnv(dt, T, st) {
    const u = env.userData;
    u.clouds.forEach((c) => {
      c.position.x += c.userData.v * dt;
      if (c.position.x > W * 2.8) c.position.x = -W * 2.8;
      if (c.position.x < -W * 2.8) c.position.x = W * 2.8;
    });
    u.cars.forEach((c) => {
      c.position.x += c.userData.v * dt * (st.overdrive ? 2 : 1);
      if (c.position.x > W * 1.6) c.position.x = -W * 1.6;
      if (c.position.x < -W * 1.6) c.position.x = W * 1.6;
    });
    u.lights.forEach((b) => { b.visible = Math.sin(T * 2.2 + b.userData.blink) > -0.3; });
  }

  // ---------- Objetos dinâmicos ----------
  const objs = new Map();     // id da ameaça -> objeto 3D
  let boss = null;

  function haloSprite(color, scale, opacity = 0.5) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(scale, scale, 1);
    return s;
  }

  function makeMeteor(t) {
    const g = new THREE.Group();
    const halo = haloSprite(0xa78bfa, t.r * 3.6, 0.45);
    halo.position.z = -t.r;
    g.add(halo);
    const trail = new THREE.Sprite(new THREE.SpriteMaterial({ map: trailTex, color: 0xc4b5fd, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    trail.scale.set(t.r * 1.5, t.r * 4.2, 1);
    trail.position.set(0, t.r * 2.1, -t.r * 0.5);
    g.add(trail);
    const mat = toon(0x9b7bff, { emissive: 0x3a1a8a, emissiveIntensity: 0.35 });
    const rock = ink(rockGeo(t.r, t.id), mat, 2.2);
    g.add(rock);
    // crateras
    for (let i = 0; i < 3; i++) {
      const cr = new THREE.Mesh(new THREE.SphereGeometry(t.r * (0.18 + i * 0.05), 10, 8), toon(0x6a4bd8));
      const a = i * 2.1 + t.id;
      cr.position.set(Math.cos(a) * t.r * 0.55, Math.sin(a) * t.r * 0.55, t.r * 0.62);
      cr.scale.z = 0.4;
      rock.add(cr);
    }
    const num = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberTex(String(t.value)), transparent: true, depthWrite: false, depthTest: false }));
    num.scale.set(t.r * 1.45, t.r * 1.45, 1);
    num.position.z = t.r * 1.25;
    num.renderOrder = 5;
    g.add(num);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(t.r + 9, 1.6, 8, 64), new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.9 }));
    ring.visible = false;
    g.add(ring);
    g.userData = { rock, mat, halo, trail, ring, num };
    return g;
  }

  function makeDrone(t, labels) {
    const n = t.code.length;
    const w = n * 26 + 28, h = labels ? 78 : 60;
    const g = new THREE.Group();
    const halo = haloSprite(0xa78bfa, w * 1.9, 0.35);
    halo.position.z = -30;
    g.add(halo);
    const bodyG = ink(slab(w - 8, h - 8, 20, 14), toon(0x5a3fc0, { emissive: 0x120a33, emissiveIntensity: 1 }), 2);
    const body = bodyG.userData.main;
    g.add(bodyG);
    const tex = canvasTex(512, Math.round(512 * (h - 14) / (w - 14)), (c, cw, ch) => drawScreen(c, cw, ch, t.code, labels));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 16, h - 16), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    screen.position.z = 15;
    g.add(screen);
    const props = [];
    [-1, 1].forEach((d) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 12, 8), toon(0xc4b5fd));
      post.position.set(d * w * 0.3, h / 2 + 4, 0);
      g.add(post);
      const prop = new THREE.Mesh(new THREE.BoxGeometry(40, 1.5, 5), toon(0xf5f3ff, { transparent: true, opacity: 0.85 }));
      prop.position.set(d * w * 0.3, h / 2 + 10, 0);
      g.add(prop);
      props.push(prop);
      const led = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf472b6 }));
      led.position.set(d * (w / 2 - 9), h / 2 - 9, 14);
      g.add(led);
    });
    g.userData = { body, props, screen, w, h };
    return g;
  }

  function makeBoss(S) {
    const w = S, h = S * 0.6;
    const g = new THREE.Group();
    const halo = haloSprite(0xf472b6, w * 2.1, 0.3);
    halo.position.z = -50;
    g.add(halo);
    const bodyMat = toon(0x7a3fd0, { emissive: 0x1a0838, emissiveIntensity: 1 });
    const bodyG = ink(slab(w - 8, h - 8, 36, 26), bodyMat, 2.6);
    const body = bodyG.userData.main;
    g.add(bodyG);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    [-1, 1].forEach((d) => {
      const eye = new THREE.Mesh(new THREE.CapsuleGeometry(4, 18, 4, 12), eyeMat);
      eye.rotation.z = Math.PI / 2 + d * 0.22;
      eye.position.set(d * w * 0.22, h * 0.29, 24);
      g.add(eye);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 22, 8), toon(0xf9a8d4));
      ant.position.set(d * w * 0.32, h / 2 + 9, 0);
      ant.rotation.z = -d * 0.45;
      g.add(ant);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf472b6 }));
      ball.position.set(d * w * 0.37, h / 2 + 19, 0);
      g.add(ball);
    });
    const sw = w - 30, sh = h * 0.44;
    const sc = document.createElement('canvas');
    sc.width = 512; sc.height = Math.round(512 * sh / sw);
    const stex = new THREE.CanvasTexture(sc);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: stex, transparent: true }));
    screen.position.set(0, h * 0.12 - sh / 2, 24);
    g.add(screen);
    const bar = (y, color) => {
      const bg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }));
      bg.position.set(0, y, 10);
      const fg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 5.5, 5), new THREE.MeshBasicMaterial({ color }));
      fg.position.set(0, y, 11);
      g.add(bg); g.add(fg);
      return fg;
    };
    const hp = bar(h / 2 + 34, 0xf472b6);
    const charge = bar(-h / 2 - 16, 0xfbbf24);
    g.userData = { body, bodyMat, eyeMat, screen, sc, stex, hp, charge, w, h, codeKey: '' };
    return g;
  }

  function syncThreats(view) {
    const { st, L, T } = view;
    const seen = new Set();
    st.threats.forEach((t) => {
      if (t.dead) return;
      seen.add(t.id);
      let o = objs.get(t.id);
      if (!o) {
        o = t.type === 'drone' ? makeDrone(t, L.labels) : makeMeteor(t);
        objs.set(t.id, o);
        scene.add(o);
      }
      const p = view.pos(t);
      const u = o.userData;
      if (t.type === 'drone') {
        o.position.set(wx(p.x), wy(p.y + Math.sin(T * 3 + t.id) * 3), 0);
        o.rotation.y = Math.sin(T * 0.9 + t.id) * 0.32;
        o.rotation.x = -0.12 + Math.sin(T * 1.3 + t.id) * 0.05;
        u.props.forEach((pr, i) => { pr.rotation.y = T * 30 * (i ? 1 : -1); });
        u.body.material.emissive.setHex(t.flash > 0 ? 0x8a7fff : (t.p > 0.72 ? 0x5a0a2a : 0x120a33));
      } else {
        o.position.set(wx(p.x), wy(p.y), 0);
        // o número fica mais perto da câmera: compensa a perspectiva para ele cair bem no centro da rocha
        const k = u.num.position.z / DIST;
        u.num.position.x = -o.position.x * k;
        u.num.position.y = -o.position.y * k;
        u.rock.rotation.set(t.rot * 0.7, t.rot, t.rot * 0.3);
        u.trail.visible = !t.float && !t.targeted;
        const danger = !t.float && t.p > 0.72;
        u.ring.visible = danger;
        if (danger) { const s = 1 + Math.sin(T * 10) * 0.04; u.ring.scale.set(s, s, s); }
        u.halo.material.color.setHex(danger ? 0xfb7185 : 0xa78bfa);
        u.mat.emissive.setHex(t.flash > 0 ? 0xffffff : 0x3a1a8a);
        u.mat.emissiveIntensity = t.flash > 0 ? 0.25 + t.flash : 0.35;
      }
    });
    objs.forEach((o, id) => {
      if (!seen.has(id)) { scene.remove(o); disposeTree(o); objs.delete(id); }
    });
  }

  function syncBoss(view) {
    const { st, L, T } = view;
    const show = L.kind === 'letters' && st.boss && !st.boss.dead;
    if (!show) {
      if (boss) { scene.remove(boss); disposeTree(boss); boss = null; }
      return;
    }
    const S = Math.min((W - 100) * 0.85, 230);
    if (!boss || Math.abs(boss.userData.w - S) > 1) {
      if (boss) { scene.remove(boss); disposeTree(boss); }
      boss = makeBoss(S);
      scene.add(boss);
    }
    const u = boss.userData;
    boss.position.set(wx(view.bossX() + Math.sin(T * 1.3) * 8), wy(H * 0.28 + Math.sin(T * 2.1) * 5), 0);
    boss.rotation.y = Math.sin(T * 0.8) * 0.22;
    boss.rotation.x = -0.08;
    let code = st.code || '00000';
    if (st.codeFlip > 0) code = code.split('').map(() => (Math.random() < 0.5 ? '0' : '1')).join('');
    if (code !== u.codeKey) {
      u.codeKey = code;
      drawScreen(u.sc.getContext('2d'), u.sc.width, u.sc.height, code, false);
      u.stex.needsUpdate = true;
    }
    const f = Math.max(0.001, st.boss.hp / st.boss.max);
    u.hp.scale.x = f; u.hp.position.x = -(u.w * 0.6) * (1 - f) / 2;
    const c = st.wait > 0 ? 0.001 : Math.max(0.001, Math.min(1, st.charge));
    u.charge.scale.x = c; u.charge.position.x = -(u.w * 0.6) * (1 - c) / 2;
    u.charge.material.color.setHex(st.charge > 0.7 ? 0xfb7185 : 0xfbbf24);
    u.eyeMat.color.setHex(st.charge > 0.7 ? 0xfb7185 : 0xfbbf24);
    u.bodyMat.emissive.setHex(st.boss.flash > 0 ? 0xffffff : 0x1a0838);
    u.bodyMat.emissiveIntensity = st.boss.flash > 0 ? st.boss.flash * 2 : 1;
  }

  // ---------- Feixes ----------
  const UP = new THREE.Vector3(0, 1, 0);
  const beamPool = [];
  function segMesh() {
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const g = new THREE.Group();
    g.add(glow); g.add(core);
    g.userData = { glow, core };
    scene.add(g);
    return g;
  }
  function placeSeg(g, a, b, wGlow, wCore, color, alpha) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    if (len < 0.5) { g.visible = false; return; }
    g.visible = true;
    g.position.copy(a).addScaledVector(d, 0.5);
    g.quaternion.setFromUnitVectors(UP, d.normalize());
    g.userData.glow.scale.set(wGlow, len, wGlow);
    g.userData.core.scale.set(wCore, len, wCore);
    g.userData.glow.material.color.copy(color);
    g.userData.glow.material.opacity = alpha * 0.55;
    g.userData.core.material.opacity = wCore ? alpha : 0;
  }
  const impactPool = [];
  function beamColor(style, T, i) {
    const c = new THREE.Color();
    if (style === 'plasma') c.setHex(0xf472b6);
    else if (style === 'pixel') c.setHex([0x34d399, 0xfbbf24, 0x3ee0ff][Math.floor(T * 12 + i) % 3]);
    else if (style === 'arcoiris') c.setHSL((T * 0.8) % 1, 1, 0.6);
    else c.setHex(0x3ee0ff);
    return c;
  }
  function syncBeams(view) {
    const { st, T } = view;
    const style = Store.data.equip.laser;
    let used = 0, imp = 0;
    const use = () => { if (!beamPool[used]) beamPool[used] = segMesh(); return beamPool[used++]; };
    const impact = (x, y, s, a, color) => {
      if (!impactPool[imp]) { impactPool[imp] = haloSprite(0xffffff, 10, 1); scene.add(impactPool[imp]); }
      const sp = impactPool[imp++];
      sp.visible = true; sp.position.set(x, y, 20); sp.scale.set(s, s, 1);
      sp.material.opacity = a; sp.material.color.copy(color);
    };
    st.beams.forEach((b, i) => {
      const k = b.t / b.dur, a = 1 - k;
      const A = new THREE.Vector3(wx(b.x1), wy(b.y1), 8);
      const B = new THREE.Vector3(wx(b.x2), wy(b.y2), 8);
      if (b.enemy) {
        placeSeg(use(), A, B, 7, 2, new THREE.Color(0xfb7185), a);
        return;
      }
      const col = beamColor(style, T, i);
      const wob = style === 'plasma' ? 9 + Math.sin(T * 40) * 3 : style === 'pixel' ? 8 : 10;
      if (b.bounce) {
        const k1 = Math.min(1, k * 2.5);
        const E = A.clone().lerp(B, k1);
        placeSeg(use(), A, E, wob, 2, col, a * 0.8);
        if (k1 >= 1) {
          const k2 = Math.min(1, (k - 0.4) * 2);
          if (k2 > 0) {
            const C = new THREE.Vector3(wx(b.bounce.x), wy(b.bounce.y), 8);
            placeSeg(use(), B, B.clone().lerp(C, k2), 5, 0, new THREE.Color(0xfb923c), a);
          }
          impact(B.x, B.y, 30 + 40 * k, a * 0.8, new THREE.Color(0xffffff));
        }
        return;
      }
      placeSeg(use(), A, B, wob, 2.4, col, a);
      impact(B.x, B.y, 40 + 70 * k, a, col);
    });
    for (let i = used; i < beamPool.length; i++) beamPool[i].visible = false;
    for (let i = imp; i < impactPool.length; i++) impactPool[i].visible = false;
  }

  // ---------- Partículas e PEM ----------
  const MAXP = 700;
  const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 9, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false;
  scene.add(points);
  const tmpC = new THREE.Color();
  function syncParticles(view) {
    const ps = view.st.parts;
    const n = Math.min(MAXP, ps.length);
    for (let i = 0; i < n; i++) {
      const p = ps[i];
      pPos[i * 3] = wx(p.x); pPos[i * 3 + 1] = wy(p.y); pPos[i * 3 + 2] = 14 + (i % 7) * 3;
      tmpC.set(p.c);
      const a = Math.max(0, Math.min(1, p.life * 2));
      pCol[i * 3] = tmpC.r * a; pCol[i * 3 + 1] = tmpC.g * a; pCol[i * 3 + 2] = tmpC.b * a;
    }
    pGeo.setDrawRange(0, n);
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }
  const ringPool = [];
  function syncRings(view) {
    const c = view.cannonPos();
    view.st.rings.forEach((r, i) => {
      if (!ringPool[i]) {
        ringPool[i] = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 8, 96), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        scene.add(ringPool[i]);
      }
      const m = ringPool[i];
      const s = Math.max(1, (1 - r.life) * Math.max(W, H) * 1.3);
      m.visible = true;
      m.position.set(wx(c.x), wy(c.y), 10);
      m.scale.set(s, s, s);
      m.rotation.x = 0.35;
      m.material.opacity = r.life;
    });
    for (let i = view.st.rings.length; i < ringPool.length; i++) ringPool[i].visible = false;
  }

  // ---------- API ----------
  // ---------- Qualidade automática ----------
  // Mede os quadros por segundo. Se o aparelho não aguentar, baixa a resolução;
  // se ainda assim ficar lento, desliga o 3D e o jogo continua no desenho 2D.
  // Degraus: resolução cheia -> fundo "congelado" (desenhado uma vez só) -> resolução menor -> 2D.
  let quality = 0, devDpr = 1, frames = 0, tAcc = 0, lastT = 0;
  const STEPS = [{ res: 2, bake: false }, { res: 2, bake: true }, { res: 1.25, bake: true }, { res: 0.85, bake: true }];
  const RES = STEPS.map((x) => x.res);
  let baked = false, rt = null;
  function applyRes() {
    renderer.setPixelRatio(Math.min(RES[quality], devDpr));
    renderer.setSize(W, H, false);
    baked = STEPS[quality].bake;
    if (baked) bake(); else unbake();
  }
  function bake() {
    if (!env) return;
    const hidden = [];
    scene.children.forEach((o) => { if (o !== env && o.visible && !o.isLight) { hidden.push(o); o.visible = false; } });
    env.visible = true;
    scene.background = duskTex;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (!rt || rt.width !== size.x || rt.height !== size.y) {
      if (rt) rt.dispose();
      rt = new THREE.WebGLRenderTarget(size.x, size.y, { samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
    }
    camera.position.set(0, 0, DIST);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    hidden.forEach((o) => { o.visible = true; });
    env.visible = false;
    scene.background = rt.texture;
  }
  function unbake() {
    if (env) env.visible = true;
    scene.background = duskTex;
  }
  function measure() {
    const now = performance.now();
    const dt = now - lastT;
    lastT = now;
    if (dt > 250) { frames = 0; tAcc = 0; return; }       // aba escondida, pausa etc.
    frames++;
    if (frames <= 20) return;                              // ignora o começo
    tAcc += dt;
    if (frames < 110) return;
    const fps = 1000 * 90 / tAcc;
    frames = 0; tAcc = 0;
    if (fps >= 40) return;
    if (quality < RES.length - 1) { quality++; applyRes(); }
    else if (fps < 24) { api.active = false; canvas.style.display = 'none'; }
  }

  let lastKey = '';
  function resize(w, h, dpr) {
    W = w; H = h;
    devDpr = dpr || 1;
    renderer.setPixelRatio(Math.min(RES[quality], devDpr));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    DIST = (h / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, DIST);
    camera.lookAt(0, 0, 0);
    camera.far = DIST + 5000;
    camera.updateProjectionMatrix();
    scene.fog = new THREE.Fog(0x4a2370, DIST + 150, DIST + 2300);
    sun.position.set(W * 0.9, H * 0.7, DIST * 0.8);
    rim.position.set(-W, H * 0.3, -300);
    lastKey = '';
  }

  function reset() {
    objs.forEach((o) => { scene.remove(o); disposeTree(o); });
    objs.clear();
    if (boss) { scene.remove(boss); disposeTree(boss); boss = null; }
  }

  function render(view) {
    const { st, T } = view;
    if (!st.paused) measure();
    const key = `${W}x${H}`;
    if (key !== lastKey) { buildEnv(view); lastKey = key; if (baked) bake(); }

    // nuvens, carros voadores e luzes piscando; o chão "anda" mais rápido no Overdrive
    const dt = Math.min(0.05, Math.max(0, T - (render.lastT || T)));
    render.lastT = T;
    if (!baked) animateEnv(dt, T, st);
    circuitTex.offset.y = (circuitTex.offset.y + (st.overdrive ? 0.03 : 0.004)) % 1;
    stars.material.opacity = 0.6 + 0.25 * Math.sin(T * 1.5);

    // escudo
    const lvl = st.maxShield ? st.shield / st.maxShield : 1;
    shieldMat.uniforms.uColor.value.setHex(st.shake > 0 ? 0xfb7185 : lvl > 0.5 ? 0x3ee0ff : 0xfbbf24);
    shieldMat.uniforms.uAlpha.value = 0.35 + 0.65 * lvl;
    shieldMat.uniforms.uTime.value = T;

    // canhão
    const accent = st.overdrive ? 0xfbbf24 : 0x3ee0ff;
    cannon.userData.pivot.rotation.z = -st.aim - Math.PI / 2;
    cannon.userData.tip.material.color.setHex(accent);
    cannon.userData.core.material.color.setHex(accent);
    cannonLight.color.setHex(accent);
    hemi.color.setHex(st.overdrive ? 0xffd48a : 0xc4b5ff);
    cannon.userData.padLight.material.color.setHex(accent);

    syncThreats(view);
    syncBoss(view);
    syncBeams(view);
    syncParticles(view);
    syncRings(view);

    const sh = st.shake > 0 ? st.shake : 0;
    camera.position.x = (Math.random() - 0.5) * 12 * sh;
    camera.position.y = (Math.random() - 0.5) * 12 * sh;
    renderer.render(scene, camera);
  }

  const api = { active: true, resize, render, reset };
  return api;
})();
