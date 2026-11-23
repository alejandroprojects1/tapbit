// Missões diárias (3 por dia, as mesmas para a turma toda no mesmo dia).
const Missions = (() => {
  'use strict';
  const POOL = [
    { id: 'odd', text: 'Acerte 10 números ímpares', hint: 'Ímpar sempre termina com o bit 1 ligado!', goal: 10, reward: 30 },
    { id: 'even', text: 'Acerte 10 números pares', hint: 'Par sempre termina com o bit 1 desligado!', goal: 10, reward: 30 },
    { id: 'big', text: 'Acerte 5 números maiores que 15', hint: 'Esses precisam do bit 16!', goal: 5, reward: 35 },
    { id: 'pow', text: 'Acerte 4 potências de 2 (1, 2, 4, 8, 16)', hint: 'Elas usam só UM bit ligado.', goal: 4, reward: 30 },
    { id: 'combo', text: 'Faça um combo de 5 acertos', hint: '5 seguidos também dão um Pulso PEM!', goal: 5, reward: 35 },
    { id: 'decode', text: 'Decodifique 8 drones hackers', hint: 'Setor 3: some os bits ligados.', goal: 8, reward: 35 },
    { id: 'letters', text: 'Decifre 6 letras secretas', hint: 'Setor 4: A=1, B=2, C=3…', goal: 6, reward: 40 },
    { id: 'stars', text: 'Ganhe 3 estrelas em uma fase', hint: 'Precisão vale mais que pressa!', goal: 1, reward: 40 },
    { id: 'flash', text: 'Jogue 1 Missão Relâmpago', hint: 'Um minuto, quantos acertos?', goal: 1, reward: 25 },
    { id: 'pixel', text: 'Revele 1 imagem no Mundo dos Pixels', hint: '1 acende o pixel, 0 deixa apagado.', goal: 1, reward: 30 },
  ];

  function pick() {
    let seed = daySeed();
    const ids = POOL.map((m) => m.id);
    const out = [];
    while (out.length < 3) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const id = ids.splice(seed % ids.length, 1)[0];
      out.push({ id, progress: 0, claimed: false });
    }
    return out;
  }

  function today() {
    const d = Store.data;
    if (!d.daily || d.daily.date !== Store.today()) {
      d.daily = { date: Store.today(), list: pick() };
      Store.save();
    }
    return d.daily.list.map((m) => Object.assign({}, POOL.find((p) => p.id === m.id), m));
  }

  function bump(id, n = 1, absolute = false) {
    today();
    const m = Store.data.daily.list.find((x) => x.id === id);
    if (!m) return;
    const def = POOL.find((p) => p.id === id);
    const before = m.progress;
    m.progress = Math.min(def.goal, absolute ? Math.max(m.progress, n) : m.progress + n);
    if (m.progress !== before) {
      Store.save();
      if (m.progress >= def.goal && before < def.goal && typeof onDone === 'function') onDone(def);
    }
  }

  let onDone = null;

  // Eventos vindos do jogo
  function track(ev, info = {}) {
    if (ev === 'hit') {
      const v = info.value;
      if (info.kind === 'build') {
        if (v % 2) bump('odd'); else bump('even');
        if (v > 15) bump('big');
        if ([1, 2, 4, 8, 16].includes(v)) bump('pow');
      }
      if (info.kind === 'decode') bump('decode');
      if (info.kind === 'letters') bump('letters');
    } else if (ev === 'combo') bump('combo', info.streak, true);
    else if (ev === 'stars' && info.stars >= 3) bump('stars');
    else if (ev === 'flash') bump('flash');
    else if (ev === 'pixel') bump('pixel');
  }

  function claim(id) {
    const m = Store.data.daily && Store.data.daily.list.find((x) => x.id === id);
    const def = POOL.find((p) => p.id === id);
    if (!m || m.claimed || m.progress < def.goal) return 0;
    m.claimed = true;
    Store.addCoins(def.reward);
    return def.reward;
  }

  const pending = () => today().some((m) => m.progress >= m.goal && !m.claimed);

  return { today, track, claim, pending, set onDone(f) { onDone = f; } };
})();
