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
  // Texturas desenhadas em alta definição (2x o tamanho pedido) e com filtragem máxima do aparelho.
  const TEXQ = 2;
  const MAX_ANISO = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4;
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w * TEXQ; c.height = h * TEXQ;
    const g = c.getContext('2d');
    g.scale(TEXQ, TEXQ);
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = MAX_ANISO;
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

  // ---------- Estilo cartoon: sombreado em faixas (toon) + contorno só nos objetos do jogo ----------
  const toonGrad = (() => {
    const d = new Uint8Array([110, 110, 110, 255, 170, 170, 170, 255, 215, 215, 215, 255, 240, 240, 240, 255]);
    const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  })();
  const toon = (color, extra) => new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: toonGrad }, extra || {}));
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x1b1240, side: THREE.BackSide });
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
    return g;
  }

  // ---------- Hora do dia: muda conforme o jogo avança ----------
  // Setor 1 = manhã, 2 = tarde, 3 = pôr do sol, 4 = noite clara. Dentro da fase o céu anda um pouco a cada acerto.
  const SKIES = [
    { name: 'manhã', top: '#6ec3ff', mid: '#b4e2ff', hor: '#fff4dc', ground: '#8edca8', far: '#86c9e6', near: '#55c98a', sun: '#fff3b0', sunY: 0.78, cloud: '#ffffff', hemi: '#ffffff', light: '#fff6e0', stars: 0, moon: 0 },
    { name: 'tarde', top: '#4ea9ff', mid: '#9fd4ff', hor: '#ffe6b8', ground: '#a6db90', far: '#97b8ee', near: '#6fc483', sun: '#ffd77a', sunY: 0.55, cloud: '#fffaf0', hemi: '#fff3e0', light: '#ffe6c0', stars: 0, moon: 0 },
    { name: 'pôr do sol', top: '#7c86e0', mid: '#f6b3cf', hor: '#ffcf9e', ground: '#c9a8e4', far: '#c08fe0', near: '#8f7ee0', sun: '#ff9f7a', sunY: 0.22, cloud: '#ffe0ec', hemi: '#ffd6e6', light: '#ffb98f', stars: 0, moon: 0 },
    { name: 'noite', top: '#33408c', mid: '#6670c8', hor: '#a9b2f0', ground: '#6d79c9', far: '#7179cf', near: '#4f5cb8', sun: '#fff6d8', sunY: 0.7, cloud: '#b9c0f2', hemi: '#c8d0ff', light: '#d8e0ff', stars: 1, moon: 1 },
  ];
  const cA = new THREE.Color(), cB = new THREE.Color();
  function mix(key, a, b, t, out) { cA.set(a[key]); cB.set(b[key]); return out.copy(cA).lerp(cB, t); }
  function skyAt(p) {           // p vai de 0 (manhã do setor 1) a 3 (noite)
    p = Math.max(0, Math.min(3, p));
    const i = Math.min(2, Math.floor(p)), t = p - i;
    return { a: SKIES[i], b: SKIES[i + 1], t };
  }
  function progressOf(view) {
    const { st, L } = view;
    if (L.duration) return 3 * (1 - st.timeLeft / L.duration);               // Relâmpago: o dia inteiro em 1 minuto
    const within = L.count ? st.done / L.count : 0;
    return (L.sector - 1) + Math.min(0.95, (L.index + within) / 5) * 0.95;     // fases do setor avançam a hora aos pouquinhos
  }

  // céu em degradê desenhado direto na tela (cores vêm de SKIES)
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } },
    vertexShader: 'varying float vY; void main() { vY = position.y; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; varying float vY;
      void main() {
        float h = clamp(vY, 0.0, 1.0);
        vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.35, h));
        c = mix(c, uTop, smoothstep(0.35, 1.0, h));
        if (vY < 0.0) c = uHor;
        float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        c += (n - 0.5) * 0.018;   // granulado sutil: tira as faixas do degradê
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthWrite: false, depthTest: false,
  });
  SHARED.add(skyMat);
  const starTex = canvasTex(32, 32, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,1)'); r.addColorStop(0.7, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const discTex = canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, w / 2, w * 0.46, 0, Math.PI * 2); g.fill();
  });

  // ---------- Texturas procedurais (claras, para a cor da hora do dia aparecer por cima) ----------
  const prng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  function texRepeat(t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
  // grama: fundo claro com pontinhos e folhinhas em tons variados
  const grassTex = texRepeat(canvasTex(256, 256, (g, w) => {
    const R = prng(7);
    g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 1800; i++) {
      const x = R() * w, y = R() * w, v = 200 + Math.floor(R() * 55);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 2, 2);
    }
    g.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      const x = R() * w, y = R() * w, l = 4 + R() * 7, v = R() < 0.5 ? 255 : 190 + Math.floor(R() * 30);
      g.strokeStyle = `rgba(${v},${v},${v},.9)`; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - 0.5) * 4, y - l * 0.6, x + (R() - 0.5) * 6, y - l); g.stroke();
    }
  }));
  // gramado com faixas de corte que somem no horizonte
  const lawnTex = texRepeat(canvasTex(256, 256, (g, w) => {
    const R = prng(11);
    g.fillStyle = '#efefef'; g.fillRect(0, 0, w / 2, w);
    g.fillStyle = '#dcdcdc'; g.fillRect(w / 2, 0, w / 2, w);
    for (let i = 0; i < 2600; i++) {
      const v = 205 + Math.floor(R() * 50);
      g.fillStyle = `rgba(${v},${v},${v},.8)`;
      g.fillRect(R() * w, R() * w, 2, 3);
    }
  }));
  // rocha dos meteoros: manchas e "crateras" suaves
  const rockTex = texRepeat(canvasTex(256, 128, (g, w, h) => {
    const R = prng(3);
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = R() * w, y = R() * h, r = 4 + R() * 14;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(150,150,150,.55)'); gr.addColorStop(0.7, 'rgba(190,190,190,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(x - r * 0.15, y - r * 0.15, r * 0.75, Math.PI * 0.9, Math.PI * 1.6); g.stroke();
    }
    for (let i = 0; i < 1500; i++) {
      const v = 200 + Math.floor(R() * 55);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(R() * w, R() * h, 2, 2);
    }
  }));
  // nuvem: variação bem leve de tom
  const cloudTex = texRepeat(canvasTex(128, 128, (g, w) => {
    const R = prng(5);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 40; i++) {
      const x = R() * w, y = R() * w, r = 8 + R() * 20;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(225,225,235,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }));

  // ---------- Luzes ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8fa0d8, 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dc, 0.55);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xb8c8ff, 0.35);
  scene.add(rim);
  const cannonLight = new THREE.PointLight(0x3ee0ff, 0.8, 300, 2);
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
        float f = pow(1.0 - abs(dot(vN, vV)), 2.0);
        float scan = 0.5 + 0.5 * sin(vP.y * 0.12 - uTime * 3.0);
        gl_FragColor = vec4(uColor, (f * 0.6 + scan * 0.025) * uAlpha);
      }`,
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
  SHARED.add(shieldMat);

  function disposeTree(o) {
    o.traverse((m) => {
      if (m.geometry) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { if (!SHARED.has(x)) x.dispose(); });
    });
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  // materiais que mudam de cor com a hora do dia
  const M = {
    ground: toon(0xa7e8c0, { map: lawnTex }),
    far: toon(0xa9d9ee, { map: grassTex }),
    near: toon(0x86d9ad, { map: grassTex }),
    cloud: toon(0xffffff, { map: cloudTex, emissive: 0xffffff, emissiveIntensity: 0.22 }),
    sun: new THREE.SpriteMaterial({ map: discTex, color: 0xfff3b0, fog: false, depthWrite: false }),
    sunGlow: new THREE.SpriteMaterial({ map: glowTex, color: 0xfff3b0, fog: false, depthWrite: false, transparent: true, opacity: 0.55 }),
    moon: new THREE.SpriteMaterial({ map: discTex, color: 0xfff6d8, fog: false, depthWrite: false, transparent: true }),
  };
  Object.values(M).forEach((m) => SHARED.add(m));

  function cloud(s) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const r = s * rand(0.3, 0.46);
      const c = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), M.cloud);
      c.position.set((i - (n - 1) / 2) * s * 0.34, Math.abs(i - (n - 1) / 2) < 1 ? r * 0.3 : 0, 0);
      g.add(c);
    }
    g.scale.y = 0.6;
    return g;
  }
  function hill(r, h, mat) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    m.scale.y = h / r;
    return m;
  }

  function buildEnv(view) {
    if (env) { scene.remove(env); disposeTree(env); }
    if (live) { scene.remove(live); disposeTree(live); }
    env = new THREE.Group();
    env.userData = { clouds: [] };
    scene.add(env);
    live = new THREE.Group();   // o que continua sendo desenhado ao vivo mesmo com o fundo "congelado"
    scene.add(live);
    const gy = wy(view.ground());

    // céu: um retângulo do tamanho da tela, atrás de tudo
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    env.add(sky);

    // estrelas (aparecem à noite)
    const N = 160;
    const sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      sp[i * 3] = (Math.random() - 0.5) * W * 6;
      sp[i * 3 + 1] = H * 0.5 + Math.random() * H * 2.6;
      sp[i * 3 + 2] = -2600;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, map: starTex, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    env.add(stars);

    // sol e lua
    const S = Math.max(W, H);
    const sunG = new THREE.Group();
    const glow = new THREE.Sprite(M.sunGlow); glow.scale.set(S * 3.2, S * 3.2, 1); sunG.add(glow);
    const disc = new THREE.Sprite(M.sun); disc.scale.set(S * 0.95, S * 0.95, 1); sunG.add(disc);
    sunG.renderOrder = -5;
    env.add(sunG);
    const moon = new THREE.Sprite(M.moon); moon.scale.set(S * 0.6, S * 0.6, 1);
    moon.position.set(-W * 1.0, H * 1.6, -2700);
    env.add(moon);
    env.userData.sun = sunG;
    env.userData.moon = moon;

    // colinas arredondadas em duas camadas
    for (let i = 0; i < 7; i++) {
      const r = rand(500, 900);
      const h = hill(r, r * rand(0.28, 0.4), M.far);
      h.position.set(-W * 3.2 + i * W * 1.05 + rand(-120, 120), gy, -1900 - rand(0, 300));
      env.add(h);
    }
    for (let i = 0; i < 7; i++) {
      const r = rand(220, 380);
      const h = hill(r, r * rand(0.25, 0.38), M.near);
      h.position.set(-W * 1.8 + i * W * 0.6 + rand(-60, 60), gy, -650 - rand(0, 150));
      env.add(h);
    }

    // nuvens fofas
    for (let i = 0; i < 5; i++) {
      const c = cloud(rand(110, 190));
      c.position.set(rand(-W * 2.2, W * 2.2), rand(H * 0.25, H * 1.0), -1400 - rand(0, 500));
      c.userData.v = rand(8, 18) * (Math.random() < 0.5 ? -1 : 1);
      env.userData.clouds.push(c);
      env.add(c);
    }

    // chão
    lawnTex.repeat.set(16, 60);
    grassTex.repeat.set(10, 3);
    ground = new THREE.Mesh(new THREE.PlaneGeometry(W * 14, 5200), M.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, gy, -2500);
    env.add(ground);

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
    const pad = ink(new THREE.CylinderGeometry(30, 32, 6, 28), toon(0x5b6bd6));
    pad.position.y = -pedH + 3; cannon.add(pad);
    const padLight = new THREE.Mesh(new THREE.TorusGeometry(30, 1.2, 6, 40), new THREE.MeshBasicMaterial({ color: 0x3ee0ff }));
    padLight.rotation.x = Math.PI / 2; padLight.position.y = -pedH + 6.2; cannon.add(padLight);
    const ped = ink(new THREE.CylinderGeometry(14, 22, pedH, 24), toon(0x6a7cf0));
    ped.position.y = -pedH / 2; cannon.add(ped);
    const stripe = ink(new THREE.CylinderGeometry(19.5, 20.5, 5, 24), toon(0xfbbf24), 1);
    stripe.position.y = -pedH * 0.55; cannon.add(stripe);
    const dome = ink(new THREE.SphereGeometry(19, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x8a9bff));
    dome.position.y = -6; cannon.add(dome);
    const pivot = new THREE.Group();
    const barrel = ink(new THREE.CylinderGeometry(5.5, 7, 32, 20), toon(0xffffff));
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

  // aplica as cores da hora do dia
  const tmp = new THREE.Color();
  function applySky(p) {
    const { a, b, t } = skyAt(p);
    mix('top', a, b, t, skyMat.uniforms.uTop.value);
    mix('mid', a, b, t, skyMat.uniforms.uMid.value);
    mix('hor', a, b, t, skyMat.uniforms.uHor.value);
    if (scene.fog) mix('hor', a, b, t, scene.fog.color);
    mix('ground', a, b, t, M.ground.color);
    mix('far', a, b, t, M.far.color);
    mix('near', a, b, t, M.near.color);
    mix('cloud', a, b, t, M.cloud.color);
    mix('sun', a, b, t, M.sun.color);
    M.sunGlow.color.copy(M.sun.color);
    mix('hemi', a, b, t, hemi.color);
    mix('light', a, b, t, sun.color);
    const nightK = a.stars + (b.stars - a.stars) * t;
    const moonK = a.moon + (b.moon - a.moon) * t;
    stars.material.opacity = nightK * 0.9;
    // o sol desce do alto da manhã até sumir no horizonte; à noite fica a lua
    const sunY = a.sunY + (b.sunY - a.sunY) * t;
    const sunVisible = 1 - moonK;
    env.userData.sun.position.set(W * 0.9, -H * 0.05 + sunY * H * 1.6, -2600);
    env.userData.sun.visible = sunVisible > 0.05;
    M.sun.opacity = sunVisible; M.sun.transparent = true;
    M.sunGlow.opacity = 0.5 * sunVisible;
    M.moon.opacity = moonK;
    env.userData.moon.visible = moonK > 0.05;
    tmp.set(0xffffff);
    void tmp;
  }

  function animateEnv(dt, T, st) {
    env.userData.clouds.forEach((c) => {
      c.position.x += c.userData.v * dt;
      if (c.position.x > W * 2.6) c.position.x = -W * 2.6;
      if (c.position.x < -W * 2.6) c.position.x = W * 2.6;
    });
  }

  // ---------- Objetos dinâmicos ----------
  const objs = new Map();     // id da ameaça -> objeto 3D
  let boss = null;

  function haloSprite(color, scale, opacity = 0.5) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false }));
    s.scale.set(scale, scale, 1);
    return s;
  }

  function makeMeteor(t) {
    const g = new THREE.Group();
    const halo = haloSprite(0xa78bfa, t.r * 3.2, 0.22);
    halo.position.z = -t.r;
    g.add(halo);
    const trail = new THREE.Sprite(new THREE.SpriteMaterial({ map: trailTex, color: 0xc4b5fd, transparent: true, opacity: 0.55, depthWrite: false }));
    trail.scale.set(t.r * 1.3, t.r * 4.2, 1);
    trail.material.color.setHex(0xffffff);
    trail.position.set(0, t.r * 2.1, -t.r * 0.5);
    g.add(trail);
    const mat = toon(0x9b7bff, { map: rockTex, emissive: 0x3a1a8a, emissiveIntensity: 0.3 });
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
    const halo = haloSprite(0xa78bfa, w * 1.9, 0.18);
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
    const halo = haloSprite(0xf472b6, w * 2.1, 0.18);
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
    sc.width = 1024; sc.height = Math.round(1024 * sh / sw);
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
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
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
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 9, map: dotTex, vertexColors: true, transparent: true, depthWrite: false }));
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
        ringPool[i] = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 8, 96), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, depthWrite: false }));
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
  const STEPS = [{ res: 3, bake: false }, { res: 3, bake: true }, { res: 2, bake: true }, { res: 1.5, bake: true }];
  const RES = STEPS.map((x) => x.res);
  let baked = false, rt = null, bakedP = -1, bakedAt = 0;
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
    scene.background = null;
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
    scene.background = null;
  }
  // mede por TEMPO (não por número de quadros): decide a cada 2 s, depois de 1,5 s de aquecimento.
  // Muito lento (< 15 fps) pula duas etapas de uma vez; sem mais etapas e ainda < 24 fps, troca para o 2D.
  let warm = 0;
  function measure() {
    const now = performance.now();
    const dt = now - lastT;
    lastT = now;
    if (dt > 400) { frames = 0; tAcc = 0; return; }       // aba escondida, pausa etc.
    if (warm < 1500) { warm += dt; return; }              // começo: texturas e shaders ainda carregando
    frames++;
    tAcc += dt;
    if (tAcc < 2000) return;
    const fps = 1000 * frames / tAcc;
    frames = 0; tAcc = 0;
    if (fps >= 40) return;
    if (quality < RES.length - 1) {
      quality = Math.min(RES.length - 1, quality + (fps < 15 ? 2 : 1));
      applyRes();
      warm = 800;                                          // dá um respiro antes de medir de novo
    } else if (fps < 24) { api.active = false; canvas.style.display = 'none'; }
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
    scene.fog = new THREE.Fog(0xfff4dc, DIST + 1200, DIST + 4200);
    sun.position.set(W * 0.8, H * 1.2, DIST);
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
    // hora do dia de acordo com o avanço no jogo (no modo econômico, o fundo é refeito quando a cor muda)
    const p = progressOf(view);
    applySky(p);
    // no modo econômico o fundo congelado só é refeito quando a cor do céu mudou de verdade, e no máximo a cada 2 s
    if (baked && Math.abs(p - bakedP) > 0.05 && performance.now() - bakedAt > 2000) { bake(); bakedP = p; bakedAt = performance.now(); }
    if (!baked) {
      animateEnv(dt, T, st);
      lawnTex.offset.y = (lawnTex.offset.y + (st.overdrive ? 0.02 : 0.003)) % 1;
    }

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
