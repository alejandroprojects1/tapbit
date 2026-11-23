// Progresso salvo no próprio aparelho (localStorage).
const Store = (() => {
  'use strict';
  const KEY = 'tapbit-save';

  const defaults = () => ({
    coins: 0,
    stars: {},                     // { '1-1': 3, ... } melhor resultado de cada fase
    owned: { robot: ['bitinho'], laser: ['ciano'], theme: ['neon'] },
    equip: { robot: 'bitinho', laser: 'ciano', theme: 'neon' },
    mode: 'iniciante',             // 'iniciante' (dispara sozinho) ou 'desafio' (botão DISPARAR)
    sound: true, music: true, vibe: true,
    unlockAll: false,
    tutorial: false,
    days: [],                      // dias em que jogou (AAAA-MM-DD), para a ofensiva
    daily: null,                   // missões do dia
    bestFlash: 0,
    profile: null,                 // { nome, sala, salaNome } para o ranking da sala
    teacherRooms: [],              // salas criadas neste aparelho
  });

  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* sem storage */ }
    const base = defaults();
    if (!d || typeof d !== 'object') return base;
    const out = Object.assign(base, d);
    out.owned = Object.assign(defaults().owned, d.owned || {});
    out.equip = Object.assign(defaults().equip, d.equip || {});
    if (!Array.isArray(out.days)) out.days = [];
    return out;
  }

  let data = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* sem storage */ }
  }

  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => dayKey();
  const shiftDay = (key, delta) => {
    const [y, m, dd] = key.split('-').map(Number);
    return dayKey(new Date(y, m - 1, dd + delta));
  };

  // Dias seguidos jogando, contando até hoje (ou até ontem, se ainda não jogou hoje).
  function streak() {
    const set = new Set(data.days);
    let day = today();
    if (!set.has(day)) day = shiftDay(day, -1);
    let n = 0;
    while (set.has(day)) { n++; day = shiftDay(day, -1); }
    return n;
  }
  function markPlayed() {
    const t = today();
    if (!data.days.includes(t)) {
      data.days.push(t);
      data.days = data.days.slice(-60);
      save();
    }
  }

  function totalStars() {
    return Object.values(data.stars).reduce((a, b) => a + b, 0);
  }

  function addCoins(n) {
    data.coins = Math.max(0, Math.floor(data.coins + n));
    save();
  }

  function reset() {
    const keep = { sound: data.sound, music: data.music, vibe: data.vibe };
    data = Object.assign(defaults(), keep);
    save();
  }

  return {
    get data() { return data; },
    save, today, shiftDay, streak, markPlayed, totalStars, addCoins, reset,
  };
})();
