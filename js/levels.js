// Campanha em 4 setores. Cada fase descreve o que aparece e quanto apoio visual o aluno recebe.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const SECTORS = [
  {
    id: 1, name: 'Laboratório de Energia', icon: '🔬', color: '#3dff9e',
    desc: 'Sem tempo! Monte de 1 a 15 com 4 bits. A soma aparece ao vivo.',
    levels: [
      { name: 'Primeiros bits', pool: [1, 2, 3], count: 5 },
      { name: 'Até 7', pool: range(1, 7), count: 6 },
      { name: 'O bit 8', pool: range(8, 15), count: 6 },
      { name: 'Mistura', pool: range(1, 15), count: 8 },
      { name: 'Mestre do Lab', pool: range(1, 15), count: 10 },
    ].map((l) => Object.assign(l, { kind: 'build', bits: 4, showSum: true, fall: 0, max: 1 })),
  },
  {
    id: 2, name: 'Chuva de Meteoros', icon: '☄️', color: '#22e6ff',
    desc: 'O bit 16 chegou! Números de 1 a 31 caindo. A soma fica escondida.',
    levels: [
      { name: 'O bit 16', pool: range(16, 31), count: 6, fall: 24, max: 1, every: 3 },
      { name: 'Garoa', pool: range(1, 31), count: 8, fall: 20, max: 1, every: 3 },
      { name: 'Dois de uma vez', pool: range(1, 31), count: 10, fall: 20, max: 2, every: 5 },
      { name: 'Tempestade', pool: range(1, 31), count: 12, fall: 17, max: 2, every: 4 },
      { name: 'Chuva de Meteoros', pool: range(1, 31), count: 14, fall: 15, max: 3, every: 4 },
    ].map((l) => Object.assign(l, { kind: 'build', bits: 5, showSum: false, shield: 3 })),
  },
  {
    id: 3, name: 'Invasão Hacker', icon: '👾', color: '#ff4fd8',
    desc: 'Ao contrário! O drone mostra o código binário e você escolhe o número.',
    levels: [
      { name: 'Código de 3 bits', bits: 3, labels: true, count: 6, fall: 22 },
      { name: 'Código de 4 bits', bits: 4, labels: true, count: 8, fall: 20 },
      { name: 'Código de 5 bits', bits: 5, labels: true, count: 8, fall: 18 },
      { name: 'Sem dicas', bits: 5, labels: false, count: 10, fall: 16 },
      { name: 'Invasão total', bits: 5, labels: false, count: 12, fall: 12 },
    ].map((l) => Object.assign(l, { kind: 'decode', pool: range(1, Math.pow(2, l.bits) - 1), shield: 3, max: 1 })),
  },
  {
    id: 4, name: 'Decifrador Secreto', icon: '🔐', color: '#ffd23f',
    desc: 'Chefes! Traduza o binário em letras (A=1, B=2…) e forme palavras.',
    levels: [
      { name: 'Glitch Junior', words: ['SOL', 'PAZ', 'LUA'], charge: 28 },
      { name: 'Glitch Marujo', words: ['BIT', 'MAR', 'RIO'], charge: 25 },
      { name: 'Glitch Chip', words: ['DADO', 'CHIP', 'BYTE'], charge: 22 },
      { name: 'Glitch Pixel', words: ['ROBO', 'PIXEL', 'LASER'], charge: 20 },
      { name: 'Rei Glitch', words: ['CODIGO', 'BINARIO'], charge: 18 },
    ].map((l) => Object.assign(l, { kind: 'letters', bits: 5, shield: 3, count: l.words.join('').length })),
  },
];

SECTORS.forEach((s) => s.levels.forEach((l, i) => {
  l.id = `${s.id}-${i + 1}`;
  l.sector = s.id;
  l.index = i;
  l.color = s.color;
}));

const ALL_LEVELS = SECTORS.flatMap((s) => s.levels);
const levelById = (id) => ALL_LEVELS.find((l) => l.id === id);
const nextLevel = (l) => ALL_LEVELS[ALL_LEVELS.indexOf(l) + 1] || null;

function isUnlocked(l) {
  if (Store.data.unlockAll) return true;
  const i = ALL_LEVELS.indexOf(l);
  return i === 0 || (Store.data.stars[ALL_LEVELS[i - 1].id] || 0) > 0;
}

// ---------- Missão Relâmpago: 1 minuto, uma regra diferente por dia ----------
const FLASH_RULES = [
  { id: 'impares', name: 'Ímpares', hint: 'Todo ímpar liga o bit 1!', pool: range(1, 31).filter((n) => n % 2) },
  { id: 'pares', name: 'Pares', hint: 'Todo par deixa o bit 1 desligado!', pool: range(2, 30).filter((n) => n % 2 === 0) },
  { id: 'grandes', name: 'Gigantes (16 a 31)', hint: 'Comece sempre pelo 16!', pool: range(16, 31) },
  { id: 'misto', name: 'Misturados (1 a 31)', hint: 'Do maior bit para o menor!', pool: range(1, 31) },
  { id: 'pequenos', name: 'Até 15', hint: 'O bit 16 fica desligado.', pool: range(1, 15) },
];

function daySeed(key = Store.today()) {
  let h = 7;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function flashRule() {
  return FLASH_RULES[daySeed() % FLASH_RULES.length];
}

function flashLevel() {
  const r = flashRule();
  return {
    id: 'flash', sector: 0, kind: 'build', bits: 5, showSum: false, fall: 0, max: 1,
    pool: r.pool, count: Infinity, duration: 60, rule: r, name: 'Relâmpago: ' + r.name, color: '#ffd23f',
  };
}
